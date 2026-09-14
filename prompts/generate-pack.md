# Generate a HomeTutor content pack

Paste everything below into a new Claude conversation, attach the source material
(PDFs, photos of textbook pages, documents), and fill in the brief at the end.

Claude returns one JSON file. Save it as `content/packs/<id>.json`, run
`npm run validate:content`, and it appears in the app.

---

## PROMPT — copy from here

You are building a study pack for a Swedish student in årskurs 9. I will attach
source material. Turn it into a single JSON content pack for a quiz app.

Return **only** one fenced ```json block. No commentary before or after it.

### Hard rules

1. **Write everything in your own words.** Never copy sentences from the source
   material. Summarise, rephrase, and build questions *about* the content. Do not
   reproduce source text, and do not transcribe long passages.
2. **Every graded question needs an `explanation`** that teaches, not just states.
   Say why the right answer is right, and where useful why a tempting wrong answer
   is wrong. Two to four sentences. This is the single most important field in the
   file — a student who gets a question wrong should learn something from it.
3. **Language**: use the language of the subject. Swedish for SO/NO/matematik,
   English for English class, and so on. Set `language` accordingly (`sv`, `en`, …).
   The app's own interface is Swedish regardless.
4. **Only use the question types listed below.** Anything else will be rejected by
   the validator.
5. **All ids are lowercase kebab-case** (`a-z`, `0-9`, `-`). No å/ä/ö in ids — use
   `forlopp`, not `förlopp`. Ids only need to be unique inside the pack.
6. **Be factually careful.** If the source material is ambiguous or you are unsure
   of a date or figure, either leave the question out or phrase it so the
   uncertainty is honest ("omkring", "cirka"). Do not invent specifics.

### The three levels

Aim for roughly **40 % nivå 1, 35 % nivå 2, 25 % nivå 3**.

| Nivå | Name | What it tests | Typical verbs |
|---|---|---|---|
| 1 | Grunder | Recall. Facts, dates, people, definitions, straight from the material. | vad, när, vem, vilken, definiera |
| 2 | Förståelse | Understanding and application. Rephrased, not memorised. | förklara, jämför, varför, vad hände när, räkna ut |
| 3 | Analys | Analysis and evaluation. Several concepts combined, source criticism, exam-style reasoning. | värdera, analysera, vilket stöd finns, resonera, jämför och dra slutsats |

A nivå 3 question should be one a student could get right by *thinking*, not by
remembering harder. Give nivå 3 questions `"points": 2`.

### Question types

Use a **mix**. Do not make everything multiple choice.

#### `mcq` — one correct option
```json
{
  "id": "q-start-datum", "type": "mcq", "topicId": "forlopp", "level": 1,
  "prompt": "Vilken händelse räknas som starten på andra världskriget i Europa?",
  "options": [
    { "id": "a", "text": "Tyskland anfaller Polen den 1 september 1939" },
    { "id": "b", "text": "Japan anfaller Pearl Harbor" },
    { "id": "c", "text": "Tyskland anfaller Sovjetunionen" },
    { "id": "d", "text": "München-överenskommelsen" }
  ],
  "answer": "a",
  "explanation": "Kriget räknas från 1 september 1939 ... De andra alternativen är viktiga händelser, men de kom antingen före kriget eller vidgade ett krig som redan pågick."
}
```
Give 3–4 options. Wrong options must be *plausible* — a real misconception, a
neighbouring date, a related person — never obviously silly filler.

#### `multi` — several correct, partial credit
Same shape but `"answers": ["a", "b"]`. At least one correct and **not all** of
them (the validator rejects a question where every option is correct). Wrong picks
cancel right ones, so selecting everything scores zero.

#### `truefalse` — judge a statement
```json
{ "id": "q-tf-sverige", "type": "truefalse", "topicId": "foljder", "level": 1,
  "prompt": "Sverige var med i andra världskriget på de allierades sida.",
  "answer": false,
  "explanation": "Falskt. Sverige var formellt neutralt ... " }
```
The `prompt` is the statement. Make roughly half of them true.

#### `short` — free text
```json
{ "id": "q-blixtkrig", "type": "short", "topicId": "forlopp", "level": 1,
  "prompt": "Vad kallas den tyska anfallstaktiken där stridsvagnar och flyg snabbt bryter igenom fiendens linjer?",
  "accept": ["blixtkrig", "blitzkrieg", "blixtkriget"],
  "spellingTolerance": true,
  "placeholder": "Ett ord",
  "explanation": "..." }
```
- `accept` must list **every** reasonable spelling and inflection. Comparison
  already ignores case and punctuation.
- Set `"spellingTolerance": true` for long or foreign words (it forgives one or two
  typos). **Leave it off for years, numbers and short words**, where one changed
  character is a different answer.
- Only ask short-answer questions with a genuinely short answer — one word or a
  short phrase. Anything essay-shaped does not fit and should become an `mcq` or
  `multi` instead.

#### `numeric` — a number
```json
{ "id": "q-antal", "type": "numeric", "topicId": "foljder", "level": 2,
  "prompt": "Ungefär hur många miljoner judar mördades under Förintelsen?",
  "answer": 6, "tolerance": 0.5, "unit": "miljoner",
  "explanation": "..." }
