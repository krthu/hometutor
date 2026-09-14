import {
  matchAccepted,
  parseNumeric,
  normalizeText,
  DEFAULT_NORMALIZE,
} from '@/engine/normalize';
import type {
  Question,
  McqQuestion,
  MultiQuestion,
  TrueFalseQuestion,
  ShortQuestion,
  NumericQuestion,
  ClozeQuestion,
} from '@/content/schema';

/**
 * Grading. Pure functions, no UI and no storage -- everything the result screen
 * and the progress tracker need comes out of `grade()`.
 */

export type GradeStatus = 'correct' | 'partial' | 'incorrect' | 'ungraded';

/** Self-rating on a flashcard. Drives the spaced-repetition schedule. */
export type SelfRating = 'again' | 'hard' | 'good' | 'easy';

export type Response =
  | { type: 'mcq'; optionId: string | null }
  | { type: 'multi'; optionIds: string[] }
  | { type: 'truefalse'; value: boolean | null }
  | { type: 'short'; text: string }
  | { type: 'numeric'; text: string }
  | { type: 'cloze'; values: Record<string, string> }
  | { type: 'flashcard'; rating: SelfRating };

/** Per-blank detail, for the review screen. */
export interface GradePart {
  id: string;
  correct: boolean;
  /** What she wrote. Only meaningful where the answer is free text. */
  given?: string;
  /** The expected answer, verbatim from the content pack -- never a UI label. */
  expected?: string;
}

export interface GradeResult {
  status: GradeStatus;
  /** Points scored, 0..max. */
  earned: number;
  /** Points available. 0 for flashcards, which never count towards a score. */
  max: number;
  /** Fraction 0..1. Convenience for progress maths. */
  fraction: number;
  parts?: GradePart[];
  /** Set when a free-text answer was only accepted because of spelling tolerance. */
  acceptedWithTypo?: boolean;
  /** Echoed back for flashcards, so the attempt record has one source. */
  rating?: SelfRating;
}

function result(
  status: GradeStatus,
  earned: number,
  max: number,
  extra: Partial<GradeResult> = {},
): GradeResult {
  return {
    status,
    earned: Math.round(earned * 1000) / 1000,
    max,
    fraction: max > 0 ? Math.max(0, Math.min(1, earned / max)) : 0,
    ...extra,
  };
}

// --- Per-type grading -------------------------------------------------------

function gradeMcq(q: McqQuestion, r: Extract<Response, { type: 'mcq' }>): GradeResult {
  const correct = r.optionId !== null && r.optionId === q.answer;
  return result(correct ? 'correct' : 'incorrect', correct ? q.points : 0, q.points);
}

function gradeMulti(q: MultiQuestion, r: Extract<Response, { type: 'multi' }>): GradeResult {
  const correctSet = new Set(q.answers);
  const chosen = new Set(r.optionIds);

  const hits = [...chosen].filter((id) => correctSet.has(id)).length;
  const falseAlarms = [...chosen].filter((id) => !correctSet.has(id)).length;

  // Partial credit, with wrong picks cancelling right ones so that selecting
  // everything scores zero rather than full marks.
  const fraction = Math.max(0, (hits - falseAlarms) / correctSet.size);
  const earned = fraction * q.points;

  // Per option: did she treat it the way she should have? The multi view marks
  // itself from `question.answers`, so this is only for the review screen.
  const parts: GradePart[] = q.options.map((o) => ({
    id: o.id,
    correct: correctSet.has(o.id) === chosen.has(o.id),
  }));

  const status: GradeStatus = fraction === 1 ? 'correct' : fraction === 0 ? 'incorrect' : 'partial';
  return result(status, earned, q.points, { parts });
}

function gradeTrueFalse(
  q: TrueFalseQuestion,
  r: Extract<Response, { type: 'truefalse' }>,
): GradeResult {
  const correct = r.value !== null && r.value === q.answer;
  return result(correct ? 'correct' : 'incorrect', correct ? q.points : 0, q.points);
}

function gradeShort(q: ShortQuestion, r: Extract<Response, { type: 'short' }>): GradeResult {
  const m = matchAccepted(r.text, q.accept, q.normalize, q.spellingTolerance);
  return result(m.matched ? 'correct' : 'incorrect', m.matched ? q.points : 0, q.points, {
    acceptedWithTypo: m.viaSpelling || undefined,
  });
}

