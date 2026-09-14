import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  editDistance,
  matchAccepted,
  parseNumeric,
  maxTypos,
  DEFAULT_NORMALIZE,
} from './normalize';

describe('normalizeText', () => {
  it('trims, lowercases and collapses whitespace by default', () => {
    expect(normalizeText('  Blixt   Krig  ')).toBe('blixt krig');
  });

  it('turns punctuation into a space so hyphenation does not matter', () => {
    // The whole reason punctuation is replaced rather than deleted.
    expect(normalizeText('D-dagen')).toBe(normalizeText('D dagen'));
    expect(normalizeText('D-dagen')).toBe('d dagen');
  });

  it('does NOT fold Swedish diacritics by default', () => {
    // Folding would make these equal, and "far" is not an acceptable answer
    // when the expected word is "får".
    expect(normalizeText('får')).not.toBe(normalizeText('far'));
    expect(normalizeText('håll')).not.toBe(normalizeText('hall'));
    expect(normalizeText('Förintelsen')).toBe('förintelsen');
  });

  it('folds diacritics only when explicitly asked to', () => {
    const opts = { ...DEFAULT_NORMALIZE, foldDiacritics: true };
    expect(normalizeText('får', opts)).toBe(normalizeText('far', opts));
    expect(normalizeText('Förintelsen', opts)).toBe('forintelsen');
  });

  it('can keep case when asked', () => {
    expect(normalizeText('FN', { ...DEFAULT_NORMALIZE, ignoreCase: false })).toBe('FN');
  });
});

describe('editDistance (Damerau-Levenshtein)', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('polen', 'polen')).toBe(0);
  });

  it('counts single edits', () => {
    expect(editDistance('polen', 'polan')).toBe(1); // substitution
    expect(editDistance('polen', 'poln')).toBe(1); // deletion
    expect(editDistance('polen', 'polens')).toBe(1); // insertion
  });

  it('charges a transposition only one edit, not two', () => {
    expect(editDistance('blixtkrig', 'blixtkrgi')).toBe(1);
    expect(editDistance('stalingrad', 'stalinrgad')).toBe(1);
  });

  it('handles empty strings', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('', '')).toBe(0);
  });

  it('is symmetric', () => {
    expect(editDistance('stalingrad', 'stalinrgad')).toBe(editDistance('stalinrgad', 'stalingrad'));
  });
});

describe('maxTypos', () => {
  it('forgives nothing in short answers, where one edit is another word', () => {
    expect(maxTypos(4)).toBe(0);
    expect(maxTypos(3)).toBe(0);
  });

  it('forgives one typo in medium words and two in long compounds', () => {
    expect(maxTypos(7)).toBe(1);
    expect(maxTypos(19)).toBe(2);
  });
});

describe('matchAccepted', () => {
  const accept = ['blixtkrig', 'blitzkrieg'];

  it('matches any accepted spelling, case-insensitively', () => {
    expect(matchAccepted('Blixtkrig', accept).matched).toBe(true);
    expect(matchAccepted('  blitzkrieg ', accept).matched).toBe(true);
  });

  it('rejects a wrong answer', () => {
    expect(matchAccepted('ställningskrig', accept).matched).toBe(false);
  });

  it('rejects an empty answer', () => {
    expect(matchAccepted('   ', accept).matched).toBe(false);
  });

  it('rejects a near miss when spelling tolerance is off', () => {
    expect(matchAccepted('blixtkrgi', accept).matched).toBe(false);
  });

  it('accepts a near miss when spelling tolerance is on, and flags it', () => {
    const m = matchAccepted('blixtkrgi', accept, undefined, true);
    expect(m.matched).toBe(true);
    expect(m.viaSpelling).toBe(true);
    expect(m.matchedAnswer).toBe('blixtkrig');
  });

  it('does not let spelling tolerance turn a year into a different year', () => {
    // 1939 vs 1930 is one edit, but they are different answers.
    expect(matchAccepted('1930', ['1939'], undefined, true).matched).toBe(false);
  });

  it('reports which answer matched exactly, without the typo flag', () => {
    const m = matchAccepted('Blitzkrieg', accept, undefined, true);
    expect(m.viaSpelling).toBe(false);
    expect(m.matchedAnswer).toBe('blitzkrieg');
  });
});

describe('parseNumeric', () => {
  it('reads plain integers', () => {
    expect(parseNumeric('1939')).toEqual({ value: 1939, unit: '' });
  });

  it('reads Swedish decimal commas', () => {
    expect(parseNumeric('1,5').value).toBe(1.5);
  });

  it('reads spaces used as thousand separators', () => {
    expect(parseNumeric('1 500').value).toBe(1500);
  });

  it('separates a trailing unit', () => {
    expect(parseNumeric('6 miljoner')).toEqual({ value: 6, unit: 'miljoner' });
  });

  it('handles negatives', () => {
    expect(parseNumeric('-40 grader').value).toBe(-40);
  });

  it('treats the last separator as the decimal point', () => {
    expect(parseNumeric('1.234,5').value).toBe(1234.5);
    expect(parseNumeric('1,234.5').value).toBe(1234.5);
  });

  it('returns null for text with no number', () => {
    expect(parseNumeric('vet inte').value).toBeNull();
    expect(parseNumeric('').value).toBeNull();
  });
});
