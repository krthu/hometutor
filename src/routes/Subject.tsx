import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isGradable, type Level } from '@/content/schema';
import { useAppState } from '@/state/AppState';
import { findPack } from '@/content/loader';
import { levelStats, filterQuestions } from '@/engine/session';
import { sv } from '@/i18n/sv';
import {
  BackLink,
  Button,
  Card,
  EmptyState,
  LevelPill,
  PageTitle,
  ProgressBar,
  levelColor,
} from '@/components/ui';

/**
 * Pick what to practise: topics, then level, then how.
 *
 * Topic and level are filters rather than separate screens, so she can see the
 * question count update as she narrows it down and never lands on an empty run.
 */
export function Subject() {
  const { packId } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const { packs, derived } = useAppState();
  const { mastery } = derived;

  const pack = packId ? findPack(packs, packId) : undefined;

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [level, setLevel] = useState<Level | null>(null);

  const stats = useMemo(
    () => (pack ? levelStats(pack, selectedTopics) : []),
    [pack, selectedTopics],
  );

  const matching = useMemo(() => {
    if (!pack) return [];
    return filterQuestions(pack, {
      packId: pack.id,
      topicIds: selectedTopics,
      levels: level ? [level] : undefined,
    });
  }, [pack, selectedTopics, level]);

  if (!pack) {
    return (
      <EmptyState
        title={sv.common.notFound}
        help={sv.common.notFoundHelp}
        action={<Button onClick={() => navigate('/')}>{sv.common.goHome}</Button>}
      />
    );
  }

  const gradable = matching.filter(isGradable);
  const flashcards = matching.filter((q) => q.type === 'flashcard');

  function toggleTopic(id: string) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  function query(mode: string): string {
    const p = new URLSearchParams();
    p.set('mode', mode);
    for (const t of selectedTopics) p.append('topic', t);
    if (level) p.append('level', String(level));
    return p.toString();
  }

  const masteryFor = (topicId: string, lvl: Level) =>
    mastery.find((m) => m.packId === pack.id && m.topicId === topicId && m.level === lvl);

  return (
    <>
      <BackLink to="/" label={sv.nav.home} />
      <PageTitle sub={`${pack.subject}${pack.grade ? ` · ${pack.grade}` : ''}`}>
        {pack.title}
      </PageTitle>

      {pack.description && <p className="muted mb-6 text-sm">{pack.description}</p>}

      {/* Topics */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
          {sv.subject.chooseTopics}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTopics([])}
            aria-pressed={selectedTopics.length === 0}
            className="rounded-full border-2 px-4 py-2 text-sm font-semibold transition"
            style={
              selectedTopics.length === 0
                ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--accent-text)' }
                : { borderColor: 'var(--border)' }
            }
          >
            {sv.subject.allTopics}
          </button>
          {pack.topics.map((t) => {
            const on = selectedTopics.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTopic(t.id)}
                aria-pressed={on}
                className="rounded-full border-2 px-4 py-2 text-sm font-semibold transition"
                style={
                  on
                    ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: 'var(--accent-text)' }
                    : { borderColor: 'var(--border)' }
                }
              >
                {t.title}
              </button>
            );
          })}
        </div>
      </section>

      {/* Levels */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
          {sv.subject.chooseLevel}
        </h2>
        <div className="flex flex-col gap-2.5">
          {stats.map((s) => {
            const on = level === s.level;
            const rows = selectedTopics.length
              ? selectedTopics.map((t) => masteryFor(t, s.level)).filter(Boolean)
              : mastery.filter((m) => m.packId === pack.id && m.level === s.level);
            const avg = rows.length
              ? rows.reduce((n, m) => n + (m?.score ?? 0), 0) / rows.length
              : null;

            return (
              <button
                key={s.level}
                type="button"
                disabled={s.total === 0}
                aria-pressed={on}
                onClick={() => setLevel(on ? null : s.level)}
                className="rounded-xl border-2 px-4 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-40"
                style={{
                  borderColor: on ? levelColor(s.level) : 'var(--border)',
                  background: on ? 'var(--bg-sunken)' : 'var(--bg-raised)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <LevelPill level={s.level} />
                    <span className="font-semibold">{sv.level.name[s.level]}</span>
                  </div>
                  <span className="muted shrink-0 text-sm tabular-nums">{s.total}</span>
                </div>
                <p className="muted mt-1 text-sm">{sv.level.description[s.level]}</p>
                {avg !== null && (
                  <div className="mt-2.5">
                    <ProgressBar value={avg} color={levelColor(s.level)} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section className="mb-6">
        <p className="muted mb-2 text-sm">
          {gradable.length > 0
            ? sv.subject.readyQuestions(gradable.length)
            : sv.subject.noQuestionsHere}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <ActionCard
            title={sv.subject.practice}
            help={sv.subject.practiceHelp}
            disabled={gradable.length === 0}
            onClick={() => navigate(`/kor/${pack.id}?${query('practice')}`)}
          />
          <ActionCard
            title={sv.subject.test}
            help={sv.subject.testHelp}
            disabled={gradable.length === 0}
            onClick={() => navigate(`/kor/${pack.id}?${query('test')}`)}
          />
          <ActionCard
            title={sv.subject.flashcards}
            help={sv.subject.flashcardsHelp}
            disabled={flashcards.length === 0}
            onClick={() => navigate(`/kor/${pack.id}?${query('flashcards')}`)}
          />
          <ActionCard
            title={sv.subject.notes}
            help={sv.subject.notesHelp}
            disabled={pack.studyNotes.length === 0}
            onClick={() => navigate(`/las/${pack.id}`)}
          />
        </div>
      </section>

      {/* Curated tests */}
      {pack.quizzes.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
            {sv.subject.savedTests}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {pack.quizzes.map((quiz) => (
              <li key={quiz.id}>
                <Link to={`/kor/${pack.id}?mode=test&quiz=${quiz.id}`} className="block">
                  <Card className="flex items-center justify-between gap-3 transition active:scale-[0.99]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {quiz.level && <LevelPill level={quiz.level} />}
                        <p className="truncate font-semibold">{quiz.title}</p>
                      </div>
                      <p className="muted mt-0.5 text-sm">
                        {sv.home.questionCount(quiz.questionIds.length)}
                        {quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ''}
                      </p>
                    </div>
                    <span aria-hidden className="muted shrink-0">
                      →
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ActionCard({
  title,
  help,
  onClick,
  disabled,
}: {
  title: string;
  help: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="surface flex min-h-24 flex-col justify-center px-4 py-3 text-left transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
    >
      <span className="font-bold">{title}</span>
      <span className="muted mt-0.5 text-xs leading-snug">{help}</span>
    </button>
  );
}
