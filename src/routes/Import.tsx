import { useState } from 'react';
import { validatePack, type Pack } from '@/content/schema';
import { useAppState } from '@/state/AppState';
import { sv } from '@/i18n/sv';
import { BackLink, Banner, Button, Card, PageTitle, buttonClasses } from '@/components/ui';

/**
 * The dev door.
 *
 * Unlinked from the navigation: content normally arrives by being committed to
 * content/packs/ and rebuilt. This screen exists so a new pack can be tried on
 * her actual phone without a deploy, and so a pack can be added while away from
 * the machine that has the repo.
 */
export function ImportScreen() {
  const { packs, bundledPackIds, importedPacks, contentIssues, addPack, deletePack } = useAppState();

  const [text, setText] = useState('');
  const [checked, setChecked] = useState<
    { ok: true; pack: Pack } | { ok: false; errors: string[] } | null
  >(null);
  const [saved, setSaved] = useState(false);

  /**
   * Takes the source explicitly rather than reading `text` from state, so a file
   * can be validated in the same tick it is read instead of waiting a render for
   * the state to settle.
   */
  function validate(source = text) {
    setSaved(false);
    let raw: unknown;
    try {
      raw = JSON.parse(source);
    } catch (e) {
      setChecked({ ok: false, errors: [(e as Error).message] });
      return;
    }

    // The same gate the CLI validator uses, so a pack the repo would reject
    // cannot slip in through the import screen instead.
    const checked = validatePack(raw);
    setChecked(checked.ok ? { ok: true, pack: checked.pack } : { ok: false, errors: checked.errors });
  }

  /**
   * Picking the file is the whole point on a phone: a pack is well over 100 kB,
   * and getting that into the clipboard from iOS Files is painful enough that
   * the paste box alone goes unused. The textarea stays for desktop.
   */
  function readFile(file: File | undefined) {
    if (!file) return;
    setSaved(false);

    // FileReader rather than the tidier file.text(): that needs Safari 14, and
    // this screen exists to be used from whatever phone she happens to have.
    const reader = new FileReader();
    reader.onload = () => {
      const contents = typeof reader.result === 'string' ? reader.result : '';
      setText(contents);
      validate(contents);
    };
    reader.onerror = () => {
      setChecked({
        ok: false,
        errors: [sv.importScreen.fileError(reader.error?.message ?? 'okänt fel')],
      });
    };
    reader.readAsText(file);
  }

  async function save() {
    if (!checked?.ok) return;
    await addPack(checked.pack);
    setSaved(true);
    setText('');
    setChecked(null);
  }

  return (
    <>
      <BackLink to="/" label={sv.nav.home} />
      <PageTitle sub={sv.importScreen.lead}>{sv.importScreen.title}</PageTitle>

      {saved && (
        <div className="mb-4">
          <Banner tone="success">{sv.importScreen.saved}</Banner>
        </div>
      )}

      <div className="mb-3">
        <label className={buttonClasses('secondary', true) + ' cursor-pointer'}>
          {sv.importScreen.chooseFile}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              // Let the same file be picked again after a failed attempt.
              e.target.value = '';
            }}
          />
        </label>
        <p className="muted mt-2 text-center text-xs">{sv.importScreen.orPaste}</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setChecked(null);
        }}
        placeholder={sv.importScreen.placeholder}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        rows={10}
        className="surface w-full resize-y p-3 font-mono text-xs leading-relaxed outline-none"
      />

      <div className="mt-3 flex gap-2.5">
        <Button variant="secondary" onClick={() => validate()} disabled={text.trim().length === 0}>
          {sv.importScreen.validate}
        </Button>
        <Button full onClick={save} disabled={!checked?.ok}>
          {sv.importScreen.save}
        </Button>
      </div>

      {checked && (
        <div className="mt-4">
          {checked.ok ? (
            <Banner tone="success">
              {sv.importScreen.valid(checked.pack.title, checked.pack.questions.length)}
            </Banner>
          ) : (
            <Banner tone="error">
              <p className="mb-1 font-semibold">{sv.importScreen.invalid}</p>
              <ul className="list-inside list-disc font-mono text-xs">
                {checked.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Banner>
          )}
        </div>
      )}

      {contentIssues.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
            {sv.importScreen.contentIssues}
          </h2>
          <Banner tone="warn">
            <ul className="list-inside list-disc font-mono text-xs">
              {contentIssues.map((issue) => (
                <li key={issue.source}>
                  {issue.source}: {issue.message}
                </li>
              ))}
            </ul>
          </Banner>
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">
          {sv.importScreen.installed}
        </h2>
        <ul className="flex flex-col gap-2.5">
          {packs.map((pack) => {
            const isBundled = bundledPackIds.includes(pack.id);
            return (
              <li key={pack.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{pack.title}</p>
                    <p className="muted text-sm">
                      {pack.subject} · {pack.questions.length} frågor ·{' '}
                      {isBundled ? sv.importScreen.bundled : sv.importScreen.imported}
                    </p>
                  </div>
                  {!isBundled && (
                    <button
                      type="button"
                      className="shrink-0 px-2 text-sm font-semibold"
                      style={{ color: 'var(--wrong)' }}
                      onClick={() => {
                        if (confirm(sv.importScreen.removeConfirm)) void deletePack(pack.id);
                      }}
                    >
                      {sv.importScreen.remove}
                    </button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
        {importedPacks.length === 0 && packs.length === 0 && (
          <p className="muted text-sm">{sv.home.noContent}</p>
        )}
      </section>
    </>
  );
}
