import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Pack } from '@/content/schema';
import { loadBundledPacks, mergeContent, type LoadIssue } from '@/content/loader';
import {
  loadImportedPacks,
  upsertImportedPack,
  removeImportedPack,
  saveImportedPacks,
} from '@/storage/packs';
import {
  appendAttempt,
  loadProgress,
  replaceProgress,
  clearProgress,
  StorageFullError,
} from '@/storage/progress';
import {
  deriveProgress,
  type Attempt,
  type DerivedProgress,
  type ProgressData,
} from '@/engine/progress';

/**
 * One place that owns content and progress.
 *
 * Derived values (mastery, streak, weak questions, the review queue) are memoised
 * from the attempt log rather than stored, matching the storage model: the log is
 * the truth and everything else is a projection of it.
 */

interface AppStateValue {
  ready: boolean;
  packs: Pack[];
  bundledPackIds: string[];
  importedPacks: Pack[];
  contentIssues: LoadIssue[];

  progress: ProgressData;
  /** Mastery, streak, stats, weak questions and the review queue -- all derived. */
  derived: DerivedProgress;

  saveAttempt: (attempt: Attempt) => void;
  applyProgress: (data: ProgressData) => void;
  resetProgress: () => void;
  addPack: (pack: Pack) => Promise<void>;
  deletePack: (packId: string) => Promise<void>;
  setImportedPacks: (packs: Pack[]) => Promise<void>;
  storageError: string | null;
  dismissStorageError: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const bundled = loadBundledPacks();
// Fixed for the lifetime of the build, so it never needs recomputing per render.
const bundledPackIds = bundled.packs.map((p) => p.id);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [importedPacks, setImportedPacksState] = useState<Pack[]>([]);
  const [progress, setProgress] = useState<ProgressData>(() => loadProgress());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // IndexedDB is async, so imported packs arrive a tick after the bundled ones.
  useEffect(() => {
    let cancelled = false;
    loadImportedPacks().then((packs) => {
      if (cancelled) return;
      setImportedPacksState(packs);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const packs = useMemo(
    () => mergeContent(bundled.packs, importedPacks),
    [importedPacks],
  );

  // One walk of the attempt log produces every projection of it.
  const derived = useMemo(() => deriveProgress(progress.attempts), [progress.attempts]);

  const saveAttempt = useCallback((attempt: Attempt) => {
    try {
      setProgress(appendAttempt(attempt));
    } catch (e) {
      if (e instanceof StorageFullError) setStorageError('storageFull');
      else throw e;
    }
  }, []);

  const applyProgress = useCallback((data: ProgressData) => {
    setProgress(replaceProgress(data));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(clearProgress());
  }, []);

  const addPack = useCallback(async (pack: Pack) => {
    setImportedPacksState(await upsertImportedPack(pack));
  }, []);

  const deletePack = useCallback(async (packId: string) => {
    setImportedPacksState(await removeImportedPack(packId));
  }, []);

  const setImportedPacks = useCallback(async (next: Pack[]) => {
    await saveImportedPacks(next);
    setImportedPacksState(next);
  }, []);

  const dismissStorageError = useCallback(() => setStorageError(null), []);

  // Memoised so the careful memoisation above is actually load-bearing: a fresh
  // object literal here would re-render every consumer on any provider render.
  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      packs,
      bundledPackIds,
      importedPacks,
      contentIssues: bundled.issues,
      progress,
      derived,
      saveAttempt,
      applyProgress,
      resetProgress,
      addPack,
      deletePack,
      setImportedPacks,
      storageError,
      dismissStorageError,
    }),
    [
      ready,
      packs,
      importedPacks,
      progress,
      derived,
      saveAttempt,
      applyProgress,
      resetProgress,
      addPack,
      deletePack,
      setImportedPacks,
      storageError,
      dismissStorageError,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
