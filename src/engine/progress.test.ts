import { describe, it, expect } from 'vitest';
import {
  band,
  deriveProgress,
  suggestNextLevel,
  mergeAttempts,
  computeMastery,
  computeStreak,
  weakQuestionIds,
  replaySrs,
  overallStats,
  attemptScore,
  MASTERY_WINDOW,
  type Attempt,
  type AnswerRecord,
} from './progress';

function answer(over: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    questionId: 'q1',
    packId: 'p',
    topicId: 'orsaker',
    level: 1,
    type: 'mcq',
    status: 'correct',
    earned: 1,
    max: 1,
    ...over,
  };
}

function attempt(id: string, finishedAt: string, answers: AnswerRecord[]): Attempt {
  return { id, packId: 'p', mode: 'test', startedAt: finishedAt, finishedAt, answers };
}

describe('mergeAttempts', () => {
  it('unions two logs without losing anything', () => {
    const a = [attempt('1', '2026-08-01T10:00:00Z', [answer()])];
    const b = [attempt('2', '2026-08-02T10:00:00Z', [answer()])];
    expect(mergeAttempts(a, b).map((x) => x.id)).toEqual(['1', '2']);
  });

  it('does not duplicate the same attempt present in both', () => {
    const shared = attempt('1', '2026-08-01T10:00:00Z', [answer()]);
    expect(mergeAttempts([shared], [shared])).toHaveLength(1);
  });

  it('keeps newer work when an old backup is imported over it', () => {
    // The scenario the export feature exists for: she has a backup from Monday,
    // practises Tue/Wed/Thu, then imports the Monday file.
    const backup = [attempt('mon', '2026-08-24T10:00:00Z', [answer()])];
    const sinceThen = [
      attempt('mon', '2026-08-24T10:00:00Z', [answer()]),
      attempt('tue', '2026-08-25T10:00:00Z', [answer()]),
      attempt('wed', '2026-08-26T10:00:00Z', [answer()]),
      attempt('thu', '2026-08-27T10:00:00Z', [answer()]),
    ];

    const merged = mergeAttempts(sinceThen, backup);
    expect(merged).toHaveLength(4);
    expect(merged.map((a) => a.id)).toEqual(['mon', 'tue', 'wed', 'thu']);
  });

  it('returns attempts oldest first', () => {
    const merged = mergeAttempts(
      [attempt('b', '2026-08-05T10:00:00Z', [])],
      [attempt('a', '2026-08-01T10:00:00Z', [])],
    );
    expect(merged.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('is commutative in membership', () => {
    const a = [attempt('1', '2026-08-01T10:00:00Z', []), attempt('2', '2026-08-02T10:00:00Z', [])];
    const b = [attempt('2', '2026-08-02T10:00:00Z', []), attempt('3', '2026-08-03T10:00:00Z', [])];
    expect(mergeAttempts(a, b).map((x) => x.id)).toEqual(mergeAttempts(b, a).map((x) => x.id));
  });
});

describe('computeMastery', () => {
  it('is 1 when everything was right', () => {
    const m = computeMastery([attempt('1', '2026-08-01T10:00:00Z', [answer(), answer()])]);
    expect(m[0].score).toBe(1);
  });

  it('separates topic and level', () => {
    const m = computeMastery([
      attempt('1', '2026-08-01T10:00:00Z', [
        answer({ topicId: 'orsaker', level: 1 }),
        answer({ topicId: 'forlopp', level: 2, status: 'incorrect', earned: 0 }),
      ]),
    ]);
    expect(m).toHaveLength(2);
    expect(m.find((x) => x.topicId === 'orsaker')!.score).toBe(1);
    expect(m.find((x) => x.topicId === 'forlopp')!.score).toBe(0);
  });

  it('weights recent answers more heavily, so improving shows up', () => {
    // Five wrong, then five right. A flat mean would say 0.5.
    const answers = [
      ...Array.from({ length: 5 }, () => answer({ status: 'incorrect', earned: 0 })),
      ...Array.from({ length: 5 }, () => answer()),
    ];
    const m = computeMastery([attempt('1', '2026-08-01T10:00:00Z', answers)]);
    expect(m[0].score).toBeGreaterThan(0.5);
  });

  it('only counts the most recent window', () => {
    const old = Array.from({ length: MASTERY_WINDOW }, () =>
      answer({ status: 'incorrect', earned: 0 }),
    );
    const recent = Array.from({ length: MASTERY_WINDOW }, () => answer());
    const m = computeMastery([
      attempt('1', '2026-08-01T10:00:00Z', old),
      attempt('2', '2026-08-02T10:00:00Z', recent),
    ]);
    expect(m[0].score).toBe(1);
    expect(m[0].answered).toBe(MASTERY_WINDOW * 2);
  });

  it('ignores flashcards, which are self-rated', () => {
    const m = computeMastery([
      attempt('1', '2026-08-01T10:00:00Z', [
        answer(),
        answer({ type: 'flashcard', status: 'ungraded', earned: 0, max: 0, rating: 'easy' }),
      ]),
    ]);
    expect(m).toHaveLength(1);
    expect(m[0].score).toBe(1);
  });

  it('counts partial credit proportionally', () => {
    const m = computeMastery([
      attempt('1', '2026-08-01T10:00:00Z', [answer({ status: 'partial', earned: 0.5, max: 1 })]),
    ]);
    expect(m[0].score).toBe(0.5);
  });
});

describe('weakQuestionIds', () => {
  it('lists questions last answered wrong', () => {
    const a = [
      attempt('1', '2026-08-01T10:00:00Z', [
        answer({ questionId: 'a', status: 'incorrect', earned: 0 }),
        answer({ questionId: 'b' }),
      ]),
    ];
    expect(weakQuestionIds(a)).toEqual(['a']);
  });

  it('drops a question once it has since been answered correctly', () => {
    const a = [
      attempt('1', '2026-08-01T10:00:00Z', [answer({ questionId: 'a', status: 'incorrect', earned: 0 })]),
      attempt('2', '2026-08-02T10:00:00Z', [answer({ questionId: 'a' })]),
    ];
    expect(weakQuestionIds(a)).toEqual([]);
  });

  it('includes partially correct answers', () => {
    const a = [
      attempt('1', '2026-08-01T10:00:00Z', [
        answer({ questionId: 'a', status: 'partial', earned: 0.5 }),
      ]),
    ];
    expect(weakQuestionIds(a)).toEqual(['a']);
  });

  it('puts the most recent mistakes first and honours the limit', () => {
    const a = [
      attempt('1', '2026-08-01T10:00:00Z', [answer({ questionId: 'old', status: 'incorrect', earned: 0 })]),
      attempt('2', '2026-08-05T10:00:00Z', [answer({ questionId: 'new', status: 'incorrect', earned: 0 })]),
    ];
    expect(weakQuestionIds(a)).toEqual(['new', 'old']);
    expect(weakQuestionIds(a, 1)).toEqual(['new']);
  });
});

describe('computeStreak', () => {
  const at = (day: string) => attempt(day, `2026-08-${day}T10:00:00`, [answer()]);

  it('counts consecutive days up to today', () => {
    const now = new Date(2026, 7, 26, 12);
    expect(computeStreak([at('24'), at('25'), at('26')], now).current).toBe(3);
  });

  it('survives a day that has not been used yet', () => {
    // Practised yesterday, has not opened the app today: the streak is alive.
    const now = new Date(2026, 7, 26, 8);
    expect(computeStreak([at('24'), at('25')], now).current).toBe(2);
  });

  it('breaks after a missed day', () => {
    const now = new Date(2026, 7, 27, 12);
    expect(computeStreak([at('24'), at('25')], now).current).toBe(0);
  });

  it('tracks the longest run separately from the current one', () => {
    const now = new Date(2026, 7, 27, 12);
    const s = computeStreak([at('10'), at('11'), at('12'), at('13'), at('26'), at('27')], now);
    expect(s.longest).toBe(4);
    expect(s.current).toBe(2);
  });

  it('counts several attempts in one day as one day', () => {
    const now = new Date(2026, 7, 24, 20);
    const twice = [
      attempt('a', '2026-08-24T10:00:00', [answer()]),
      attempt('b', '2026-08-24T18:00:00', [answer()]),
    ];
    expect(computeStreak(twice, now).current).toBe(1);
    expect(computeStreak(twice, now).activeDays).toEqual(['2026-08-24']);
  });

  it('is zero with no attempts', () => {
    expect(computeStreak([], new Date())).toEqual({ current: 0, longest: 0, activeDays: [] });
  });
});

describe('replaySrs', () => {
  it('rebuilds a schedule from the attempt log alone', () => {
    const states = replaySrs([
      attempt('1', '2026-08-01T10:00:00Z', [
        answer({ questionId: 'card', type: 'flashcard', status: 'ungraded', earned: 0, max: 0, rating: 'good' }),
      ]),
    ]);
    expect(states.card.reps).toBe(1);
    expect(states.card.intervalDays).toBe(1);
  });

  it('treats a wrong graded answer like "again" so it comes back', () => {
    const states = replaySrs([
      attempt('1', '2026-08-01T10:00:00Z', [answer({ questionId: 'q', status: 'incorrect', earned: 0 })]),
    ]);
    expect(states.q.reps).toBe(0);
    expect(states.q.lapses).toBe(1);
  });

  it('is deterministic -- replaying the same log twice gives the same schedule', () => {
    const log = [
      attempt('1', '2026-08-01T10:00:00Z', [answer({ questionId: 'q', status: 'incorrect', earned: 0 })]),
      attempt('2', '2026-08-03T10:00:00Z', [answer({ questionId: 'q' })]),
    ];
    expect(replaySrs(log)).toEqual(replaySrs(log));
  });

  it('does not depend on the order attempts happen to be stored in', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [answer({ questionId: 'q', status: 'incorrect', earned: 0 })]);
    const b = attempt('2', '2026-08-03T10:00:00Z', [answer({ questionId: 'q' })]);
    expect(replaySrs([a, b])).toEqual(replaySrs([b, a]));
  });
});

describe('overallStats and attemptScore', () => {
  it('summarises the whole log, excluding flashcards', () => {
    const log = [
      attempt('1', '2026-08-01T10:00:00Z', [
        answer(),
        answer({ status: 'incorrect', earned: 0 }),
        answer({ type: 'flashcard', status: 'ungraded', earned: 0, max: 0 }),
      ]),
    ];
    expect(overallStats(log)).toEqual({ attempts: 1, questionsAnswered: 2, percent: 50 });
  });

  it('scores a single attempt', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [
      answer(),
      answer({ status: 'partial', earned: 0.5 }),
    ]);
    expect(attemptScore(a)).toEqual({ earned: 1.5, max: 2, percent: 75 });
  });

  it('does not divide by zero for a flashcard-only session', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [
      answer({ type: 'flashcard', status: 'ungraded', earned: 0, max: 0 }),
    ]);
    expect(attemptScore(a).percent).toBe(0);
  });
});

