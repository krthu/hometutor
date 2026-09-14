import type { Level } from '@/content/schema';
import { scoreOf, type GradeStatus, type SelfRating, type Score } from '@/engine/score';
import { newCard, review, toIsoDate, dueCards, type SrsState } from '@/engine/srs';
import type { SessionMode } from '@/engine/session';

/**
 * The progress model.
 *
 * The attempt log is the single source of truth. Mastery, the streak, the weak-
 * question queue and the spaced-repetition schedule are all *derived* from it by
 * the functions below.
 *
 * That is what makes importing a backup safe: merging two attempt logs is just a
 * union by id, and everything else is recomputed from the merged result. If
 * mastery were stored, merging would have to guess how to combine two numbers.
 */

export const PROGRESS_VERSION = 1;

export interface AnswerRecord {
  questionId: string;
  packId: string;
  topicId: string;
  level: Level;
  type: string;
  status: GradeStatus;
  earned: number;
  max: number;
  /** Present for flashcards. Lets the SRS schedule be replayed from the log. */
  rating?: SelfRating;
  /** Milliseconds spent on this question. */
  ms?: number;
}

export interface Attempt {
  id: string;
  packId: string;
  mode: SessionMode;
  quizId?: string;
  /** ISO datetime. Ordering key for replay. */
  startedAt: string;
  finishedAt: string;
  answers: AnswerRecord[];
}

export interface Profile {
  id: string;
  name: string;
}

export interface ProgressData {
  version: typeof PROGRESS_VERSION;
  profile: Profile;
  attempts: Attempt[];
}

export function emptyProgress(profile: Profile): ProgressData {
  return { version: PROGRESS_VERSION, profile, attempts: [] };
}

// --- Merging ----------------------------------------------------------------

/**
 * Union two attempt logs by attempt id, newest-wins on a genuine id collision.
 *
 * This is why importing an old backup on a device she has kept using does not
 * erase the newer work: nothing is replaced, the two logs are combined.
 */
export function mergeAttempts(a: readonly Attempt[], b: readonly Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const attempt of [...a, ...b]) {
    const existing = byId.get(attempt.id);
    if (!existing || attempt.finishedAt > existing.finishedAt) {
      byId.set(attempt.id, attempt);
    }
  }
  return [...byId.values()].sort((x, y) => x.finishedAt.localeCompare(y.finishedAt));
}

// --- Derivations ------------------------------------------------------------

/** Every answer in the log, oldest first. */
export function allAnswers(attempts: readonly Attempt[]): (AnswerRecord & { at: string })[] {
  return [...attempts]
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
    .flatMap((a) => a.answers.map((ans) => ({ ...ans, at: a.finishedAt })));
}

export interface MasteryKey {
  packId: string;
  topicId: string;
  level: Level;
}

export interface Mastery extends MasteryKey {
  /** 0..1, weighted towards recent answers. */
  score: number;
  answered: number;
  lastAnsweredAt: string;
}

/** How many recent answers count towards mastery for a topic+level. */
export const MASTERY_WINDOW = 10;

/**
 * Mastery per pack/topic/level.
 *
 * Only the most recent MASTERY_WINDOW answers count, and later ones weigh more,
 * so that improving actually moves the number instead of being averaged away by
 * a bad first attempt weeks ago.
 */
export function computeMastery(
  attempts: readonly Attempt[],
  answers = allAnswers(attempts),
): Mastery[] {
  const groups = new Map<string, (AnswerRecord & { at: string })[]>();

  for (const ans of answers) {
    if (ans.max === 0) continue; // flashcards are self-rated, not scored
    const key = `${ans.packId} ${ans.topicId} ${ans.level}`;
    const list = groups.get(key);
    if (list) list.push(ans);
    else groups.set(key, [ans]);
  }

  const out: Mastery[] = [];
  for (const [key, answers] of groups) {
    const [packId, topicId, levelStr] = key.split(' ');
    const recent = answers.slice(-MASTERY_WINDOW);

    let weighted = 0;
    let weightTotal = 0;
    recent.forEach((a, i) => {
      const weight = i + 1; // linear recency weighting
      weighted += (a.earned / a.max) * weight;
      weightTotal += weight;
    });

    out.push({
      packId,
      topicId,
      level: Number(levelStr) as Level,
      score: weightTotal > 0 ? weighted / weightTotal : 0,
      answered: answers.length,
      lastAnsweredAt: answers[answers.length - 1].at,
    });
  }

  return out.sort((a, b) => a.topicId.localeCompare(b.topicId) || a.level - b.level);
}

/**
 * Questions to put first in practice: most recently answered wrong, and not
 * since answered correctly.
 */
