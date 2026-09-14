import {
  emptyProgress,
  PROGRESS_VERSION,
  type Attempt,
  type ProgressData,
  type Profile,
} from '@/engine/progress';

/**
 * localStorage adapter for the attempt log.
 *
 * The key is versioned so a future format change cannot half-read old data. Every
 * read is defensive: a corrupted or hand-edited value must not brick the app, so
 * anything unparseable falls back to an empty log rather than throwing.
 */

export const PROGRESS_KEY = `hometutor.progress.v${PROGRESS_VERSION}`;

const DEFAULT_PROFILE: Profile = { id: 'default', name: '' };

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return null;
  }
}

export function loadProgress(): ProgressData {
  const store = storage();
  if (!store) return emptyProgress(DEFAULT_PROFILE);

  const raw = store.getItem(PROGRESS_KEY);
  if (!raw) return emptyProgress(DEFAULT_PROFILE);

  try {
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    if (!Array.isArray(parsed.attempts)) return emptyProgress(DEFAULT_PROFILE);
    return {
      version: PROGRESS_VERSION,
      profile: parsed.profile ?? DEFAULT_PROFILE,
      attempts: parsed.attempts as Attempt[],
    };
  } catch {
    return emptyProgress(DEFAULT_PROFILE);
  }
}

export class StorageFullError extends Error {}

export function saveProgress(data: ProgressData): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    // Quota exceeded. Surfaced rather than swallowed: losing progress silently
    // is exactly the failure the export feature exists to prevent.
    throw new StorageFullError((e as Error).message);
  }
}

export function appendAttempt(attempt: Attempt): ProgressData {
  const current = loadProgress();
  const next: ProgressData = { ...current, attempts: [...current.attempts, attempt] };
  saveProgress(next);
  return next;
}

export function replaceProgress(data: ProgressData): ProgressData {
  saveProgress(data);
  return data;
}

/** Used by the reset button, which always offers a backup first. */
export function clearProgress(): ProgressData {
  const store = storage();
  const fresh = emptyProgress(loadProgress().profile);
  if (store) store.removeItem(PROGRESS_KEY);
  return fresh;
}

export function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
