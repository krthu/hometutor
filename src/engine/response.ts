import type { Question } from '@/content/schema';
import type { Response } from '@/engine/score';

/** A blank response of the right shape for a question, so components never see null-of-wrong-type. */
export function emptyResponse(question: Question): Response | null {
  switch (question.type) {
    case 'mcq':
      return { type: 'mcq', optionId: null };
    case 'multi':
      return { type: 'multi', optionIds: [] };
    case 'truefalse':
      return { type: 'truefalse', value: null };
    case 'short':
      return { type: 'short', text: '' };
    case 'numeric':
      return { type: 'numeric', text: '' };
    case 'cloze':
      return { type: 'cloze', values: {} };
    // Flashcards and reserved types have nothing to pre-fill: a flashcard has no
    // answer until she rates it, and a reserved type has no component at all.
    default:
      return null;
  }
}

/**
 * Whether the answer is complete enough to check.
 *
 * Deliberately not the same as "non-blank": a cloze with three blanks and one
 * filled in is answered, and she is allowed to submit it and get partial credit.
 * This only gates the Rätta button on having done *something*.
 */
export function canSubmit(response: Response | null): boolean {
  if (!response) return false;
  switch (response.type) {
    case 'mcq':
      return response.optionId !== null;
    case 'multi':
      return response.optionIds.length > 0;
    case 'truefalse':
      return response.value !== null;
    case 'short':
    case 'numeric':
      return response.text.trim().length > 0;
    case 'cloze':
      return Object.values(response.values).some((v) => v.trim().length > 0);
    case 'flashcard':
      return true;
  }
}
