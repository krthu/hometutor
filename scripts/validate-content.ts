#!/usr/bin/env tsx
/**
 * Validates every pack in content/packs/ before it can reach the app.
 *
 * Runs the same Zod schema the import screen uses, plus the checks that only make
 * sense on disk (asset files actually existing, pack ids unique across files) and
 * authoring warnings (a level with no questions, a quiz that skips a level).
 */
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePack, isGradable, LEVELS, IMPLEMENTED_TYPES, type Pack } from '../src/content/schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS_DIR = join(ROOT, 'content', 'packs');

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const errors: string[] = [];
const warnings: string[] = [];

function fail(file: string, msg: string) {
  errors.push(`${bold(file)}: ${msg}`);
}
function warn(file: string, msg: string) {
  warnings.push(`${bold(file)}: ${msg}`);
}

if (!existsSync(PACKS_DIR)) {
  console.error(red(`✖ No content/packs/ directory at ${PACKS_DIR}`));
  process.exit(1);
}

const files = readdirSync(PACKS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.log(yellow('⚠ No packs found in content/packs/ -- nothing to validate.'));
  process.exit(0);
}

const seenPackIds = new Map<string, string>();
const validPacks: { file: string; pack: Pack }[] = [];

for (const file of files) {
  const fullPath = join(PACKS_DIR, file);
  let raw: unknown;

  try {
    raw = JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch (e) {
    fail(file, `not valid JSON -- ${(e as Error).message}`);
    continue;
  }

  // The same gate the app's import screen uses.
  const result = validatePack(raw, Number.MAX_SAFE_INTEGER);
  if (!result.ok) {
    fail(file, 'validation failed:\n' + result.errors.map((e) => `  ${dim(e)}`).join('\n'));
    continue;
  }

  const pack = result.pack;

  // Pack ids must be unique across files -- two packs with the same id would
  // silently shadow each other in the loader.
  const previous = seenPackIds.get(pack.id);
  if (previous) {
    fail(file, `pack id "${pack.id}" is already used by ${previous}`);
  } else {
    seenPackIds.set(pack.id, file);
  }

  if (file !== `${pack.id}.json`) {
    warn(file, `filename does not match pack id -- expected ${pack.id}.json`);
  }

  // Assets referenced by relative path must exist on disk. data: URIs are for
  // packs pasted into the import screen and are checked by the schema only.
  for (const [assetId, location] of Object.entries(pack.assets)) {
    if (location.startsWith('data:') || /^https?:\/\//.test(location)) continue;
    const assetPath = resolve(join(ROOT, 'content'), location.replace(/^\.\//, ''));
    if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
      fail(file, `asset "${assetId}" points at a missing file: ${location}`);
    }
  }

  // --- Authoring warnings ---------------------------------------------------

  for (const level of LEVELS) {
    const n = pack.questions.filter((q) => q.level === level && isGradable(q)).length;
    if (n === 0) {
      warn(file, `no graded questions at nivå ${level} -- that level will be empty in the app`);
    }
  }

  for (const topic of pack.topics) {
    const n = pack.questions.filter((q) => q.topicId === topic.id).length;
    if (n === 0) warn(file, `topic "${topic.id}" has no questions`);
  }

  for (const quiz of pack.quizzes) {
    const dupes = quiz.questionIds.filter((q, i) => quiz.questionIds.indexOf(q) !== i);
    if (dupes.length) {
      warn(file, `quiz "${quiz.id}" repeats question(s): ${[...new Set(dupes)].join(', ')}`);
    }
    if (quiz.level !== undefined) {
      const wrong = quiz.questionIds.filter((qid) => {
        const q = pack.questions.find((x) => x.id === qid);
        return q && q.level !== quiz.level;
      });
      if (wrong.length) {
        warn(
          file,
          `quiz "${quiz.id}" is nivå ${quiz.level} but includes questions from another level: ${wrong.join(', ')}`,
        );
      }
    }
  }

  validPacks.push({ file, pack });
}

// --- Report -----------------------------------------------------------------

console.log('');
for (const { file, pack } of validPacks) {
  const byLevel = LEVELS.map(
    (l) => `nivå ${l}: ${pack.questions.filter((q) => q.level === l).length}`,
  ).join('  ');
  const byType = IMPLEMENTED_TYPES.map((t) => {
    const n = pack.questions.filter((q) => q.type === t).length;
    return n ? `${t}×${n}` : null;
  })
    .filter(Boolean)
    .join(' ');

  console.log(`${green('✓')} ${bold(file)} ${dim(`(${pack.subject} — ${pack.title})`)}`);
  console.log(
    `    ${pack.questions.length} frågor  ${dim('|')}  ${byLevel}  ${dim('|')}  ${pack.topics.length} områden, ${pack.quizzes.length} prov`,
  );
  console.log(`    ${dim(byType)}`);
}

if (warnings.length) {
  console.log(`\n${yellow(`⚠ ${warnings.length} warning(s)`)}`);
  for (const w of warnings) console.log(`  ${w}`);
}

if (errors.length) {
  console.log(`\n${red(`✖ ${errors.length} error(s)`)}`);
  for (const e of errors) console.log(`  ${e}`);
  console.log('');
  process.exit(1);
}

console.log(
  `\n${green(`✓ ${validPacks.length} pack(s) valid`)} ${dim(`— ${validPacks.reduce((n, p) => n + p.pack.questions.length, 0)} questions total`)}\n`,
);
