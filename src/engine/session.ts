import { LEVELS, isGradable, type Level, type Pack, type Question } from '@/content/schema';
import { shuffle, seededRng, seedFrom, type Rng } from '@/engine/random';

/**
 * Choosing which questions appear in a practice run or a test.
 *
 * Pure selection: it takes a pool of questions and returns an ordered list. It
 * does not know about storage or React.
 */

export type SessionMode = 'practice' | 'test' | 'flashcards';

export interface SessionFilter {
  packId: string;
  /** Empty means all topics in the pack. */
  topicIds?: string[];
  /** Empty means all levels. */
  levels?: Level[];
  limit?: number;
}

export interface BuildOptions {
  mode: SessionMode;
  /** Questions she has recently got wrong. Practice puts these first. */
  weakQuestionIds?: readonly string[];
  /** Seed for reproducible ordering. A reload must not reshuffle a test in progress. */
  seed?: string;
}

export function filterQuestions(pack: Pack, filter: SessionFilter): Question[] {
  const topics = filter.topicIds?.length ? new Set(filter.topicIds) : null;
  const levels = filter.levels?.length ? new Set<number>(filter.levels) : null;

  return pack.questions.filter((q) => {
    if (topics && !topics.has(q.topicId)) return false;
    if (levels && !levels.has(q.level)) return false;
    return true;
  });
}

export function buildSession(
  pack: Pack,
  filter: SessionFilter,
  options: BuildOptions,
): Question[] {
  const rng: Rng = seededRng(seedFrom(options.seed ?? `${pack.id}:${Date.now()}`));

  let pool = filterQuestions(pack, filter);

  pool =
    options.mode === 'flashcards'
      ? pool.filter((q) => q.type === 'flashcard')
      : pool.filter(isGradable);

  let ordered = shuffle(pool, rng);

  // Practice leads with what she got wrong last time -- that is the whole point
  // of practising rather than taking another test.
  if (options.mode === 'practice' && options.weakQuestionIds?.length) {
    const weak = new Set(options.weakQuestionIds);
    const [weakOnes, rest] = ordered.reduce<[Question[], Question[]]>(
      (acc, q) => {
        acc[weak.has(q.id) ? 0 : 1].push(q);
        return acc;
      },
      [[], []],
    );
    ordered = [...weakOnes, ...rest];
  }

  return typeof filter.limit === 'number' ? ordered.slice(0, filter.limit) : ordered;
}

/** Resolve a curated quiz into its questions, in the order the author wrote them. */
export function buildQuizSession(pack: Pack, quizId: string): Question[] {
  const quiz = pack.quizzes.find((q) => q.id === quizId);
  if (!quiz) return [];

  const byId = new Map(pack.questions.map((q) => [q.id, q]));
  return quiz.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);
}

/**
 * Options in a stable but scrambled order.
 *
 * Seeded on the question id so the order is the same every time she sees that
 * question within a session, and does not jump around on re-render.
 */
export function shuffledOptions<T extends { id: string }>(
  questionId: string,
  options: readonly T[],
  enabled: boolean,
): T[] {
  if (!enabled) return options.slice();
  return shuffle(options, seededRng(seedFrom(questionId)));
}

export interface LevelStat {
  level: Level;
  total: number;
  gradable: number;
}

/** Question counts per level, for the level picker. */
export function levelStats(pack: Pack, topicIds?: string[]): LevelStat[] {
  const scoped = filterQuestions(pack, { packId: pack.id, topicIds });

  // One pass, tallying both counts per level, rather than six filters.
  const tally = new Map<Level, LevelStat>(
    LEVELS.map((level) => [level, { level, total: 0, gradable: 0 }]),
  );
  for (const q of scoped) {
    const row = tally.get(q.level);
    if (!row) continue;
    row.total++;
    if (isGradable(q)) row.gradable++;
  }
  return LEVELS.map((level) => tally.get(level)!);
}