```
`tolerance` is absolute; `tolerancePercent` is relative; if both are set the more
generous applies. Set a tolerance whenever the figure is an estimate. `unit` is
optional and a bare number is still accepted unless you set
`"acceptUnitless": false`.

#### `cloze` — fill in the blanks
```json
{ "id": "q-cloze-1939", "type": "cloze", "topicId": "forlopp", "level": 1,
  "prompt": "Den 1 september {{ar}} anföll Tyskland {{land}}.",
  "blanks": [
    { "id": "ar", "accept": ["1939"] },
    { "id": "land", "accept": ["Polen"], "spellingTolerance": true }
  ],
  "explanation": "..." }
```
Every `{{marker}}` in the prompt must have a matching blank id, and vice versa.
Add `"options": ["...", "..."]` to a blank to make it a dropdown — the options
must include one of its accepted answers. Scored per blank.

#### `flashcard` — self-rated, never scored
```json
{ "id": "q-fc-appeasement", "type": "flashcard", "topicId": "orsaker", "level": 1,
  "prompt": "Eftergiftspolitik (appeasement)",
  "back": "Storbritanniens och Frankrikes politik under 1930-talet att gå med på Hitlers krav för att undvika krig." }
```
`prompt` is the front, `back` is the answer. `explanation` is optional here. Good
for vocabulary, definitions, formulas, dates. Add 5–10 per pack.

### Study notes

Include one `studyNotes` entry per topic: a summary **in your own words**, in
markdown, that a student could revise from. Headings, short paragraphs, bullet
lists and tables all render. Aim for 200–400 words each.

### The file

```json
{
  "schemaVersion": 1,
  "id": "amne-omrade",
  "subject": "Historia",
  "title": "Andra världskriget",
  "language": "sv",
  "grade": "åk 9",
  "description": "En rad om vad paketet täcker.",
  "source": "Var materialet kom ifrån. Visas inte för eleven.",
  "createdAt": "2026-08-24",
  "topics": [
    { "id": "orsaker", "title": "Krigets orsaker", "description": "Valfri." }
  ],
  "assets": {},
  "studyNotes": [
    { "id": "not-orsaker", "topicId": "orsaker", "title": "...", "markdown": "..." }
  ],
  "questions": [],
  "quizzes": [
    { "id": "prov-niva-1", "title": "Nivå 1 – Grunder", "level": 1,
      "description": "...", "timeLimitMinutes": 10, "questionIds": [] }
  ]
}
```

Every question needs `id`, `type`, `topicId`, `level`, `prompt` and (except
flashcards) `explanation`. Optional on any question: `hint`, `points`, `tags`.

Build **three quizzes**, one per level, each listing the ids of that level's
graded questions (not flashcards). Set `timeLimitMinutes` to roughly one minute
per question for nivå 1 and two for nivå 3.

### Checklist before you answer

- [ ] Valid JSON, one fenced block, nothing else.
- [ ] 3–6 topics; every question's `topicId` exists.
- [ ] Roughly 40/35/25 across nivå 1/2/3.
- [ ] At least four different question types used.
- [ ] Every graded question has a real, teaching `explanation`.
- [ ] Every `mcq` `answer` and `multi` `answers` entry is an actual option id.
- [ ] Every `{{marker}}` matches a declared blank id.
- [ ] All ids lowercase kebab-case, unique within the pack.
- [ ] Quiz `questionIds` all exist and match the quiz's level.
- [ ] Nothing copied verbatim from the source material.

### The brief

- **Ämne (subject):** …
- **Titel / område (title):** …
- **Pack-id:** … (lowercase kebab-case, e.g. `biologi-genetik`)
- **Årskurs:** åk 9
- **Antal frågor:** ~25
- **Källa (for the `source` field):** …
- **Särskilda önskemål:** … (e.g. "extra fokus på källkritik", "hoppa över kapitel 3")

Source material is attached.

## PROMPT — copy to here

---

## After Claude answers

```bash
# 1. Save the JSON block
$EDITOR content/packs/<id>.json

# 2. Check it
npm run validate:content

# 3. See it in the app
npm run dev
```

The validator prints question counts per level and per type, so you can see at a
glance whether the mix came out reasonable. It fails on anything the app could not
render, and warns about things that are merely suspicious (a level with no
questions, a topic with no questions, a quiz mixing levels).

If you want to try a pack on her phone before committing it, paste the same JSON
into the app's `#/import` screen instead.

## Images and diagrams

The generation prompt above sets `"assets": {}` because Claude cannot produce image
files. To add a diagram by hand:

1. Save the image to `content/assets/<packId>/karta.png`.
2. Register it: `"assets": { "karta-1": "./assets/<packId>/karta.png" }`.
3. Reference it from a question with `"assetId": "karta-1"`, or from an option.

Remember that anything under `content/assets/` **is committed to git**, unlike
`content/sources/`. Do not put scanned textbook pages there — redraw or use
public-domain material.
