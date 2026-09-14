import type { SelfRating } from '@/engine/score';

/**
 * Spaced repetition, an SM-2 variant.
 *
 * Used for two things: flashcards she rates herself, and graded questions she got
 * wrong, which are pushed back into the queue on a short interval.
 */

export interface SrsState {
  questionId: string;
  /** Multiplier for how fast intervals grow. Clamped to [MIN_EASE, MAX_EASE]. */
  ease: number;
  intervalDays: number;
  /** ISO date (YYYY-MM-DD) this card is next due. */
  due: string;
  /** Consecutive successful reviews. Reset to 0 on "again". */
  reps: number;
  /** How many times it has been forgotten after being learned. */
  lapses: number;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
const START_EASE = 2.5;

export function toIsoDate(d: Date): string {
  // Local calendar date, not UTC: "due today" should mean her today.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + Math.round(days));
  return toIsoDate(d);
}

export function newCard(questionId: string, now = new Date()): SrsState {
  return {
    questionId,
    ease: START_EASE,
    intervalDays: 0,
    due: toIsoDate(now),
    reps: 0,
    lapses: 0,
  };
}

const EASE_DELTA: Record<SelfRating, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

/**
 * Advance a card after a review.
 *
 * "again" sends it back to the start of the queue for the same day rather than
 * scheduling it for tomorrow -- if she could not recall it, seeing it again in
 * the same session is the point.
 */
export function review(state: SrsState, rating: SelfRating, now = new Date()): SrsState {
  const ease = Math.min(MAX_EASE, Math.max(MIN_EASE, state.ease + EASE_DELTA[rating]));

  if (rating === 'again') {
    return {
      ...state,
      ease,
      intervalDays: 0,
      due: toIsoDate(now),
      reps: 0,
      lapses: state.lapses + 1,
    };
  }

  let intervalDays: number;
  if (rating === 'hard') {
    intervalDays = state.intervalDays === 0 ? 1 : Math.max(1, state.intervalDays * 1.2);
  } else if (state.reps === 0) {
    intervalDays = rating === 'easy' ? 3 : 1;
  } else if (state.reps === 1) {
    intervalDays = rating === 'easy' ? 6 : 3;
  } else {
    intervalDays = state.intervalDays * ease * (rating === 'easy' ? 1.3 : 1);
  }

  intervalDays = Math.min(intervalDays, 365);

  return {
    ...state,
    ease,
    intervalDays,
    due: addDays(now, intervalDays),
    reps: state.reps + 1,
  };
}

/** Cards due today or earlier, most overdue first. */
export function dueCards(states: readonly SrsState[], now = new Date()): SrsState[] {
  const today = toIsoDate(now);
  return states.filter((s) => s.due <= today).sort((a, b) => a.due.localeCompare(b.due));
}

/** A card is "learned" once it has survived a few reviews and is scheduled well out. */
export function isLearned(state: SrsState): boolean {
  return state.reps >= 3 && state.intervalDays >= 7;
}
