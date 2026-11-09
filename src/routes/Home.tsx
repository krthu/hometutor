import { Link } from 'react-router-dom';
import { useAppState } from '@/state/AppState';
import { bySubject, findPack } from '@/content/loader';
import { sv } from '@/i18n/sv';
import { Card, EmptyState, PageTitle, ProgressBar, buttonClasses, levelColor } from '@/components/ui';
import type { Pack } from '@/content/schema';
import type { DerivedProgress } from '@/engine/progress';

/** Average mastery across every level of a pack, for the card's progress bar. */
function packMastery(mastery: DerivedProgress['mastery'], pack: Pack): number | null {
  const rows = mastery.filter((m) => m.packId === pack.id);
  if (rows.length === 0) return null;
  return rows.reduce((n, m) => n + m.score, 0) / rows.length;
}

export function Home() {
  const { packs, progress, derived } = useAppState();
  const { mastery, streak, dueCount } = derived;
  const groups = bySubject(packs);

  const lastAttempt = progress.attempts[progress.attempts.length - 1];
  const lastPack = lastAttempt ? findPack(packs, lastAttempt.packId) : undefined;

  if (packs.length === 0) {
    // The deployed build ships empty on purpose, so this is the first thing she
    // sees on a new device. Without this button there is no way to reach import
    // and no way to get any content at all.
    return (
      <>
        <PageTitle>{sv.appName}</PageTitle>
        <EmptyState
          title={sv.home.noContent}
          help={sv.home.noContentHelp}
          action={
            <Link to="/import" className={buttonClasses()}>
              {sv.home.noContentAction}
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageTitle sub={sv.tagline}>{sv.home.greeting}</PageTitle>

      {(streak.current > 0 || dueCount > 0) && (
        <div className="mb-5 flex gap-3">
          {streak.current > 0 && (
            <Card className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">{streak.current}</p>
              <p className="muted text-xs">{sv.progress.streak}</p>
            </Card>
          )}
          {dueCount > 0 && (
            <Card className="flex-1 text-center">
              <p className="text-3xl font-bold tabular-nums">{dueCount}</p>
              <p className="muted text-xs">{sv.progress.dueForReview(dueCount)}</p>
            </Card>
          )}
        </div>
      )}

      {lastPack && (
        <Link to={`/amne/${lastPack.id}`} className="mb-6 block">
          <Card className="transition active:scale-[0.99]">
            <p className="muted text-xs font-semibold uppercase tracking-wide">
              {sv.home.continue}
            </p>
            <p className="mt-1 font-semibold">{lastPack.title}</p>
            <p className="muted text-sm">{lastPack.subject}</p>
          </Card>
        </Link>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">
        {sv.home.subjects}
      </h2>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.subject}>
            <h3 className="mb-2 font-bold">{group.subject}</h3>
            <ul className="flex flex-col gap-2.5">
              {group.packs.map((pack) => {
                const m = packMastery(mastery, pack);
                return (
                  <li key={pack.id}>
                    <Link to={`/amne/${pack.id}`} className="block">
                      <Card className="transition active:scale-[0.99]">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="font-semibold">{pack.title}</p>
                          {pack.grade && <span className="muted shrink-0 text-xs">{pack.grade}</span>}
                        </div>
                        <p className="muted mt-0.5 text-sm">
                          {sv.home.questionCount(pack.questions.length)} ·{' '}
                          {sv.home.topicCount(pack.topics.length)}
                        </p>

                        {m !== null && (
                          <div className="mt-3">
                            <ProgressBar
                              value={m}
                              label={sv.progress.mastery}
                              color={levelColor(1)}
                            />
                          </div>
                        )}
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <Link to="/import" className={buttonClasses('secondary', true, 'mt-6')}>
        {sv.home.addSubject}
      </Link>
    </>
  );
}