function gradeNumeric(q: NumericQuestion, r: Extract<Response, { type: 'numeric' }>): GradeResult {
  const { value, unit } = parseNumeric(r.text);
  if (value === null) return result('incorrect', 0, q.points);

  // If both tolerances are given the more generous one wins, so an author can
  // set a floor with `tolerance` and a proportional band with `tolerancePercent`.
  const absolute = q.tolerance;
  const relative =
    q.tolerancePercent !== undefined ? Math.abs(q.answer) * (q.tolerancePercent / 100) : 0;
  const allowed = Math.max(absolute, relative);

  // Guard against binary floating point: 0.1 + 0.2 must not miss a 0.3 answer.
  const withinValue = Math.abs(value - q.answer) <= allowed + Number.EPSILON * 8;

  let unitOk = true;
  if (q.unit && q.unit.trim() !== '') {
    const givenUnit = normalizeText(unit, DEFAULT_NORMALIZE);
    if (givenUnit === '') {
      unitOk = q.acceptUnitless;
    } else {
      unitOk = givenUnit === normalizeText(q.unit, DEFAULT_NORMALIZE);
    }
  }

  const correct = withinValue && unitOk;
  return result(correct ? 'correct' : 'incorrect', correct ? q.points : 0, q.points);
}

function gradeCloze(q: ClozeQuestion, r: Extract<Response, { type: 'cloze' }>): GradeResult {
  let typo = false;

  const parts: GradePart[] = q.blanks.map((b) => {
    const given = r.values[b.id] ?? '';
    const m = matchAccepted(given, b.accept, b.normalize, b.spellingTolerance);
    if (m.viaSpelling) typo = true;
    return { id: b.id, correct: m.matched, given, expected: b.accept[0] };
  });

  const hits = parts.filter((p) => p.correct).length;
  const fraction = hits / q.blanks.length;
  const status: GradeStatus = fraction === 1 ? 'correct' : fraction === 0 ? 'incorrect' : 'partial';

  return result(status, fraction * q.points, q.points, {
    parts,
    acceptedWithTypo: typo || undefined,
  });
}

// --- Entry point ------------------------------------------------------------

export class GradingError extends Error {}

/**
 * Grade one answer.
 *
 * Flashcards return `ungraded` with max 0: they are self-rated, so counting them
 * would let the student inflate their own score.
 */
export function grade(q: Question, r: Response | null | undefined): GradeResult {
  if (q.type === 'flashcard') {
    return result('ungraded', 0, 0, {
      rating: r?.type === 'flashcard' ? r.rating : undefined,
    });
  }

  if (!r) return result('incorrect', 0, 'points' in q ? q.points : 1);

  if (r.type !== q.type) {
    throw new GradingError(
      `response type "${r.type}" does not match question "${q.id}" of type "${q.type}"`,
    );
  }

  switch (q.type) {
    case 'mcq':
      return gradeMcq(q, r as Extract<Response, { type: 'mcq' }>);
    case 'multi':
      return gradeMulti(q, r as Extract<Response, { type: 'multi' }>);
    case 'truefalse':
      return gradeTrueFalse(q, r as Extract<Response, { type: 'truefalse' }>);
    case 'short':
      return gradeShort(q, r as Extract<Response, { type: 'short' }>);
    case 'numeric':
      return gradeNumeric(q, r as Extract<Response, { type: 'numeric' }>);
    case 'cloze':
      return gradeCloze(q, r as Extract<Response, { type: 'cloze' }>);
    default:
      throw new GradingError(
        `cannot grade question "${(q as Question).id}": type "${(q as Question).type}" is not implemented`,
      );
  }
}

export interface Score {
  earned: number;
  max: number;
  /** Whole percent. 0 for a set worth no points, rather than NaN. */
  percent: number;
}

/**
 * Total anything that carries points.
 *
 * Deliberately structural rather than typed to `GradeResult`: the same sum is
 * needed over stored `AnswerRecord`s, and both only ever contribute these two
 * fields. Flashcards drop out on their own via a `max` of 0.
 */
export function scoreOf(items: readonly { earned: number; max: number }[]): Score {
  const earned = items.reduce((n, r) => n + r.earned, 0);
  const max = items.reduce((n, r) => n + r.max, 0);
  return {
    earned: Math.round(earned * 100) / 100,
    max,
    percent: max > 0 ? Math.round((earned / max) * 100) : 0,
  };
}
