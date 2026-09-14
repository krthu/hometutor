import { useEffect, useState } from 'react';
import type { FlashcardQuestion } from '@/content/schema';
import type { SelfRating } from '@/engine/score';
import { sv } from '@/i18n/sv';
import type { QuestionProps } from './types';

/**
 * Flashcards.
 *
 * She sees the front, tries to recall the answer, flips, then rates herself. The
 * rating drives the spaced-repetition schedule but never a score -- self-rated
 * cards are excluded from every total, so honesty costs her nothing.
 */

const RATINGS: { key: SelfRating; color: string }[] = [
  { key: 'again', color: 'var(--wrong)' },
  { key: 'hard', color: 'var(--partial)' },
  { key: 'good', color: 'var(--correct)' },
  { key: 'easy', color: 'var(--accent)' },
];

export function FlashcardQuestionView({
  question,
  response,
  onChange,
  disabled,
}: QuestionProps<FlashcardQuestion>) {
  const [flipped, setFlipped] = useState(false);

  // A new card must start face down, or she would see the answer before thinking.
  useEffect(() => setFlipped(false), [question.id]);

  const chosen = response?.type === 'flashcard' ? response.rating : null;

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.flashcardHelp}</p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="surface flex min-h-44 w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center transition active:scale-[0.99]"
        aria-expanded={flipped}
      >
        <span className="text-xl font-semibold">{question.prompt}</span>
        {flipped ? (
          <span className="border-t border-[var(--border)] pt-3 text-base leading-relaxed">
            {question.back}
          </span>
        ) : (
          <span className="muted text-sm">{sv.question.flip}</span>
        )}
      </button>

      {flipped && (
        <div className="mt-5">
          <p className="muted mb-2 text-sm">{sv.question.rate}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {RATINGS.map(({ key, color }) => {
              const selected = chosen === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onChange({ type: 'flashcard', rating: key })}
                  className="min-h-14 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition active:scale-[0.98]"
                  style={{
                    borderColor: color,
                    background: selected ? color : 'transparent',
                    color: selected ? 'oklch(0.2 0.02 265)' : 'var(--text)',
                  }}
                >
                  {sv.question.rating[key]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