export function weakQuestionIds(
  attempts: readonly Attempt[],
  limit = 30,
  answers = allAnswers(attempts),
): string[] {
  const latest = new Map<string, { status: GradeStatus; at: string }>();

  for (const ans of answers) {
    if (ans.max === 0) continue;
    latest.set(ans.questionId, { status: ans.status, at: ans.at });
  }

  return [...latest.entries()]
    .filter(([, v]) => v.status === 'incorrect' || v.status === 'partial')
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, limit)
    .map(([id]) => id);
}

export interface Streak {
  current: number;
  longest: number;
  /** Distinct YYYY-MM-DD dates with at least one finished attempt. */
  activeDays: string[];
}

function localDate(iso: string): string {
  return toIsoDate(new Date(iso));
}

function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d - 1));
}

/**
 * Consecutive days of practice.
 *
 * The current streak survives a day that has not ended yet: practising yesterday
 * but not yet today still counts, so the number does not drop to zero every
 * morning before she has opened the app.
 */
export function computeStreak(attempts: readonly Attempt[], now = new Date()): Streak {
  const days = [...new Set(attempts.map((a) => localDate(a.finishedAt)))].sort();
  if (days.length === 0) return { current: 0, longest: 0, activeDays: [] };

  const daySet = new Set(days);
  const today = toIsoDate(now);
  const yesterday = dayBefore(today);

  let current = 0;
  let cursor: string | null = daySet.has(today) ? today : daySet.has(yesterday) ? yesterday : null;
  while (cursor && daySet.has(cursor)) {
    current++;
    cursor = dayBefore(cursor);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && dayBefore(day) === previous ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest, activeDays: days };
}

/**
 * Rebuild the spaced-repetition schedule by replaying the log in order.
 *
 * Flashcards replay their self-rating. Graded questions are folded in too: a
 * wrong answer behaves like "again" so it comes back soon, a correct one like
 * "good". That way the review queue survives an import without being stored.
 */
export function replaySrs(attempts: readonly Attempt[]): Record<string, SrsState> {
  const states: Record<string, SrsState> = {};

  for (const attempt of [...attempts].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))) {
    const at = new Date(attempt.finishedAt);
    for (const ans of attempt.answers) {
      const rating: SelfRating =
        ans.rating ??
        (ans.status === 'correct' ? 'good' : ans.status === 'partial' ? 'hard' : 'again');

      const existing = states[ans.questionId] ?? newCard(ans.questionId, at);
      states[ans.questionId] = review(existing, rating, at);
    }
  }

  return states;
}

export interface OverallStats {
  attempts: number;
  questionsAnswered: number;
  percent: number;
}

export function overallStats(attempts: readonly Attempt[], answers = allAnswers(attempts)): OverallStats {
  const scored = answers.filter((a) => a.max > 0);
  return {
    attempts: attempts.length,
    questionsAnswered: scored.length,
    percent: scoreOf(scored).percent,
  };
}

/** Score for one attempt, recomputed rather than stored. */
export function attemptScore(attempt: Attempt): Score {
  return scoreOf(attempt.answers);
}

/**
 * Suggest moving up a level.
 *
 * A teaching rule, so it lives here next to the other derivations rather than
 * inline in the result view: only suggest it when the attempt was squarely at one
 * level, that level is not the top one, and she was comfortably on top of it.
 */
export function suggestNextLevel(attempt: Attempt): Level | null {
  const scored = attempt.answers.filter((a) => a.max > 0);
  const levels = [...new Set(scored.map((a) => a.level))];
  if (levels.length !== 1 || levels[0] >= 3) return null;
  return scoreOf(scored).percent >= 80 ? ((levels[0] + 1) as Level) : null;
}

/** Score bands, so praise and every colour choice agree on where the lines are. */
export type Band = 'high' | 'mid' | 'low';

export function band(fraction: number): Band {
  if (fraction >= 0.8) return 'high';
  return fraction >= 0.5 ? 'mid' : 'low';
}

export interface DerivedProgress {
  mastery: Mastery[];
  streak: Streak;
  stats: OverallStats;
  weakIds: string[];
  srs: Record<string, SrsState>;
  dueCount: number;
}

/**
 * Every projection of the attempt log, from one walk of it.
 *
 * The individual functions above stay exported and independently testable, but
 * the app calls this: it flattens the answers once and hands the same list to
 * each derivation, instead of each one re-sorting and re-copying the whole log.
 */
export function deriveProgress(attempts: readonly Attempt[], now = new Date()): DerivedProgress {
  const answers = allAnswers(attempts);
  const srs = replaySrs(attempts);

  return {
    mastery: computeMastery(attempts, answers),
    streak: computeStreak(attempts, now),
    stats: overallStats(attempts, answers),
    weakIds: weakQuestionIds(attempts, 30, answers),
    srs,
    dueCount: dueCards(Object.values(srs), now).length,
  };
}
