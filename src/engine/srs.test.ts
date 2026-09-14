import { describe, it, expect } from 'vitest';
import { newCard, review, dueCards, toIsoDate, isLearned, MIN_EASE, MAX_EASE } from './srs';

const NOW = new Date(2026, 7, 24); // 24 Aug 2026, local

describe('newCard', () => {
  it('starts due today', () => {
    expect(newCard('q1', NOW).due).toBe('2026-08-24');
    expect(newCard('q1', NOW).reps).toBe(0);
  });
});

describe('review', () => {
  it('schedules a first "good" for tomorrow', () => {
    const s = review(newCard('q1', NOW), 'good', NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.due).toBe('2026-08-25');
    expect(s.reps).toBe(1);
  });

  it('grows the interval across successive reviews', () => {
    let s = newCard('q1', NOW);
    s = review(s, 'good', NOW);
    expect(s.intervalDays).toBe(1);
    s = review(s, 'good', NOW);
    expect(s.intervalDays).toBe(3);
    s = review(s, 'good', NOW);
    expect(s.intervalDays).toBeGreaterThan(3);
  });

  it('keeps "again" in the same day rather than pushing it to tomorrow', () => {
    let s = review(newCard('q1', NOW), 'good', NOW);
    s = review(s, 'again', NOW);
    expect(s.due).toBe(toIsoDate(NOW));
    expect(s.intervalDays).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
  });

  it('lowers ease on "again" and raises it on "easy"', () => {
    const base = newCard('q1', NOW);
    expect(review(base, 'again', NOW).ease).toBeLessThan(base.ease);
    expect(review(base, 'easy', NOW).ease).toBeGreaterThan(base.ease);
    expect(review(base, 'good', NOW).ease).toBe(base.ease);
  });

  it('clamps ease so a card can never stop coming back or explode', () => {
    let s = newCard('q1', NOW);
    for (let i = 0; i < 20; i++) s = review(s, 'again', NOW);
    expect(s.ease).toBe(MIN_EASE);

    let e = newCard('q2', NOW);
    for (let i = 0; i < 20; i++) e = review(e, 'easy', NOW);
    expect(e.ease).toBeLessThanOrEqual(MAX_EASE);
  });

  it('caps the interval at a year', () => {
    let s = newCard('q1', NOW);
    for (let i = 0; i < 30; i++) s = review(s, 'easy', NOW);
    expect(s.intervalDays).toBeLessThanOrEqual(365);
  });

  it('moves "hard" forward slowly', () => {
    let s = review(newCard('q1', NOW), 'good', NOW);
    s = review(s, 'good', NOW); // interval 3
    const hard = review(s, 'hard', NOW);
    expect(hard.intervalDays).toBeGreaterThan(3);
    expect(hard.intervalDays).toBeLessThan(3 * hard.ease);
  });
});

describe('dueCards', () => {
  it('returns cards due today or overdue, most overdue first', () => {
    const cards = [
      { ...newCard('a', NOW), due: '2026-08-30' },
      { ...newCard('b', NOW), due: '2026-08-24' },
      { ...newCard('c', NOW), due: '2026-08-20' },
    ];
    expect(dueCards(cards, NOW).map((c) => c.questionId)).toEqual(['c', 'b']);
  });
});

describe('isLearned', () => {
  it('needs both repetitions and a long interval', () => {
    expect(isLearned({ ...newCard('a'), reps: 3, intervalDays: 10 })).toBe(true);
    expect(isLearned({ ...newCard('a'), reps: 3, intervalDays: 2 })).toBe(false);
    expect(isLearned({ ...newCard('a'), reps: 1, intervalDays: 30 })).toBe(false);
  });
});