describe('suggestNextLevel', () => {
  it('suggests moving up after a strong run at one level', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [
      answer({ level: 1 }),
      answer({ level: 1 }),
      answer({ level: 1 }),
      answer({ level: 1 }),
      answer({ level: 1, status: 'incorrect', earned: 0 }),
    ]);
    expect(suggestNextLevel(a)).toBe(2);
  });

  it('stays put when the score is not convincing', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [
      answer({ level: 1 }),
      answer({ level: 1, status: 'incorrect', earned: 0 }),
    ]);
    expect(suggestNextLevel(a)).toBeNull();
  });

  it('says nothing when the attempt spanned several levels', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [answer({ level: 1 }), answer({ level: 2 })]);
    expect(suggestNextLevel(a)).toBeNull();
  });

  it('has nowhere to send her from the top level', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [answer({ level: 3 }), answer({ level: 3 })]);
    expect(suggestNextLevel(a)).toBeNull();
  });

  it('ignores flashcards when judging the level', () => {
    const a = attempt('1', '2026-08-01T10:00:00Z', [
      answer({ level: 1 }),
      answer({ level: 2, type: 'flashcard', status: 'ungraded', earned: 0, max: 0 }),
    ]);
    expect(suggestNextLevel(a)).toBe(2);
  });
});

