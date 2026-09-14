import { z } from 'zod';
import { levelSchema, packSchema, formatIssues, type Pack } from '@/content/schema';
import {
  mergeAttempts,
  PROGRESS_VERSION,
  type Attempt,
  type ProgressData,
  type Profile,
} from '@/engine/progress';
import type { SessionMode } from '@/engine/session';
import { toIsoDate } from '@/engine/srs';

/**
 * Backup file format.
 *
 * Everything the browser is the sole owner of goes in one file: the attempt log
 * and any packs added through the import screen. Bundled packs are deliberately
 * left out -- they come back from the build, so including them would only bloat
 * the file and risk restoring a stale copy over a newer one.
 *
 * The point of this existing at all: progress lives in localStorage, which is
 * tied to the browser origin. Clearing site data, a new phone, or moving from a
 * dev server to a real domain all lose it silently. This is the way back.
 */

export const EXPORT_VERSION = 1;
export const EXPORT_KIND = 'hometutor-export';

const attemptSchema = z.object({
  id: z.string().min(1),
  packId: z.string().min(1),
  mode: z.enum(['practice', 'test', 'flashcards']) satisfies z.ZodType<SessionMode>,
  quizId: z.string().optional(),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      packId: z.string().min(1),
      topicId: z.string().min(1),
      level: levelSchema,
      type: z.string().min(1),
      status: z.enum(['correct', 'partial', 'incorrect', 'ungraded']),
      earned: z.number(),
      max: z.number(),
      rating: z.enum(['again', 'hard', 'good', 'easy']).optional(),
      ms: z.number().optional(),
    }),
  ),
});

export const exportFileSchema = z.object({
  kind: z.literal(EXPORT_KIND),
  exportVersion: z.number().int().positive(),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  profile: z.object({ id: z.string().min(1), name: z.string() }),
  progress: z.object({ attempts: z.array(attemptSchema) }),
  /** Packs added via the import screen, so they survive a restore too. */
  packs: z.array(packSchema).default([]),
});

export type ExportFile = z.infer<typeof exportFileSchema>;

export function buildExport(
  progress: ProgressData,
  importedPacks: readonly Pack[],
  appVersion?: string,
): ExportFile {
  return {
    kind: EXPORT_KIND,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    profile: progress.profile,
    progress: { attempts: progress.attempts },
    packs: [...importedPacks],
  };
}

/** Filename with the date in it, so successive backups do not overwrite each other. */
export function exportFilename(now = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `hometutor-data-${toIsoDate(now)}-${hh}${mm}.json`;
}

// --- Parsing ----------------------------------------------------------------

export type ParseResult =
  | { ok: true; file: ExportFile }
  | { ok: false; reason: 'json' | 'kind' | 'version' | 'schema'; message: string };

/**
 * Parse a backup file.
 *
 * Failures are typed rather than thrown so the UI can say something specific in
 * Swedish -- "this is not a HomeTutor file" is a different problem from "this
 * file is from a newer version of the app".
 */
export function parseExport(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'json', message: (e as Error).message };
  }

  if (typeof raw !== 'object' || raw === null || (raw as { kind?: unknown }).kind !== EXPORT_KIND) {
    return { ok: false, reason: 'kind', message: 'not a HomeTutor export file' };
  }

  const version = (raw as { exportVersion?: unknown }).exportVersion;
  if (typeof version === 'number' && version > EXPORT_VERSION) {
    return {
      ok: false,
      reason: 'version',
      message: `file is version ${version}, this app understands up to ${EXPORT_VERSION}`,
    };
  }

  const migrated = migrateExport(raw as Record<string, unknown>);
  const parsed = exportFileSchema.safeParse(migrated);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'schema',
      message: formatIssues(parsed.error, 5).join('; '),
    };
  }

  return { ok: true, file: parsed.data };
}

/**
 * Bring an older export up to the current shape.
 *
 * Empty today because version 1 is the only version that has ever existed. It is
 * here so that when the format does change, old backups keep importing instead
 * of the app telling her the file is broken.
 */
export function migrateExport(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

// --- Applying ---------------------------------------------------------------

export type ImportStrategy = 'merge' | 'replace';

export interface ImportOutcome {
  progress: ProgressData;
  packs: Pack[];
  stats: {
    attemptsBefore: number;
    attemptsAfter: number;
    attemptsAdded: number;
    packsAdded: number;
  };
}

/**
 * Apply a parsed backup.
 *
 * Merge is the default in the UI. Replacing is destructive and only sensible when
 * she means "make this device look exactly like the backup".
 */
export function applyImport(
  current: ProgressData,
  currentPacks: readonly Pack[],
  file: ExportFile,
  strategy: ImportStrategy,
): ImportOutcome {
  const incoming = file.progress.attempts as Attempt[];

  const attempts =
    strategy === 'replace' ? [...incoming] : mergeAttempts(current.attempts, incoming);

  const packs =
    strategy === 'replace'
      ? [...file.packs]
      : mergePacks(currentPacks, file.packs);

  const profile: Profile = strategy === 'replace' ? file.profile : current.profile;

  return {
    progress: { version: PROGRESS_VERSION, profile, attempts },
    packs,
    stats: {
      attemptsBefore: current.attempts.length,
      attemptsAfter: attempts.length,
      attemptsAdded: attempts.length - current.attempts.length,
      packsAdded: packs.length - currentPacks.length,
    },
  };
}

/** Union packs by id; the incoming copy wins so a corrected pack can be restored. */
export function mergePacks(current: readonly Pack[], incoming: readonly Pack[]): Pack[] {
  const byId = new Map<string, Pack>();
  for (const p of current) byId.set(p.id, p);
  for (const p of incoming) byId.set(p.id, p);
  return [...byId.values()];
}
