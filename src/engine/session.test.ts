import { describe, it, expect } from 'vitest';
import { buildSession, buildQuizSession, filterQuestions, levelStats, shuffledOptions } from './session';
import { realPack as pack } from '@/test/fixtures';

describe('filterQuestions', () => {
  it('returns everything with no filter', () => {
    expect(filterQuestions(pack, { packId: pack.id })).toHaveLength(pack.questions.length);
  });

  it('filters by level', () => {
    const l3 = filterQuestions(pack, { packId: pack.id, levels: [3] });
    expect(l3.length).toBeGreaterThan(0);
    expect(l3.every((q) => q.level === 3)).toBe(true);
  });

  it('filters by topic', () => {
    const t = filterQuestions(pack, { packId: pack.id, topicIds: ['orsaker'] });
    expect(t.every((q) => q.topicId === 'orsaker')).toBe(true);
  });
});

describe('buildSession', () => {
  it('excludes flashcards from practice and tests', () => {
    const s = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'x' });
    expect(s.some((q) => q.type === 'flashcard')).toBe(false);
  });

  it('includes only flashcards in flashcard mode', () => {
    const s = buildSession(pack, { packId: pack.id }, { mode: 'flashcards', seed: 'x' });
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((q) => q.type === 'flashcard')).toBe(true);
  });

  it('is reproducible for the same seed and different across seeds', () => {
    const a = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'seed-a' });
    const b = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'seed-a' });
    const c = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'seed-b' });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a.map((q) => q.id)).not.toEqual(c.map((q) => q.id));
  });

  it('respects the limit', () => {
    const s = buildSession(pack, { packId: pack.id, limit: 5 }, { mode: 'test', seed: 'x' });
    expect(s).toHaveLength(5);
  });

  it('puts weak questions first in practice mode', () => {
    const weak = ['q-stalingrad', 'q-fn'];
    const s = buildSession(pack, { packId: pack.id }, { mode: 'practice', seed: 'x', weakQuestionIds: weak });
    expect(s.slice(0, 2).map((q) => q.id).sort()).toEqual([...weak].sort());
  });

  it('does not reorder for weak questions in test mode', () => {
    const plain = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'x' });
    const withWeak = buildSession(
      pack,
      { packId: pack.id },
      { mode: 'test', seed: 'x', weakQuestionIds: ['q-fn'] },
    );
    expect(plain.map((q) => q.id)).toEqual(withWeak.map((q) => q.id));
  });

  it('never drops or duplicates a question', () => {
    const s = buildSession(pack, { packId: pack.id }, { mode: 'test', seed: 'x' });
    const gradable = pack.questions.filter((q) => q.type !== 'flashcard');
    expect(new Set(s.map((q) => q.id)).size).toBe(s.length);
    expect(s).toHaveLength(gradable.length);
  });
});

describe('buildQuizSession', () => {
  it('returns the author-defined order', () => {
    const quiz = pack.quizzes[0];
    expect(buildQuizSession(pack, quiz.id).map((q) => q.id)).toEqual(quiz.questionIds);
  });

  it('returns nothing for an unknown quiz', () => {
    expect(buildQuizSession(pack, 'finns-inte')).toEqual([]);
  });
});

describe('shuffledOptions', () => {
  const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('keeps the original order when shuffling is off', () => {
    expect(shuffledOptions('q1', options, false)).toEqual(options);
  });

  it('is stable for the same question, so options do not jump on re-render', () => {
    const first = shuffledOptions('q1', options, true);
    const second = shuffledOptions('q1', options, true);
    expect(first).toEqual(second);
  });

  it('keeps every option', () => {
    expect(shuffledOptions('q1', options, true).map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('levelStats', () => {
  it('counts questions per level', () => {
    const stats = levelStats(pack);
    expect(stats).toHaveLength(3);
    expect(stats.reduce((n, s) => n + s.total, 0)).toBe(pack.questions.length);
  });

  it('reports gradable counts separately from flashcards', () => {
    const l1 = levelStats(pack).find((s) => s.level === 1)!;
    expect(l1.gradable).toBeLessThan(l1.total); // level 1 has the flashcards
  });
});
