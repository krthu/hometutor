# HomeTutor

A study app for åk 9. She picks a subject, chooses one of three difficulty levels,
practises or takes a timed test, and gets scored automatically with an explanation
for every answer.

Swedish interface. Question content is in whatever language suits the subject.

No backend, no accounts, no database, no external calls at runtime. The whole thing
builds to a folder of static files.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173

npm run dev -- --host  # also reachable from her phone on the home network
```

## Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm test` | Full test suite |
| `npm run validate:content` | Check every content pack |
| `npm run check:sources` | Fail if source material is staged for commit |
| `npm run typecheck` | TypeScript, no emit |

## Adding a subject

Content authoring is a dev task — see **[docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)**.
The short version: put her material in `content/sources/`, paste
`prompts/generate-pack.md` into Claude with the material attached, save the JSON it
returns to `content/packs/<id>.json`, and run `npm run validate:content`. The
pack stays on this machine — send it to her phone and load it via the import
screen.

## How it is put together

```
src/
  content/schema.ts     Zod — the single source of truth for the pack format
  content/loader.ts     Bundled packs + imported packs, merged
  engine/               Pure logic: grading, text matching, sessions, SRS, progress
  storage/              localStorage (attempts), IndexedDB (imported packs), export
  components/questions/ One component per question type
  routes/               Hem, Ämne, session runner, Resultat, Framsteg, Läsa, Import
  i18n/sv.ts            Every UI string, in one place
content/
  packs/                Generated content packs — GITIGNORED, never committed
  assets/               Images referenced by packs — GITIGNORED
  sources/              Original PDFs and scans — GITIGNORED, never committed
```

**The attempt log is the source of truth.** Mastery, the streak, the weak-question
queue and the review schedule are all derived from it rather than stored. That is
what makes importing a backup safe: merging two logs is a union by id, and
everything else is recomputed.

**Grading is pure and tested.** `src/engine/score.ts` has no UI and no storage
dependencies, which is why the scoring rules — partial credit, tolerance bands,
spelling tolerance — can be verified directly.

## Three things that are deliberate

**Nothing in `content/` enters git** — not the scans, and not the generated packs
either. A pack quotes her teachers' own material: the genetics pack carries 51
instuderingsfrågor verbatim, one of which is on the prov. That makes a pack as
sensitive as the scan it came from. A `.git/hooks/pre-commit` hook blocks the lot
even from `git add -f`, because git history is permanent.

The consequence is deliberate: a clean checkout builds an **empty shell**, which
is what makes the app safe to host publicly. Packs are generated here and loaded
onto her phone through the app's import screen. A dev machine keeps its packs in
`content/packs/`, so local builds do have content.

**Diacritics are never folded when matching answers.** Folding would make "far"
match "får" and "hall" match "håll" — a wrong answer marked correct. Spelling
tolerance exists but is opt-in per question, and off for years and numbers where
one changed character is a different answer.

**The service worker is built but not registered.** Offline support is configured
and one env var away (`VITE_ENABLE_PWA=true`), but a service worker is sticky on an
origin and a stale one can serve an old build long after a fix ships. It only earns
its keep once there is a real HTTPS URL. See `src/pwa.ts`.

## Backups

Her progress lives in the browser, tied to the origin — clearing site data, a new
phone, or moving to a real domain all lose it.

**Framsteg → Dina data → Spara säkerhetskopia** writes everything to one JSON file.
Importing offers *Slå ihop* (default; never loses newer work) or *Ersätt allt*
(destructive; downloads a backup first and asks twice).

## Going online later

Nothing here forecloses it. The bundle uses a relative base and hash routing, so it
works from any host, any sub-path, or `file://` with no rebuild.

Two things to settle first:

1. **Copyright.** Questions *about* a textbook are fine; verbatim passages and
   scanned pages served publicly are not. The generation prompt tells Claude to
   write in its own words, so packs stay clean — but a public deployment is worth
   access-gating.
2. **Progress does not follow the origin.** Export her data *before* the move and
   import it after, or the history starts over.
