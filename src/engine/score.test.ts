import { describe, it, expect } from 'vitest';
import { grade, scoreOf, GradingError, type Response } from './score';
import { canSubmit } from './response';
import { questionSchema, type Question } from '@/content/schema';

/** Build a question through the schema so defaults (points, shuffle, ...) apply. */
function q(input: Record<string, unknown>): Question {
  return questionSchema.parse({ topicId: 'ett', level: 1, ...input });
}

const mcq = q({
  id: 'm1',
  type: 'mcq',
  prompt: 'När började kriget?',
  explanation: '1939.',
  options: [
    { id: 'a', text: '1939' },
    { id: 'b', text: '1941' },
  ],
  answer: 'a',
});

const multi = q({
  id: 'mu1',
  type: 'multi',
  prompt: 'Vilka var allierade?',
  explanation: '...',
  options: [
    { id: 'a', text: 'Storbritannien' },
    { id: 'b', text: 'Sovjet' },
    { id: 'c', text: 'Italien' },
    { id: 'd', text: 'Japan' },
  ],
  answers: ['a', 'b'],
});

const tf = q({
  id: 't1',
  type: 'truefalse',
  prompt: 'Sverige var neutralt.',
  explanation: '...',
  answer: true,
});

const short = q({
  id: 's1',
  type: 'short',
  prompt: 'Taktiken?',
  explanation: '...',
  accept: ['blixtkrig', 'blitzkrieg'],
  spellingTolerance: true,
});

const numeric = q({
  id: 'n1',
  type: 'numeric',
  prompt: 'Hur många miljoner?',
  explanation: '...',
  answer: 6,
  tolerance: 0.5,
  unit: 'miljoner',
});

const cloze = q({
  id: 'c1',
  type: 'cloze',
  prompt: 'Den 1 september {{ar}} anföll Tyskland {{land}}.',
  explanation: '...',
  blanks: [
    { id: 'ar', accept: ['1939'] },
    { id: 'land', accept: ['Polen'] },
  ],
});

const flashcard = q({
  id: 'f1',
  type: 'flashcard',
  prompt: 'Förintelsen',
  back: 'Folkmordet på Europas judar.',
});

describe('mcq', () => {
  it('scores a right answer', () => {
    const r = grade(mcq, { type: 'mcq', optionId: 'a' });
    expect(r.status).toBe('correct');
    expect(r.earned).toBe(1);
    expect(r.max).toBe(1);
  });

  it('scores a wrong answer', () => {
    expect(grade(mcq, { type: 'mcq', optionId: 'b' }).status).toBe('incorrect');
  });

  it('treats no answer as wrong, not as an error', () => {
    const r = grade(mcq, { type: 'mcq', optionId: null });
    expect(r.status).toBe('incorrect');
    expect(r.earned).toBe(0);
  });
});

describe('multi partial credit', () => {
  it('gives full marks for exactly the right set', () => {
    const r = grade(multi, { type: 'multi', optionIds: ['a', 'b'] });
    expect(r.status).toBe('correct');
    expect(r.fraction).toBe(1);
  });

  it('gives half marks for one of two right and nothing wrong', () => {
    const r = grade(multi, { type: 'multi', optionIds: ['a'] });
    expect(r.status).toBe('partial');
    expect(r.fraction).toBe(0.5);
  });

  it('cancels a right pick with a wrong one', () => {
    // 1 hit, 1 false alarm, 2 correct answers -> (1-1)/2 = 0
    const r = grade(multi, { type: 'multi', optionIds: ['a', 'c'] });
    expect(r.status).toBe('incorrect');
    expect(r.earned).toBe(0);
  });

  it('scores zero for selecting everything, rather than full marks', () => {
    const r = grade(multi, { type: 'multi', optionIds: ['a', 'b', 'c', 'd'] });
    expect(r.earned).toBe(0);
  });

  it('never goes negative', () => {
    const r = grade(multi, { type: 'multi', optionIds: ['c', 'd'] });
    expect(r.earned).toBe(0);
    expect(r.fraction).toBe(0);
  });

  it('reports per-option detail for the review screen', () => {
    const r = grade(multi, { type: 'multi', optionIds: ['a', 'c'] });
    expect(r.parts).toHaveLength(4);
    expect(r.parts?.find((p) => p.id === 'a')?.correct).toBe(true);
    expect(r.parts?.find((p) => p.id === 'c')?.correct).toBe(false);
    expect(r.parts?.find((p) => p.id === 'b')?.correct).toBe(false); // missed a correct one
  });
});

describe('truefalse', () => {
  it('grades both values', () => {
    expect(grade(tf, { type: 'truefalse', value: true }).status).toBe('correct');
    expect(grade(tf, { type: 'truefalse', value: false }).status).toBe('incorrect');
  });

  it('treats unanswered as wrong', () => {
    expect(grade(tf, { type: 'truefalse', value: null }).status).toBe('incorrect');
  });
});

describe('short answer', () => {
  it('accepts any listed spelling', () => {
    expect(grade(short, { type: 'short', text: 'Blixtkrig' }).status).toBe('correct');
    expect(grade(short, { type: 'short', text: 'blitzkrieg' }).status).toBe('correct');
  });

  it('rejects a different word', () => {
    expect(grade(short, { type: 'short', text: 'skyttegravskrig' }).status).toBe('incorrect');
  });

  it('flags an answer accepted only via spelling tolerance', () => {
    const r = grade(short, { type: 'short', text: 'blixtkrgi' });
    expect(r.status).toBe('correct');
    expect(r.acceptedWithTypo).toBe(true);
  });

  it('does not flag an exactly correct answer', () => {
    expect(grade(short, { type: 'short', text: 'blixtkrig' }).acceptedWithTypo).toBeUndefined();
  });

  it('rejects an empty answer', () => {
    expect(grade(short, { type: 'short', text: '   ' }).status).toBe('incorrect');
  });
});

