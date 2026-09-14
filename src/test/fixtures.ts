import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packSchema, type Pack } from '@/content/schema';

/**
 * A full-size, realistically shaped pack, used as the fixture for every test
 * that needs content.
 *
 * It lives here rather than in content/packs/ because nothing in content/ is
 * committed any more -- the packs are generated from her teachers' material and
 * stay on the machine that made them. This one is hand-written and contains no
 * source material, so it is safe in git, and keeping it under src/test/ means
 * there is no "except this file" hole in the ignore rules for someone to
 * overwrite later with a real pack.
 *
 * Resolved from the working directory rather than import.meta.url: under the
 * jsdom environment import.meta.url is an http: URL, not a file: one.
 */
export function loadRealPack(): Pack {
  const path = resolve(process.cwd(), 'src/test/demo-pack.json');
  return packSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

export const realPack: Pack = loadRealPack();
