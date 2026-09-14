# Adding a subject, end to end

The split: **she practises, you author.** Content is generated with Claude,
validated, and sent to her device — it never enters git, and it never arrives
through a deploy.

## The loop

```
her material (PDF / photos / docs)
        │
        ▼
  content/sources/          ← gitignored. NEVER committed.
        │
        │   paste prompts/generate-pack.md into Claude, attach the material
        ▼
  one JSON content pack
        │
        ▼
  content/packs/<id>.json   ← gitignored. Stays on this machine.
        │
        │   npm run validate:content
        ▼
  npm run dev  →  it appears in the app
        │
        │   AirDrop the .json to her phone
        ▼
  app → Importera innehåll → Välj fil…
```

**Packs are not committed.** They quote her teachers' material verbatim, so they
are treated exactly like the scans they came from. A clean checkout therefore
builds an empty shell — that is what makes the app safe to host publicly — and
every subject reaches her phone through the import screen.

### 1. Collect the material

Put the original PDFs, scans and photos in `content/sources/`. That directory is
gitignored and a pre-commit hook blocks it even from a `git add -f`, because git
history is permanent and this is her textbook.

### 2. Generate

Open `prompts/generate-pack.md`, copy the block between the `PROMPT` markers into
a new Claude conversation, attach the material, and fill in the brief at the
bottom (subject, title, pack id, how many questions).

Claude returns a single JSON block.

### 3. Save and validate

```bash
$EDITOR content/packs/biologi-genetik.json   # paste the JSON
npm run validate:content
```

The validator is strict about anything the app could not render and chatty about
things that are merely suspicious:

- **Errors** (exit 1): invalid JSON, schema violations, an `mcq` answer that is not
  one of its options, a quiz referencing a question that does not exist, a cloze
  marker with no matching blank, a missing `explanation`, a duplicate id, an asset
  file that is not on disk, a question type that is reserved but not implemented.
- **Warnings**: a level with no questions, a topic with no questions, a quiz that
  mixes levels, a filename that does not match the pack id.

It also prints the shape of the pack, which is the quickest way to see whether the
question mix came out well:

```
✓ biologi-genetik.json (Biologi — Genetik)
    112 frågor  |  nivå 1: 53  nivå 2: 40  nivå 3: 19  |  7 områden, 12 prov
    mcq×49 multi×7 truefalse×7 short×15 numeric×9 cloze×4 flashcard×21
```

### 4. Check it in the app

```bash
npm run dev
```

Then walk one quiz per level. Watch for questions that are ambiguous, answers that
are technically right but not in `accept`, and explanations that restate the
question instead of teaching.

### 5. Send it to her

AirDrop the `.json` to her phone, then in the app: **Importera innehåll → Välj
fil…**. It validates on the spot and installs on that device only.

Do **not** commit the pack. The pre-commit hook refuses anything under
`content/`, packs included, and will tell you how to unstage it.

## Getting a pack onto a device

The app has an unlinked import screen at `#/import`. **Välj fil…** opens the
device's file picker — AirDrop the `.json` first and it is two taps on a phone.
The paste box beside it is the desktop path. Either way the pack is validated on
the spot and stored on that device only, in IndexedDB.

This is not a workaround for testing; it is how content reaches her, because
packs are never deployed.

Packs added this way are included in her data backup, so they survive a restore.
Re-importing a pack with the same id replaces it, and her attempt history
survives as long as the question ids are stable — so keep ids the same when
regenerating a pack, or she loses her streak and mastery.

## Question types

Seven are implemented: `mcq`, `multi`, `truefalse`, `short`, `numeric`, `cloze`,
`flashcard`. Full documentation with examples is in `prompts/generate-pack.md`.

Five more are reserved in the schema but rejected by the validator: `match`,
`order`, `categorize`, `hotspot`, `openResponse`. When it is time to extend,
`order` (timelines) and `openResponse` (long answer, self-graded against a rubric)
are the two worth adding first.

## Two things worth knowing

**Spelling tolerance is opt-in, and diacritics are never folded.** `å`, `ä` and `ö`
are always significant, because folding them would accept "far" for "får" and
"hall" for "håll". Set `"spellingTolerance": true` on long or foreign words; leave
it off for years and numbers, where a single changed character is a different
answer.

**Explanations are required on every graded question.** The validator enforces it.
A wrong answer with no explanation teaches nothing, which would make this a testing
app rather than a study app.

## Backups

Her progress lives in the browser, tied to the origin. Clearing site data, a new
phone, or moving from `localhost` to a real domain all lose it.

**Framsteg → Dina data → Spara säkerhetskopia** downloads everything (the attempt
log plus any imported packs) as one JSON file. Importing offers *Slå ihop* (default,
never loses newer work) or *Ersätt allt* (destructive, backs up first, asks twice).

Worth doing before any change of address or device.
