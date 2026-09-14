import type { Question } from '@/content/schema';
import type { GradeResult, Response } from '@/engine/score';

/**
 * Every question component takes the same shape.
 *
 * `revealed` is the key piece of state: in practice it flips to true after she
 * presses Rätta, in a test it stays false until the whole test is submitted, and
 * on the review screen it starts true. The components themselves do not know
 * which mode they are in.
 */
export interface QuestionProps<Q extends Question = Question> {
  question: Q;
  /** The broad union; each component narrows to its own variant by checking `response.type`. */
  response: Response | null;
  onChange: (response: Response) => void;
  /** Show right/wrong marking. */
  revealed: boolean;
  result?: GradeResult;
  /** Locked after checking, or during review. */
  disabled?: boolean;
}
