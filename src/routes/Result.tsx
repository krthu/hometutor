import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppState } from '@/state/AppState';
import { findPack, topicTitle } from '@/content/loader';
import { attemptScore, band, suggestNextLevel } from '@/engine/progress';
import { scoreOf } from '@/engine/score';
import { sv, formatDuration } from '@/i18n/sv';
import {
  Button,
  Card,
  EmptyState,
  LevelPill,
  ProgressBar,
  StatusChip,
  levelColor,
} from '@/components/ui';
import { QuestionRenderer, ExplanationPanel } from '@/components/questions/QuestionRenderer';

/** One colour per score band, so the big number and every bar below it agree. */
const BAND_COLOR = {
  high: 'var(--correct)',
  mid: 'var(--partial)',
  low: 'var(--wrong)',
} as const;

/**
 * The result screen, reachable both straight after a session and later from the
 * history list -- which is why it reads the attempt from the log by id rather
 * than taking it through router state.
 */
export function Result() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { packs, progress } = useAppState();
  const [reviewing, setReviewing] = useState(false);

  const attempt = progress.attempts.find((a) => a.id === attemptId);
  const pack = attempt ? findPack(packs, attempt.packId) : undefined;

  const byTopic = useMemo(() => {
    if (!attempt) return [];
    const groups = new Map<string, { earned: number; max: number }>();
    for (const a of attempt.answers) {
      if (a.max === 0) continue;
      const g = groups.get(a.topicId) ?? { earned: 0, max: 0 };
      g.earned += a.earned;
      g.max += a.max;
      groups.set(a.topicId, g);
    }
    return [...groups.entries()].map(([topicId, g]) => ({
      topicId,
      fraction: g.max > 0 ? g.earned / g.max : 0,
      ...g,
    }));
  }, [attempt]);

  // Question lookup as a Map: the review list renders every answer, and a linear
  // find per row is quadratic in pack size.
  const questionsById = useMemo(
    () => new Map(pack ? pack.questions.map((q) => [q.id, q]) : []),
    [pack],
  );

  if (!attempt || !pack) {
    return (
      <EmptyState
        title={sv.common.notFound}
        help={sv.common.notFoundHelp}
        action={<Button onClick={() => navigate('/')}>{sv.common.goHome}</Button>}
      />
    );
  }

  const score = attemptScore(attempt);
  const graded = attempt.answers.filter((a) => a.max > 0);
  const hasWrong = graded.some((a) => a.status !== 'correct');
  const duration =
    new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime();

  const levelsInAttempt = [...new Set(graded.map((a) => a.level))].sort();
  const nextLevel = suggestNextLevel(attempt);

  const overall = band(score.percent / 100);
  const praise = sv.result.praise[overall];
  const scoreColor = BAND_COLOR[overall];

  if (reviewing) {
    return (
      <>
        <button
          type="button"
          className="muted -ml-1 mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          onClick={() => setReviewing(false)}
        >
          ← {sv.result.title}
        </button>

        <div className="flex flex-col gap-4">
          {attempt.answers.map((a, i) => {
            const question = questionsById.get(a.questionId);
            if (!question) return null;

            return (
              <Card key={a.questionId} className="!p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="muted text-xs font-semibold tabular-nums">
                    {i + 1}/{attempt.answers.length}
                  </span>
                  <StatusChip status={a.status} />
                </div>

                <QuestionRenderer
                  question={question}
                  pack={pack}
                  response={null}
                  onChange={() => {}}
                  revealed
                  result={{
                    status: a.status,
                    earned: a.earned,
                    max: a.max,
                    fraction: a.max > 0 ? a.earned / a.max : 0,
                  }}
                  disabled
                />
                <ExplanationPanel question={question} />
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <Button full variant="secondary" onClick={() => setReviewing(false)}>
            {sv.nav.back}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <p className="muted text-sm font-semibold uppercase tracking-wide">{sv.result.title}</p>
        <p className="my-2 text-6xl font-bold tabular-nums" style={{ color: scoreColor }}>
          {score.percent}
          <span className="text-3xl"> %</span>
        </p>
        <p className="font-semibold">{praise}</p>
        <p className="muted mt-1 text-sm">
          {sv.result.score(score.earned, score.max)} · {formatDuration(duration)}
        </p>
        {nextLevel && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--bg-sunken)] px-3 py-1.5 text-sm">
            <LevelPill level={nextLevel} />
            {sv.result.nextLevelSuggestion(nextLevel)}
          </p>
        )}
      </div>

      {byTopic.length > 1 && (
        <Card className="mb-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">
            {sv.result.byTopic}
          </h2>
          <div className="flex flex-col gap-3">
            {byTopic.map((t) => (
              <ProgressBar
                key={t.topicId}
                value={t.fraction}
                label={topicTitle(pack, t.topicId)}
                color={BAND_COLOR[band(t.fraction)]}
              />
            ))}
          </div>
        </Card>
      )}

      {levelsInAttempt.length > 0 && (
        <Card className="mb-5">
          <div className="flex flex-wrap gap-2">
            {levelsInAttempt.map((l) => {
              const at = graded.filter((a) => a.level === l);
              return (
                <span
                  key={l}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
                  style={{ background: 'var(--bg-sunken)' }}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: levelColor(l) }}
                    aria-hidden
                  />
                  {sv.level[l]}:{' '}
                  <strong className="tabular-nums">{sv.result.percent(scoreOf(at).percent)}</strong>
                </span>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2.5">
        <Button full onClick={() => setReviewing(true)}>
          {sv.result.review}
        </Button>

        {hasWrong && (
          <Link to={`/kor/${pack.id}?mode=practice`}>
            <Button full variant="secondary">
              {sv.result.practiceWrong}
            </Button>
          </Link>
        )}

        <Link to={`/amne/${pack.id}`}>
          <Button full variant="ghost">
            {sv.result.backToSubject}
          </Button>
        </Link>
      </div>
    </>
  );
}
