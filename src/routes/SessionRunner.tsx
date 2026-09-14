import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Level, Question } from '@/content/schema';
import { grade, type GradeResult, type Response } from '@/engine/score';
import { emptyResponse, canSubmit } from '@/engine/response';
import { buildSession, buildQuizSession, type SessionMode } from '@/engine/session';
import type { Attempt, AnswerRecord } from '@/engine/progress';
import { newAttemptId } from '@/storage/progress';
import { useAppState } from '@/state/AppState';
import { findPack } from '@/content/loader';
import { sv, formatClock } from '@/i18n/sv';
import { Button, ProgressBar, EmptyState, Banner } from '@/components/ui';
import { QuestionRenderer, ExplanationPanel } from '@/components/questions/QuestionRenderer';

/**
 * Runs a practice run, a test or a flashcard session.
 *
 * The three modes differ in exactly two ways, so they share one component rather
 * than being three near-copies:
 *
 *   practice  - check each answer immediately, see the explanation, then move on
 *   test      - answer everything first, no feedback until submitted
 *   flashcards- self-rated, no score
 *
 * Everything else (navigation, timing, saving the attempt) is identical.
 */

function useCountdown(limitMinutes: number | undefined, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    limitMinutes ? Math.round(limitMinutes * 60) : 0,
  );
  const expired = useRef(false);

  useEffect(() => {
    if (!limitMinutes) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1 && !expired.current) {
          expired.current = true;
          // Defer out of the tick so we are not setting state during render.
          setTimeout(onExpire, 0);
          return 0;
        }
        return Math.max(0, s - 1);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [limitMinutes, onExpire]);

  return limitMinutes ? secondsLeft : null;
}

