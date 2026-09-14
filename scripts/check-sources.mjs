#!/usr/bin/env node
/**
 * Guard: original source material must never enter git history.
 *
 * content/ is gitignored, but `git add -f` or a stray `git add -A` on a machine
 * with a different ignore setup could still stage it. Git history is permanent,
 * so this is checked at commit time rather than discovered later.
 *
 * Run standalone (`npm run check:sources`) or via .git/hooks/pre-commit.
 */
import { execFileSync } from 'node:child_process';

// Nothing in content/ may be committed -- not the scans, and not the generated
// packs, which quote her teachers' material verbatim. The only tracked files are
// the directory markers that make the folders exist on a fresh clone.
//
// An allowlist, matching .gitignore, and deliberately without a per-file
// exception: whatever file such an exception named would eventually be
// overwritten with a real pack. The test suite's sample pack lives in src/test/.
function isSourceMaterial(f) {
  if (!f.startsWith('content/')) return false;
  return !/^content\/[^/]+\/\.gitkeep$/.test(f);
}

function staged() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

const offenders = staged().filter(isSourceMaterial);

if (offenders.length > 0) {
  console.error('\n\x1b[31m✖ Blocked: source material is staged for commit.\x1b[0m\n');
  for (const f of offenders) console.error(`    ${f}`);
  console.error(`
content/ holds the original PDFs, scans and slide decks, and the packs generated
from them -- the packs quote her teachers' material verbatim, so they are just as
sensitive. Git history is permanent, so none of it may be committed. Packs reach
her phone through the app's import screen, not through the repo.

To unstage (rm --cached, not restore --staged: restore needs a HEAD commit and
fails silently in a repo that has none yet):

    git rm --cached --force ${offenders.map((f) => JSON.stringify(f)).join(' ')}
`);
  process.exit(1);
}

console.log('✓ No source material staged.');
