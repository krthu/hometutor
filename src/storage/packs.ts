import { get, set } from 'idb-keyval';
import { validatePack, type Pack } from '@/content/schema';

/**
 * Packs added through the import screen.
 *
 * IndexedDB rather than localStorage because a pack with inline images can run to
 * several megabytes, well past the ~5MB localStorage ceiling.
 *
 * These are the packs the browser is the sole owner of, which is why the backup
 * file carries them and does not carry the bundled ones.
 */

const IMPORTED_PACKS_KEY = 'hometutor.importedPacks.v1';

export async function loadImportedPacks(): Promise<Pack[]> {
  try {
    const raw = await get<unknown[]>(IMPORTED_PACKS_KEY);
    if (!Array.isArray(raw)) return [];

    // Re-validate on read. A pack could have been written by an older build, and
    // a malformed one must not take the whole app down at startup.
    const out: Pack[] = [];
    for (const item of raw) {
      const checked = validatePack(item);
      if (checked.ok) out.push(checked.pack);
    }
    return out;
  } catch {
    return [];
  }
}

export async function saveImportedPacks(packs: readonly Pack[]): Promise<void> {
  await set(IMPORTED_PACKS_KEY, packs);
}

/** Add or replace one pack by id. Returns the new full list. */
export async function upsertImportedPack(pack: Pack): Promise<Pack[]> {
  const current = await loadImportedPacks();
  const next = [...current.filter((p) => p.id !== pack.id), pack];
  await saveImportedPacks(next);
  return next;
}

export async function removeImportedPack(packId: string): Promise<Pack[]> {
  const next = (await loadImportedPacks()).filter((p) => p.id !== packId);
  await saveImportedPacks(next);
  return next;
}
