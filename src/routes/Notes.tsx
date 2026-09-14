import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAppState } from '@/state/AppState';
import { findPack, topicTitle } from '@/content/loader';
import { sv } from '@/i18n/sv';
import { BackLink, Button, Card, EmptyState, PageTitle } from '@/components/ui';

/**
 * Study notes.
 *
 * Markdown is sanitised before it reaches the DOM. Bundled packs are ours, but an
 * imported pack is arbitrary pasted text, and this is the one place in the app
 * that renders content as HTML rather than as a string.
 */
export function Notes() {
  const { packId } = useParams<{ packId: string }>();
  const navigate = useNavigate();
  const { packs } = useAppState();

  const pack = packId ? findPack(packs, packId) : undefined;

  const rendered = useMemo(() => {
    if (!pack) return [];
    return pack.studyNotes.map((note) => ({
      ...note,
      html: DOMPurify.sanitize(marked.parse(note.markdown, { async: false }) as string),
    }));
  }, [pack]);

  if (!pack) {
    return (
      <EmptyState
        title={sv.common.notFound}
        help={sv.common.notFoundHelp}
        action={<Button onClick={() => navigate('/')}>{sv.common.goHome}</Button>}
      />
    );
  }

  return (
    <>
      <BackLink to={`/amne/${pack.id}`} />
      <PageTitle sub={pack.title}>{sv.notes.title}</PageTitle>

      {rendered.length === 0 ? (
        <EmptyState title={sv.notes.empty} />
      ) : (
        <div className="flex flex-col gap-4">
          {rendered.map((note) => (
            <Card key={note.id}>
              <p className="muted mb-1 text-xs font-semibold uppercase tracking-wide">
                {topicTitle(pack, note.topicId)}
              </p>
              <h2 className="mb-3 text-lg font-bold">{note.title}</h2>
              <div
                className="prose-notes text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: note.html }}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
