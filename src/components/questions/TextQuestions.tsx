import { Fragment, useMemo } from 'react';
import type { ShortQuestion, NumericQuestion, ClozeQuestion } from '@/content/schema';
import { CLOZE_BLANK_RE } from '@/content/schema';
import { sv } from '@/i18n/sv';
import type { QuestionProps } from './types';

/**
 * Free-text questions: short answer, numeric and cloze.
 *
 * Marking is shown on the field itself rather than in a separate message, so the
 * eye does not have to travel to find out whether the answer was right.
 */

function fieldStyle(revealed: boolean, correct: boolean | undefined) {
  if (!revealed || correct === undefined) {
    return { borderColor: 'var(--border)', background: 'var(--bg-raised)' };
  }
  return correct
    ? { borderColor: 'var(--correct)', background: 'var(--correct-bg)' }
    : { borderColor: 'var(--wrong)', background: 'var(--wrong-bg)' };
}

const fieldClass =
  'w-full rounded-xl border-2 px-4 py-3 text-lg outline-none transition placeholder:text-[var(--text-muted)] disabled:opacity-100';

export function ShortQuestionView({
  question,
  response,
  onChange,
  revealed,
  result,
  disabled,
}: QuestionProps<ShortQuestion>) {
  const correct = revealed ? result?.status === 'correct' : undefined;
  const text = response?.type === 'short' ? response.text : '';

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.shortHelp}</p>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        className={fieldClass}
        style={fieldStyle(revealed, correct)}
        placeholder={question.placeholder ?? ''}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange({ type: 'short', text: e.target.value })}
        aria-label={sv.question.shortHelp}
      />
      {revealed && !correct && (
        <p className="mt-2 text-sm">
          <span className="muted">{sv.session.correctAnswer}: </span>
          <strong>{question.accept[0]}</strong>
        </p>
      )}
    </div>
  );
}

export function NumericQuestionView({
  question,
  response,
  onChange,
  revealed,
  result,
  disabled,
}: QuestionProps<NumericQuestion>) {
  const correct = revealed ? result?.status === 'correct' : undefined;
  const text = response?.type === 'numeric' ? response.text : '';

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.numericHelp}</p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          // "decimal" rather than "numeric": she needs the comma for 1,5, and it
          // still brings up the number pad on a phone.
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          className={fieldClass}
          style={fieldStyle(revealed, correct)}
          value={text}
          disabled={disabled}
          onChange={(e) => onChange({ type: 'numeric', text: e.target.value })}
          aria-label={sv.question.numericHelp}
        />
        {question.unit && <span className="muted shrink-0 text-lg">{question.unit}</span>}
      </div>
      {revealed && !correct && (
        <p className="mt-2 text-sm">
          <span className="muted">{sv.session.correctAnswer}: </span>
          <strong>
            {question.answer}
            {question.unit ? ` ${question.unit}` : ''}
          </strong>
        </p>
      )}
    </div>
  );
}

interface ClozeSegment {
  text: string;
  blankId?: string;
}

/** Split "Den 1 september {{ar}} anföll..." into text and blank segments. */
function splitCloze(prompt: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let lastIndex = 0;

  for (const match of prompt.matchAll(CLOZE_BLANK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: prompt.slice(lastIndex, index) });
    segments.push({ text: '', blankId: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < prompt.length) segments.push({ text: prompt.slice(lastIndex) });

  return segments;
}

export function ClozeQuestionView({
  question,
  response,
  onChange,
  revealed,
  result,
  disabled,
}: QuestionProps<ClozeQuestion>) {
  const segments = useMemo(() => splitCloze(question.prompt), [question.prompt]);
  const values = response?.type === 'cloze' ? response.values : {};

  function setBlank(id: string, value: string) {
    onChange({ type: 'cloze', values: { ...values, [id]: value } });
  }

  function markingFor(blankId: string): boolean | undefined {
    if (!revealed) return undefined;
    return result?.parts?.find((p) => p.id === blankId)?.correct;
  }

  return (
    <div>
      <p className="muted mb-3 text-sm">{sv.question.clozeHelp}</p>

      {/* The sentence itself is the input. Inline fields keep the context visible. */}
      <p className="text-lg leading-loose">
        {segments.map((seg, i) => {
          if (!seg.blankId) return <Fragment key={i}>{seg.text}</Fragment>;

          const blank = question.blanks.find((b) => b.id === seg.blankId);
          if (!blank) return null;

          // Number by position among the blanks, not among the segments: the
          // text between two blanks is a segment too, so the segment index would
          // label a two-blank sentence "Lucka 2" and "Lucka 4".
          const blankNumber = question.blanks.indexOf(blank) + 1;

          const correct = markingFor(seg.blankId);
          const style = fieldStyle(revealed, correct);
          const shared =
            'mx-1 inline-block min-h-11 rounded-lg border-2 px-3 py-1 align-middle text-base outline-none';

          return blank.options ? (
            <select
              key={i}
              className={`${shared} max-w-[14rem]`}
              style={style}
              value={values[seg.blankId] ?? ''}
              disabled={disabled}
              onChange={(e) => setBlank(blank.id, e.target.value)}
              aria-label={sv.question.blankLabel(blankNumber)}
            >
              <option value="">{sv.question.selectPlaceholder}</option>
              {blank.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={i}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              // Roughly as wide as the expected answer, so the blank hints at
              // length without giving the answer away letter by letter.
              size={Math.max(6, Math.min(18, blank.accept[0].length + 2))}
              className={shared}
              style={style}
              value={values[seg.blankId] ?? ''}
              disabled={disabled}
              onChange={(e) => setBlank(blank.id, e.target.value)}
              aria-label={sv.question.blankLabel(blankNumber)}
            />
          );
        })}
      </p>

      {revealed && result?.parts?.some((p) => !p.correct) && (
        <div className="mt-3 text-sm">
          <span className="muted">{sv.session.correctAnswer}: </span>
          {result.parts
            .filter((p) => !p.correct)
            .map((p, i, arr) => (
              <Fragment key={p.id}>
                <strong>{p.expected}</strong>
                {i < arr.length - 1 ? ', ' : ''}
              </Fragment>
            ))}
        </div>
      )}
    </div>
  );
}
