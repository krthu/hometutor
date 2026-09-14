import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '@/state/AppState';
import { findPack, topicTitle } from '@/content/loader';
import { attemptScore } from '@/engine/progress';
import {
  applyImport,
  buildExport,
  exportFilename,
  parseExport,
  type ImportStrategy,
} from '@/storage/export';
import { sv, formatDate, percent } from '@/i18n/sv';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  LevelPill,
  PageTitle,
  ProgressBar,
  levelColor,
} from '@/components/ui';

/** How many past attempts the history list shows. */
const HISTORY_LIMIT = 20;

/** Trigger a file download from a string, with no server involved. */
function downloadJson(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ProgressScreen() {
  const { packs, progress, derived, importedPacks, applyProgress, setImportedPacks, resetProgress } =
    useAppState();
  const { mastery, streak, stats, dueCount } = derived;

  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const fileInput = useRef<HTMLInputElement>(null);

  // Newest first, and only as many as the list renders.
  const recentAttempts = useMemo(
    () => progress.attempts.slice(-HISTORY_LIMIT).reverse(),
    [progress.attempts],
  );

  const weakRows = useMemo(
    () => mastery.filter((m) => m.score < 0.6).sort((a, b) => a.score - b.score).slice(0, 5),
    [mastery],
  );

  const packTitle = (id: string) => findPack(packs, id)?.title ?? id;

  /** Download the full backup. Also the safety net before anything destructive. */
  function backupNow() {
    downloadJson(exportFilename(), JSON.stringify(buildExport(progress, importedPacks), null, 2));
  }

  function doExport() {
    backupNow();
    setMessage({ tone: 'success', text: sv.data.exportDone });
  }

  async function onFile(file: File) {
    const parsed = parseExport(await file.text());

    if (!parsed.ok) {
      setMessage({ tone: 'error', text: sv.data.errors[parsed.reason] });
      return;
    }

    // Replacing is destructive, so back up first and make her confirm.
    if (strategy === 'replace') {
      if (!confirm(sv.data.replaceConfirm)) return;
      backupNow();
    }

    const outcome = applyImport(progress, importedPacks, parsed.file, strategy);
    applyProgress(outcome.progress);
    await setImportedPacks(outcome.packs);

    const parts = [sv.data.importedSummary(outcome.stats.attemptsAdded, outcome.stats.attemptsAfter)];
    if (outcome.stats.packsAdded > 0) parts.push(sv.data.importedPacks(outcome.stats.packsAdded));
    setMessage({ tone: 'success', text: parts.join(' ') });
  }

  function doReset() {
    if (!confirm(sv.data.resetConfirm)) return;
    backupNow();
    resetProgress();
    setMessage({ tone: 'success', text: sv.data.resetDone });
  }

  return (
    <>
      <PageTitle>{sv.progress.title}</PageTitle>

      {stats.questionsAnswered === 0 ? (
        <div className="mb-8">
          <EmptyState title={sv.progress.empty} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={streak.current} label={sv.progress.streak} />
            <Stat value={streak.longest} label={sv.progress.longestStreak} />
            <Stat value={stats.questionsAnswered} label={sv.progress.totalAnswered} />
            <Stat value={sv.result.percent(stats.percent)} label={sv.progress.average} />
          </div>

          {dueCount > 0 && (
            <div className="mb-6">
              <Banner tone="info">{sv.progress.dueForReview(dueCount)}</Banner>
            </div>
          )}

          {mastery.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
                {sv.progress.mastery}
              </h2>
              <Card>
                <div className="flex flex-col gap-3.5">
                  {mastery.map((m) => {
                    const pack = findPack(packs, m.packId);
                    return (
                      <div key={`${m.packId}-${m.topicId}-${m.level}`}>
                        <div className="mb-1 flex items-center gap-2">
                          <LevelPill level={m.level} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {pack ? topicTitle(pack, m.topicId) : m.topicId}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {percent(m.score)}
                          </span>
                        </div>
                        <ProgressBar value={m.score} color={levelColor(m.level)} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          )}

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
              {sv.progress.weakSpots}
            </h2>
            {weakRows.length === 0 ? (
              <Card>
                <p className="muted text-sm">{sv.progress.noWeakSpots}</p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {weakRows.map((m) => {
                  const pack = findPack(packs, m.packId);
                  return (
                    <li key={`${m.packId}-${m.topicId}-${m.level}`}>
                      <Link
                        to={`/kor/${m.packId}?mode=practice&topic=${m.topicId}&level=${m.level}`}
                        className="block"
                      >
                        <Card className="flex items-center justify-between gap-3 transition active:scale-[0.99]">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {pack ? topicTitle(pack, m.topicId) : m.topicId}
                            </p>
                            <p className="muted text-sm">
                              {packTitle(m.packId)} · {sv.level[m.level]}
                            </p>
                          </div>
                          <span className="shrink-0 font-bold tabular-nums" style={{ color: 'var(--wrong)' }}>
                            {percent(m.score)}
                          </span>
                        </Card>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
              {sv.progress.history}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {recentAttempts.map((a) => {
                const s = attemptScore(a);
                return (
                  <li key={a.id}>
                    <Link to={`/resultat/${a.id}`} className="block">
                      <Card className="flex items-center justify-between gap-3 transition active:scale-[0.99]">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{packTitle(a.packId)}</p>
                          <p className="muted text-sm">
                            {formatDate(a.finishedAt)} · {a.answers.length} frågor
                          </p>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums">
                          {s.max > 0 ? `${s.percent} %` : '–'}
                        </span>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* --- Data --------------------------------------------------------- */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
          {sv.data.title}
        </h2>

        <Card>
          <p className="muted mb-4 text-sm leading-relaxed">{sv.data.explanation}</p>

          {message && (
            <div className="mb-4">
              <Banner tone={message.tone}>{message.text}</Banner>
            </div>
          )}

          <Button full onClick={doExport}>
            {sv.data.export}
          </Button>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">{sv.data.strategy}</p>
            <div className="flex flex-col gap-2">
              {(['merge', 'replace'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrategy(s)}
                  aria-pressed={strategy === s}
                  className="rounded-xl border-2 px-4 py-3 text-left transition"
                  style={{
                    borderColor: strategy === s ? 'var(--accent)' : 'var(--border)',
                    background: strategy === s ? 'var(--bg-sunken)' : 'transparent',
                  }}
                >
                  <span className="font-semibold">
                    {s === 'merge' ? sv.data.merge : sv.data.replace}
                  </span>
                  <span className="muted mt-0.5 block text-xs leading-snug">
                    {s === 'merge' ? sv.data.mergeHelp : sv.data.replaceHelp}
                  </span>
                </button>
              ))}
            </div>

            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = '';
              }}
            />
            <div className="mt-3">
              <Button full variant="secondary" onClick={() => fileInput.current?.click()}>
                {sv.data.import}
              </Button>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <Button full variant="danger" onClick={doReset}>
              {sv.data.reset}
            </Button>
          </div>
        </Card>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="muted mt-0.5 text-xs leading-tight">{label}</p>
    </Card>
  );
}
