import type { ReactNode } from 'react';
import type { McqQuestion, MultiQuestion, TrueFalseQuestion, Pack } from '@/content/schema';
import { useMemo } from 'react';
import { shuffledOptions } from '@/engine/session';
import { assetUrl } from '@/content/loader';
import { sv } from '@/i18n/sv';
import type { QuestionProps } from './types';

/**
 * Choice-based questions: single choice, multiple choice and true/false.
 *
 * They share one option button. Everything is a full-width tap target -- no
 * small radio dots, which are miserable on a phone.
 */

type Marking = 'none' | 'correct' | 'wrong' | 'missed';

function markingStyle(marking: Marking, selected: boolean) {
  switch (marking) {
    case 'correct':
      return { borderColor: 'var(--correct)', background: 'var(--correct-bg)' };
    case 'wrong':
      return { borderColor: 'var(--wrong)', background: 'var(--wrong-bg)' };
    case 'missed':
      // A correct option she did not pick: outlined, not filled, so it reads as
      // "this was also right" rather than "you got this right".
      return { borderColor: 'var(--correct)', background: 'transparent' };
    default:
      return selected
        ? { borderColor: 'var(--accent)', background: 'var(--bg-sunken)' }
        : { borderColor: 'var(--border)', background: 'var(--bg-raised)' };
  }
}

/**
 * How to mark one option once the answer is revealed.
 *
 * "missed" is a correct option she did not pick -- distinct from "wrong", which
 * is one she picked and should not have.
 */
function markOf(revealed: boolean, isCorrect: boolean, selected: boolean): Marking {
  if (!revealed) return 'none';
  if (isCorrect) return selected ? 'correct' : 'missed';
  return selected ? 'wrong' : 'none';
}

function MarkIcon({ marking }: { marking: Marking }) {
  if (marking === 'correct') return <span aria-hidden style={{ color: 'var(--correct)' }}>✓</span>;
  if (marking === 'wrong') return <span aria-hidden style={{ color: 'var(--wrong)' }}>✕</span>;
  if (marking === 'missed') return <span aria-hidden style={{ color: 'var(--correct)' }}>○</span>;
  return null;
}

function OptionButton({
  children,
  selected,
  marking,
  disabled,
  multi,
  onClick,
  imageUrl,
}: {
  children: ReactNode;
  selected: boolean;
  marking: Marking;
  disabled?: boolean;
  multi?: boolean;
  onClick: () => void;
  imageUrl?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left leading-snug transition active:scale-[0.99] disabled:active:scale-100"
      style={markingStyle(marking, selected)}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid size-5 shrink-0 place-items-center border-2 text-xs ${multi ? 'rounded' : 'rounded-full'}`}
        style={{
          borderColor: selected ? 'var(--accent)' : 'var(--border)',
          background: selected ? 'var(--accent)' : 'transparent',
          color: 'var(--accent-text)',
        }}
      >
        {selected ? (multi ? '✓' : '●') : ''}
      </span>

      <span className="min-w-0 flex-1">
        {imageUrl && (
          <img src={imageUrl} alt="" className="mb-2 max-h-48 w-full rounded-lg object-contain" />
        )}
        {children}
      </span>

      <MarkIcon marking={marking} />
    </button>
  );
}

export function McqQuestionView({
  question,
  response,
  onChange,
  revealed,
  disabled,
  pack,
}: QuestionProps<McqQuestion> & { pack: Pack }) {
  const options = useMemo(
    () => shuffledOptions(question.id, question.options, question.shuffle),
    [question.id, question.options, question.shuffle],
  );
  const chosen = response?.type === 'mcq' ? response.optionId : null;

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.mcqHelp}</p>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const selected = chosen === o.id;
          return (
            <OptionButton
              key={o.id}
              selected={selected}
              marking={markOf(revealed, o.id === question.answer, selected)}
              disabled={disabled}
              imageUrl={assetUrl(pack, o.assetId)}
              onClick={() => onChange({ type: 'mcq', optionId: o.id })}
            >
              {o.text}
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

export function MultiQuestionView({
  question,
  response,
  onChange,
  revealed,
  disabled,
  pack,
}: QuestionProps<MultiQuestion> & { pack: Pack }) {
  const options = useMemo(
    () => shuffledOptions(question.id, question.options, question.shuffle),
    [question.id, question.options, question.shuffle],
  );
  const chosen = new Set(response?.type === 'multi' ? response.optionIds : []);
  const correct = new Set(question.answers);

  function toggle(id: string) {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ type: 'multi', optionIds: [...next] });
  }

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.multiHelp}</p>
      <div className="flex flex-col gap-2.5">
        {options.map((o) => {
          const selected = chosen.has(o.id);
          return (
            <OptionButton
              key={o.id}
              multi
              selected={selected}
              marking={markOf(revealed, correct.has(o.id), selected)}
              disabled={disabled}
              imageUrl={assetUrl(pack, o.assetId)}
              onClick={() => toggle(o.id)}
            >
              {o.text}
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

export function TrueFalseQuestionView({
  question,
  response,
  onChange,
  revealed,
  disabled,
}: QuestionProps<TrueFalseQuestion>) {
  const chosen = response?.type === 'truefalse' ? response.value : null;

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.truefalseHelp}</p>
      <div className="grid grid-cols-2 gap-3">
        {([true, false] as const).map((value) => {
          const selected = chosen === value;
          const marking = markOf(revealed, value === question.answer, selected);
          return (
            <button
              key={String(value)}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange({ type: 'truefalse', value })}
              className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-4 text-lg font-bold transition active:scale-[0.98] disabled:active:scale-100"
              style={markingStyle(marking, selected)}
            >
              <span aria-hidden className="text-2xl">
                {value ? '✓' : '✕'}
              </span>
              {value ? sv.question.true : sv.question.false}
            </button>
          );
        })}
      </div>
    </div>
  );
}
