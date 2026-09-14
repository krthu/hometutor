import type { NormalizeOptions } from '@/content/schema';

/**
 * Text comparison for free-text answers (short answer and cloze blanks).
 *
 * The rules are deliberately conservative. A study app that accepts a wrong term
 * teaches the wrong term, so every loosening is opt-in per question.
 */

export const DEFAULT_NORMALIZE: NormalizeOptions = {
  ignoreCase: true,
  ignorePunctuation: true,
  collapseWhitespace: true,
  foldDiacritics: false,
};

/**
 * Punctuation is replaced with a space rather than deleted, so that "D-dagen"
 * and "D dagen" normalise to the same thing instead of "ddagen" vs "d dagen".
 */
const PUNCTUATION = /[.,!?;:'"«»„“”‘’()[\]{}<>/\\|@#$%^&*_+=~`…–—-]/g;

export function normalizeText(input: string, opts: NormalizeOptions = DEFAULT_NORMALIZE): string {
  let s = input;

  if (opts.ignoreCase) s = s.toLowerCase();
  if (opts.ignorePunctuation) s = s.replace(PUNCTUATION, ' ');

  if (opts.foldDiacritics) {
    // Opt-in only. In Swedish this makes "far"/"får" and "hall"/"håll" equal,
    // which is usually a wrong answer being marked correct.
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  if (opts.collapseWhitespace) s = s.replace(/\s+/g, ' ');

  return s.trim();
}

/**
 * Damerau-Levenshtein (optimal string alignment): insertions, deletions and
 * substitutions cost one edit each, and so does transposing two adjacent
 * characters.
 *
 * That last part is why it is not plain Levenshtein. Swapped letters are the most
 * common typing mistake by a wide margin -- "blixtkrgi" for "blixtkrig" is one
 * slip of the fingers, and charging it two edits would push it outside any sane
 * spelling-tolerance budget.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i][j - 1] + 1, rows[i - 1][j] + 1, rows[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, rows[i - 2][j - 2] + 1);
      }
      rows[i][j] = d;
    }
  }

  return rows[a.length][b.length];
}

/**
 * How many typos to forgive in an answer of this length, when the question opts
 * into spelling tolerance.
 *
 * Short words get none -- at 4 characters or fewer, one edit is usually a
 * different word ("far"/"var", "1939"/"1930"). Long Swedish compounds get two,
 * because "eftergiftspolitiken" is 19 characters typed on a phone keyboard and
 * demanding it letter-perfect tests typing, not history.
 */
export function maxTypos(expectedLength: number): number {
  if (expectedLength <= 4) return 0;
  if (expectedLength >= 12) return 2;
  return 1;
}

export interface MatchResult {
  matched: boolean;
  /** Which accepted answer matched, for feedback. */
  matchedAnswer?: string;
  /** True when it only matched thanks to spelling tolerance. */
  viaSpelling: boolean;
}

/**
 * Compare a student's free-text answer against the list of accepted answers.
 */
export function matchAccepted(
  input: string,
  accept: readonly string[],
  opts: NormalizeOptions = DEFAULT_NORMALIZE,
  spellingTolerance = false,
): MatchResult {
  const given = normalizeText(input, opts);
  if (given.length === 0) return { matched: false, viaSpelling: false };

  const normalised = accept.map((a) => ({ raw: a, norm: normalizeText(a, opts) }));

  for (const a of normalised) {
    if (a.norm === given) return { matched: true, matchedAnswer: a.raw, viaSpelling: false };
  }

  if (spellingTolerance) {
    for (const a of normalised) {
      const budget = maxTypos(a.norm.length);
      if (budget > 0 && editDistance(given, a.norm) <= budget) {
        return { matched: true, matchedAnswer: a.raw, viaSpelling: true };
      }
    }
  }

  return { matched: false, viaSpelling: false };
}

/**
 * Pull a number out of what the student typed, tolerating the ways a Swedish
 * student actually writes numbers: "1,5" for 1.5 and "1 500" for 1500.
 *
 * Returns the number and whatever trailing text looked like a unit.
 */
export function parseNumeric(input: string): { value: number | null; unit: string } {
  const trimmed = input.trim();
  const m = trimmed.match(/^([+-]?[\d\s.,]*\d)\s*(.*)$/);
  if (!m) return { value: null, unit: '' };

  let numberPart = m[1].replace(/\s/g, '');
  const unit = m[2].trim();

  const hasComma = numberPart.includes(',');
  const hasDot = numberPart.includes('.');

  if (hasComma && hasDot) {
    // Whichever separator comes last is the decimal point; the other groups digits.
    const decimalSep = numberPart.lastIndexOf(',') > numberPart.lastIndexOf('.') ? ',' : '.';
    const groupSep = decimalSep === ',' ? '.' : ',';
    numberPart = numberPart.split(groupSep).join('');
    numberPart = numberPart.replace(decimalSep, '.');
  } else if (hasComma) {
    numberPart = numberPart.replace(',', '.');
  }

  const value = Number(numberPart);
  return { value: Number.isFinite(value) ? value : null, unit };
}