describe('band', () => {
  it('splits at 80 and 50 so praise and colours cannot disagree', () => {
    expect(band(0.9)).toBe('high');
    expect(band(0.8)).toBe('high');
    expect(band(0.79)).toBe('mid');
    expect(band(0.5)).toBe('mid');
    expect(band(0.49)).toBe('low');
    expect(band(0)).toBe('low');
  });
});

describe('deriveProgress', () => {
  const log = [
    attempt('1', '2026-08-24T10:00:00', [
      answer({ questionId: 'a' }),
      answer({ questionId: 'b', status: 'incorrect', earned: 0 }),
    ]),
  ];

  it('agrees with the individual derivations it replaces', () => {
    const now = new Date(2026, 7, 24, 12);
    const d = deriveProgress(log, now);

    expect(d.mastery).toEqual(computeMastery(log));
    expect(d.streak).toEqual(computeStreak(log, now));
    expect(d.stats).toEqual(overallStats(log));
    expect(d.weakIds).toEqual(weakQuestionIds(log));
    expect(d.srs).toEqual(replaySrs(log));
  });

  it('counts the cards due for review', () => {
    // The wrong answer replays as "again", so it is due the same day.
    expect(deriveProgress(log, new Date(2026, 7, 24, 12)).dueCount).toBeGreaterThan(0);
  });

  it('is empty but well-formed with no attempts', () => {
    const d = deriveProgress([]);
    expect(d.mastery).toEqual([]);
    expect(d.weakIds).toEqual([]);
    expect(d.stats.percent).toBe(0);
    expect(d.dueCount).toBe(0);
  });
});
