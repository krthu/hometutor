import type { Pack, Question } from '@/content/schema';
import type { GradeResult, Response } from '@/engine/score';
import { assetUrl } from '@/content/loader';
import { sv } from '@/i18n/sv';
import { LevelPill } from '@/components/ui';
import {
  McqQuestionView,
  MultiQuestionView,
  TrueFalseQuestionView,
} from './ChoiceQuestions';
import { ShortQuestionView, NumericQuestionView, ClozeQuestionView } from './TextQuestions';
import { FlashcardQuestionView } from './FlashcardQuestion';

/**
 * Dispatch to the right question component.
 *
 * A type with no component renders a visible notice rather than nothing: a
 * question silently vanishing from a test is the one failure mode worth being
 * loud about. In practice the content validator blocks reserved types from
 * shipping, so this is a backstop for imported packs.
 */

export function QuestionRenderer({
  question,
  pack,
  response,
  onChange,
  revealed,
  result,
  disabled,
  showLevel,
}: {
  question: Question;
  pack: Pack;
  response: Response | null;
  onChange: (r: Response) => void;
  revealed: boolean;
  result?: GradeResult;
  disabled?: boolean;
  showLevel?: boolean;
}) {
  const image = assetUrl(pack, question.assetId);

  // The cloze prompt contains the blanks, so it is rendered by the component.
  const promptInBody = question.type === 'cloze' || question.type === 'flashcard';

  const shared = { response, onChange, revealed, result, disabled };

  return (
    <div>
      {showLevel && (
        <div className="mb-3">
          <LevelPill level={question.level} />
        </div>
      )}

      {!promptInBody && (
        <h2 className="mb-4 text-xl leading-snug font-semibold">{question.prompt}</h2>
      )}

      {image && (
        <img
          src={image}
          alt=""
          className="mb-4 max-h-72 w-full rounded-xl border border-[var(--border)] object-contain"
        />
      )}

      {(() => {
        switch (question.type) {
          case 'mcq':
            return <McqQuestionView question={question} pack={pack} {...shared} />;
          case 'multi':
            return <MultiQuestionView question={question} pack={pack} {...shared} />;
          case 'truefalse':
            return <TrueFalseQuestionView question={question} {...shared} />;
          case 'short':
            return <ShortQuestionView question={question} {...shared} />;
          case 'numeric':
            return <NumericQuestionView question={question} {...shared} />;
          case 'cloze':
            return <ClozeQuestionView question={question} {...shared} />;
          case 'flashcard':
            return <FlashcardQuestionView question={question} {...shared} />;
          default:
            return (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--wrong-bg)' }}>
                {sv.question.unsupportedType((question as Question).type)}
              </div>
            );
        }
      })()}
    </div>
  );
}

/** The explanation panel, shown once an answer is revealed. */
export function ExplanationPanel({
  question,
  result,
}: {
  question: Question;
  result?: GradeResult;
}) {
  // Reserved types are a passthrough schema, so `explanation` is `unknown` there.
  const raw = (question as { explanation?: unknown }).explanation;
  const explanation = typeof raw === 'string' ? raw : undefined;
  if (!explanation) return null;

  return (
    <div className="mt-5 rounded-xl bg-[var(--bg-sunken)] px-4 py-3.5">
      {result?.acceptedWithTypo && (
        <p className="muted mb-2 text-xs font-semibold uppercase tracking-wide">
          {sv.session.typoAccepted}
        </p>
      )}
      <p className="muted mb-1 text-xs font-semibold uppercase tracking-wide">
        {sv.session.explanation}
      </p>
      <p className="text-sm leading-relaxed">{explanation}</p>
    </div>
  );
}