describe('numeric', () => {
  it('accepts the exact answer with its unit', () => {
    expect(grade(numeric, { type: 'numeric', text: '6 miljoner' }).status).toBe('correct');
  });

  it('accepts a bare number when acceptUnitless defaults to true', () => {
    expect(grade(numeric, { type: 'numeric', text: '6' }).status).toBe('correct');
  });

  it('honours the tolerance band', () => {
    expect(grade(numeric, { type: 'numeric', text: '5,5' }).status).toBe('correct');
    expect(grade(numeric, { type: 'numeric', text: '6.5' }).status).toBe('correct');
    expect(grade(numeric, { type: 'numeric', text: '7' }).status).toBe('incorrect');
  });

  it('rejects a wrong unit', () => {
    expect(grade(numeric, { type: 'numeric', text: '6 tusen' }).status).toBe('incorrect');
  });

  it('rejects text with no number', () => {
    expect(grade(numeric, { type: 'numeric', text: 'vet inte' }).status).toBe('incorrect');
  });

  it('does not lose an exact answer to floating point', () => {
    const tenth = q({
      id: 'n2',
      type: 'numeric',
      prompt: '?',
      explanation: '.',
      answer: 0.3,
      tolerance: 0,
    });
    expect(grade(tenth, { type: 'numeric', text: '0,3' }).status).toBe('correct');
  });

  it('uses the more generous of absolute and percentage tolerance', () => {
    const pct = q({
      id: 'n3',
      type: 'numeric',
      prompt: '?',
      explanation: '.',
      answer: 1000,
      tolerance: 5,
      tolerancePercent: 10,
    });
    expect(grade(pct, { type: 'numeric', text: '1090' }).status).toBe('correct'); // within 10%
    expect(grade(pct, { type: 'numeric', text: '1200' }).status).toBe('incorrect');
  });
});

describe('cloze', () => {
  it('gives full marks when every blank is right', () => {
    const r = grade(cloze, { type: 'cloze', values: { ar: '1939', land: 'Polen' } });
    expect(r.status).toBe('correct');
    expect(r.fraction).toBe(1);
  });

  it('gives partial credit per blank', () => {
    const r = grade(cloze, { type: 'cloze', values: { ar: '1939', land: 'Frankrike' } });
    expect(r.status).toBe('partial');
    expect(r.fraction).toBe(0.5);
  });

  it('reports which blank was wrong and what was expected', () => {
    const r = grade(cloze, { type: 'cloze', values: { ar: '1941', land: 'Polen' } });
    const ar = r.parts?.find((p) => p.id === 'ar');
    expect(ar?.correct).toBe(false);
    expect(ar?.given).toBe('1941');
    expect(ar?.expected).toBe('1939');
  });

  it('treats a missing blank as wrong rather than crashing', () => {
    const r = grade(cloze, { type: 'cloze', values: { ar: '1939' } });
    expect(r.fraction).toBe(0.5);
  });
});

describe('flashcard', () => {
  it('is ungraded and worth no points, so self-rating cannot inflate a score', () => {
    const r = grade(flashcard, { type: 'flashcard', rating: 'easy' });
    expect(r.status).toBe('ungraded');
    expect(r.max).toBe(0);
    expect(r.earned).toBe(0);
  });
});

describe('grade() guards', () => {
  it('treats a missing response as incorrect', () => {
    expect(grade(mcq, null).status).toBe('incorrect');
    expect(grade(mcq, undefined).earned).toBe(0);
  });

  it('throws when the response type does not match the question', () => {
    expect(() => grade(mcq, { type: 'short', text: 'a' } as Response)).toThrow(GradingError);
  });
});

describe('canSubmit', () => {
  it('rejects unanswered questions of every type', () => {
    expect(canSubmit({ type: 'mcq', optionId: null })).toBe(false);
    expect(canSubmit({ type: 'multi', optionIds: [] })).toBe(false);
    expect(canSubmit({ type: 'truefalse', value: null })).toBe(false);
    expect(canSubmit({ type: 'short', text: '  ' })).toBe(false);
    expect(canSubmit({ type: 'cloze', values: { ar: '', land: '' } })).toBe(false);
    expect(canSubmit(null)).toBe(false);
  });

  it('accepts a partially filled cloze, which still earns partial credit', () => {
    expect(canSubmit({ type: 'mcq', optionId: 'a' })).toBe(true);
    expect(canSubmit({ type: 'cloze', values: { ar: '1939', land: '' } })).toBe(true);
  });
});

describe('scoreOf', () => {
  it('sums points and computes a percentage', () => {
    const results = [
      grade(mcq, { type: 'mcq', optionId: 'a' }), // 1/1
      grade(multi, { type: 'multi', optionIds: ['a'] }), // 0.5/1
      grade(tf, { type: 'truefalse', value: false }), // 0/1
    ];
    expect(scoreOf(results)).toEqual({ earned: 1.5, max: 3, percent: 50 });
  });

  it('excludes flashcards from the total', () => {
    const results = [
      grade(mcq, { type: 'mcq', optionId: 'a' }),
      grade(flashcard, { type: 'flashcard', rating: 'good' }),
    ];
    expect(scoreOf(results)).toEqual({ earned: 1, max: 1, percent: 100 });
  });

  it('does not divide by zero for an all-flashcard session', () => {
    expect(scoreOf([grade(flashcard, { type: 'flashcard', rating: 'good' })])).toEqual({
      earned: 0,
      max: 0,
      percent: 0,
    });
  });
});