export function SessionRunner() {
  const { packId } = useParams<{ packId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { packs, derived, saveAttempt } = useAppState();

  const mode = (params.get('mode') ?? 'practice') as SessionMode;
  const quizId = params.get('quiz') ?? undefined;
  const levels = params.getAll('level').map(Number).filter(Boolean) as Level[];
  const topicIds = params.getAll('topic');
  const limitParam = params.get('limit');

  const pack = packId ? findPack(packs, packId) : undefined;

  // Seed once per mount so a re-render never reshuffles a session in progress.
  const seed = useRef(`${packId}:${mode}:${quizId ?? ''}:${Date.now()}`).current;

  const questions: Question[] = useMemo(() => {
    if (!pack) return [];
    if (quizId) return buildQuizSession(pack, quizId);
    return buildSession(
      pack,
      {
        packId: pack.id,
        topicIds,
        levels,
        limit: limitParam ? Number(limitParam) : undefined,
      },
      { mode, seed, weakQuestionIds: derived.weakIds },
    );
    // `params.toString()` stands in for the individual search params, which are
    // fresh arrays on every render and would defeat the memo.
  }, [pack, quizId, mode, seed, params.toString()]);

  const quiz = quizId ? pack?.quizzes.find((q) => q.id === quizId) : undefined;

  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Response | null>>({});
  const [checked, setChecked] = useState<Record<string, GradeResult>>({});
  const [showHint, setShowHint] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const startedAt = useRef(new Date().toISOString());
  const questionStart = useRef(Date.now());
  const timings = useRef<Record<string, number>>({});
  const finished = useRef(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;
  const isTest = mode === 'test';

  const response = current ? (responses[current.id] ?? emptyResponse(current)) : null;
  const result = current ? checked[current.id] : undefined;
  const revealed = Boolean(result);

  const recordTime = useCallback(() => {
    if (!current) return;
    timings.current[current.id] =
      (timings.current[current.id] ?? 0) + (Date.now() - questionStart.current);
    questionStart.current = Date.now();
  }, [current]);

  /** Build and persist the attempt, then go to the result screen. */
  const finish = useCallback(() => {
    if (finished.current || !pack) return;
    finished.current = true;
    recordTime();

    const answers: AnswerRecord[] = questions.map((q) => {
      const g = checked[q.id] ?? grade(q, responses[q.id] ?? null);
      return {
        questionId: q.id,
        packId: pack.id,
        topicId: q.topicId,
        level: q.level,
        type: q.type,
        status: g.status,
        earned: g.earned,
        max: g.max,
        // grade() echoes the self-rating back, so the record has one source.
        rating: g.rating,
        ms: timings.current[q.id],
      };
    });

    const attempt: Attempt = {
      id: newAttemptId(),
      packId: pack.id,
      mode,
      quizId,
      startedAt: startedAt.current,
      finishedAt: new Date().toISOString(),
      answers,
    };

    saveAttempt(attempt);
    navigate(`/resultat/${attempt.id}`, { replace: true });
  }, [pack, questions, responses, checked, mode, quizId, saveAttempt, navigate, recordTime]);

  const secondsLeft = useCountdown(isTest ? quiz?.timeLimitMinutes : undefined, finish);

  if (!pack) {
    return (
      <EmptyState
        title={sv.common.notFound}
        help={sv.common.notFoundHelp}
        action={<Button onClick={() => navigate('/')}>{sv.common.goHome}</Button>}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        title={sv.subject.noQuestionsHere}
        action={<Button onClick={() => navigate(`/amne/${pack.id}`)}>{sv.nav.back}</Button>}
      />
    );
  }

  function setResponse(r: Response) {
    if (!current) return;
    setResponses((prev) => ({ ...prev, [current.id]: r }));
  }

  function check() {
    if (!current) return;
    recordTime();
    setChecked((prev) => ({ ...prev, [current.id]: grade(current, responses[current.id] ?? null) }));
  }

  function goNext() {
    recordTime();
    setShowHint(false);
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }

  function goPrev() {
    recordTime();
    setShowHint(false);
    setIndex((i) => Math.max(0, i - 1));
  }

  // Only read when submitting, but a timed test re-renders every second.
  const unanswered = useMemo(
    () => questions.filter((q) => !canSubmit(responses[q.id] ?? null)).length,
    [questions, responses],
  );

  function attemptSubmit() {
    if (unanswered > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    finish();
  }

  const canCheck = canSubmit(response);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Progress header */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            className="muted min-h-11 font-medium"
            onClick={() => {
              if (confirm(sv.session.exitConfirm)) navigate(`/amne/${pack.id}`);
            }}
          >
            ← {sv.session.exit}
          </button>

          <span className="muted tabular-nums">
            {sv.session.question(index + 1, questions.length)}
          </span>

          {secondsLeft !== null && (
            <span
              className="font-bold tabular-nums"
              style={{ color: secondsLeft <= 60 ? 'var(--wrong)' : 'var(--text)' }}
              aria-label={sv.session.timeLeft}
            >
              {formatClock(secondsLeft)}
            </span>
          )}
        </div>
        <ProgressBar value={(index + (revealed ? 1 : 0)) / questions.length} />
      </div>

      {/* The question */}
      <div className="flex-1">
        <QuestionRenderer
          question={current}
          pack={pack}
          response={response}
          onChange={setResponse}
          revealed={revealed}
          result={result}
          disabled={revealed}
          showLevel={!quizId}
        />

        {'hint' in current && current.hint && !revealed && (
          <div className="mt-4">
            {showHint ? (
              <p className="rounded-xl bg-[var(--bg-sunken)] px-4 py-3 text-sm">
                <span className="muted font-semibold">{sv.session.hint}: </span>
                {current.hint}
              </p>
            ) : (
              <Button variant="ghost" onClick={() => setShowHint(true)}>
                {sv.session.showHint}
              </Button>
            )}
          </div>
        )}

        {revealed && <ExplanationPanel question={current} result={result} />}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-[var(--border)] bg-[var(--bg)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {confirmSubmit && (
          <div className="mb-3">
            <Banner tone="warn">{sv.session.unansweredWarning(unanswered)}</Banner>
          </div>
        )}

        {isTest ? (
          <div className="flex gap-2.5">
            {index > 0 && (
              <Button variant="secondary" onClick={goPrev}>
                ←
              </Button>
            )}
            {isLast ? (
              <Button full onClick={attemptSubmit}>
                {confirmSubmit ? sv.session.submitAnyway : sv.session.submitTest}
              </Button>
            ) : (
              <Button full onClick={goNext}>
                {sv.session.next}
              </Button>
            )}
          </div>
        ) : mode === 'flashcards' ? (
          <Button full onClick={goNext} disabled={!canCheck}>
            {isLast ? sv.session.finish : sv.session.next}
          </Button>
        ) : revealed ? (
          <Button full onClick={goNext}>
            {isLast ? sv.session.finish : sv.session.next}
          </Button>
        ) : (
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={goNext}>
              {sv.session.skip}
            </Button>
            <Button full onClick={check} disabled={!canCheck}>
              {sv.session.check}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
