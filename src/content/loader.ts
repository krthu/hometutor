import { validatePack, type Pack, type Topic } from '@/content/schema';

/**
 * Where content comes from.
 *
 * Two sources, merged: packs bundled from content/packs/ at build time, and packs
 * added through the import screen at runtime. Bundled packs are canonical -- if
 * both define the same id, the bundled one wins, so a stale imported copy can
 * never shadow a corrected one that shipped in the build.
 */

// Vite inlines every JSON file under content/packs/ at build time, so the app has
// its content without a fetch and works offline with no extra plumbing.
const bundledModules = import.meta.glob('../../content/packs/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export interface LoadIssue {
  source: string;
  message: string;
}

export interface LoadedContent {
  packs: Pack[];
  issues: LoadIssue[];
}

function parsePacks(entries: [string, unknown][]): LoadedContent {
  const packs: Pack[] = [];
  const issues: LoadIssue[] = [];

  for (const [source, raw] of entries) {
    const checked = validatePack(raw, 3);
    if (checked.ok) {
      packs.push(checked.pack);
    } else {
      // A bad pack is skipped rather than fatal: one broken file should not stop
      // her practising the subjects that are fine. The issue surfaces on /import.
      issues.push({ source, message: checked.errors.join('; ') });
    }
  }

  return { packs, issues };
}

export function loadBundledPacks(): LoadedContent {
  return parsePacks(Object.entries(bundledModules));
}

export function mergeContent(bundled: readonly Pack[], imported: readonly Pack[]): Pack[] {
  const byId = new Map<string, Pack>();
  for (const p of imported) byId.set(p.id, p);
  for (const p of bundled) byId.set(p.id, p); // bundled wins
  return [...byId.values()].sort(
    (a, b) => a.subject.localeCompare(b.subject, 'sv') || a.title.localeCompare(b.title, 'sv'),
  );
}

// --- Lookup helpers ---------------------------------------------------------

export function findPack(packs: readonly Pack[], packId: string): Pack | undefined {
  return packs.find((p) => p.id === packId);
}

export function findTopic(pack: Pack, topicId: string): Topic | undefined {
  return pack.topics.find((t) => t.id === topicId);
}

export function topicTitle(pack: Pack, topicId: string): string {
  return findTopic(pack, topicId)?.title ?? topicId;
}

/**
 * Resolve an assetId to something an <img src> can use.
 *
 * Imported packs carry data: URIs inline. Bundled packs use paths relative to
 * content/, which are resolved against the app's base URL so the build keeps
 * working from a sub-path or from file://.
 */
export function assetUrl(pack: Pack, assetId: string | undefined): string | undefined {
  if (!assetId) return undefined;
  const location = pack.assets[assetId];
  if (!location) return undefined;
  if (location.startsWith('data:') || /^https?:\/\//.test(location)) return location;
  return new URL(
    `content/${location.replace(/^\.\//, '')}`,
    new URL(import.meta.env.BASE_URL, window.location.href),
  ).toString();
}

/** Group packs by subject, for the home screen. */
export function bySubject(packs: readonly Pack[]): { subject: string; packs: Pack[] }[] {
  const groups = new Map<string, Pack[]>();
  for (const p of packs) {
    const list = groups.get(p.subject);
    if (list) list.push(p);
    else groups.set(p.subject, [p]);
  }
  return [...groups.entries()]
    .map(([subject, list]) => ({ subject, packs: list }))
    .sort((a, b) => a.subject.localeCompare(b.subject, 'sv'));
}
