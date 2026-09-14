import { describe, it, expect } from 'vitest';
import {
  buildExport,
  parseExport,
  applyImport,
  exportFilename,
  mergePacks,
  EXPORT_KIND,
  EXPORT_VERSION,
} from './export';
import { emptyProgress, type Attempt, type AnswerRecord, type ProgressData } from '@/engine/progress';
import { realPack } from '@/test/fixtures';
import { validatePack } from '@/content/schema';

function answer(over: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    questionId: 'q1',
    packId: 'historia-vk2',
    topicId: 'orsaker',
    level: 1,
    type: 'mcq',
    status: 'correct',
    earned: 1,
    max: 1,
    ...over,
  };
}

function attempt(id: string, finishedAt: string): Attempt {
  return {
    id,
    packId: 'historia-vk2',
    mode: 'test',
    startedAt: finishedAt,
    finishedAt,
    answers: [answer()],
  };
}

function progressWith(...attempts: Attempt[]): ProgressData {
  return { ...emptyProgress({ id: 'p1', name: 'Eleven' }), attempts };
}

describe('buildExport', () => {
  it('produces a recognisable, versioned file', () => {
    const file = buildExport(progressWith(attempt('1', '2026-08-24T10:00:00Z')), []);
    expect(file.kind).toBe(EXPORT_KIND);
    expect(file.exportVersion).toBe(EXPORT_VERSION);
    expect(file.progress.attempts).toHaveLength(1);
  });

  it('includes imported packs but is happy with none', () => {
    expect(buildExport(progressWith(), [realPack]).packs).toHaveLength(1);
    expect(buildExport(progressWith(), []).packs).toEqual([]);
  });
});

describe('exportFilename', () => {
  it('puts the date and time in the name so backups do not overwrite each other', () => {
    const a = exportFilename(new Date(2026, 7, 24, 9, 5));
    expect(a).toBe('hometutor-data-2026-08-24-0905.json');
    expect(a).not.toBe(exportFilename(new Date(2026, 7, 24, 9, 6)));
  });
});

describe('parseExport', () => {
  it('round-trips a file it built', () => {
    const original = progressWith(attempt('1', '2026-08-24T10:00:00Z'));
    const text = JSON.stringify(buildExport(original, [realPack]));

    const parsed = parseExport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.file.progress.attempts).toEqual(original.attempts);
    expect(parsed.file.packs[0].id).toBe(realPack.id);
    expect(parsed.file.packs[0].questions).toHaveLength(realPack.questions.length);
  });

  it('rejects invalid JSON with a specific reason', () => {
    const r = parseExport('{not json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('json');
  });

  it('rejects a JSON file that is not a HomeTutor export', () => {
    const r = parseExport(JSON.stringify({ hello: 'world' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('kind');
  });

  it('refuses a file from a newer version rather than mangling it', () => {
    const file = buildExport(progressWith(), []);
    const r = parseExport(JSON.stringify({ ...file, exportVersion: 99 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('version');
      expect(r.message).toContain('99');
    }
  });

  it('reports schema problems readably', () => {
    const file = buildExport(progressWith(attempt('1', '2026-08-24T10:00:00Z')), []);
    // Corrupt one attempt.
    const broken = JSON.parse(JSON.stringify(file));
    delete broken.progress.attempts[0].finishedAt;

    const r = parseExport(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('schema');
      expect(r.message).toContain('finishedAt');
    }
  });

  it('accepts a file from an older version', () => {
    const file = buildExport(progressWith(), []);
    expect(parseExport(JSON.stringify({ ...file, exportVersion: 1 })).ok).toBe(true);
  });
});

describe('applyImport', () => {
  const backup = buildExport(progressWith(attempt('mon', '2026-08-24T10:00:00Z')), [realPack]);

  it('merges without losing newer local work', () => {
    // The plan's verification case: export Monday, practise Tue-Thu, re-import
    // the Monday file. The three newer attempts must survive.
    const current = progressWith(
      attempt('mon', '2026-08-24T10:00:00Z'),
      attempt('tue', '2026-08-25T10:00:00Z'),
      attempt('wed', '2026-08-26T10:00:00Z'),
      attempt('thu', '2026-08-27T10:00:00Z'),
    );

    const out = applyImport(current, [], backup, 'merge');
    expect(out.progress.attempts).toHaveLength(4);
    expect(out.progress.attempts.map((a) => a.id)).toEqual(['mon', 'tue', 'wed', 'thu']);
    expect(out.stats.attemptsAdded).toBe(0);
  });

  it('adds attempts the local device has never seen', () => {
    const current = progressWith(attempt('tue', '2026-08-25T10:00:00Z'));
    const out = applyImport(current, [], backup, 'merge');
    expect(out.progress.attempts.map((a) => a.id)).toEqual(['mon', 'tue']);
    expect(out.stats.attemptsAdded).toBe(1);
  });

  it('restores everything onto an empty device', () => {
    const out = applyImport(emptyProgress({ id: 'x', name: '' }), [], backup, 'merge');
    expect(out.progress.attempts).toHaveLength(1);
    expect(out.packs).toHaveLength(1);
  });

  it('replace discards local work, as advertised', () => {
    const current = progressWith(
      attempt('tue', '2026-08-25T10:00:00Z'),
      attempt('wed', '2026-08-26T10:00:00Z'),
    );
    const out = applyImport(current, [], backup, 'replace');
    expect(out.progress.attempts.map((a) => a.id)).toEqual(['mon']);
  });

  it('keeps the local profile when merging and takes the backup profile when replacing', () => {
    const current = { ...progressWith(), profile: { id: 'local', name: 'Lokal' } };
    expect(applyImport(current, [], backup, 'merge').progress.profile.id).toBe('local');
    expect(applyImport(current, [], backup, 'replace').progress.profile.id).toBe('p1');
  });

  it('is idempotent -- importing the same file twice changes nothing the second time', () => {
    const once = applyImport(progressWith(), [], backup, 'merge');
    const twice = applyImport(once.progress, once.packs, backup, 'merge');
    expect(twice.progress.attempts).toEqual(once.progress.attempts);
    expect(twice.packs).toEqual(once.packs);
  });
});

describe('mergePacks', () => {
  it('unions by id with the incoming copy winning', () => {
    const older = { ...realPack, title: 'Gammal titel' };
    const merged = mergePacks([older], [realPack]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe(realPack.title);
  });

  it('keeps packs that are only present locally', () => {
    const other = { ...realPack, id: 'annan-pack' };
    expect(mergePacks([other], [realPack]).map((p) => p.id).sort()).toEqual([
      'annan-pack',
      'historia-vk2',
    ]);
  });
});

describe('full round trip', () => {
  it('survives export, wipe and re-import intact', () => {
    const original = progressWith(
      attempt('1', '2026-08-24T10:00:00Z'),
      attempt('2', '2026-08-25T10:00:00Z'),
    );

    const text = JSON.stringify(buildExport(original, [realPack]), null, 2);

    // "Clear site data": start from nothing.
    const wiped = emptyProgress({ id: 'fresh', name: '' });

    const parsed = parseExport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const restored = applyImport(wiped, [], parsed.file, 'replace');
    expect(restored.progress.attempts).toEqual(original.attempts);
    expect(restored.progress.profile).toEqual(original.profile);
    expect(restored.packs[0].id).toBe(realPack.id);
  });
});

describe('validatePack — the one gate every entry point uses', () => {
  it('accepts the shipping pack', () => {
    expect(validatePack(realPack).ok).toBe(true);
  });

  it('rejects a reserved type, so the import screen cannot install what the CLI refuses', () => {
    const withReserved = {
      ...realPack,
      questions: [
        ...realPack.questions,
        {
          id: 'q-tidslinje',
          type: 'order',
          topicId: 'forlopp',
          level: 2,
          prompt: 'Sortera händelserna.',
          explanation: '...',
        },
      ],
    };

    const result = validatePack(withReserved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('order');
      expect(result.errors[0]).toContain('reserved');
    }
  });

  it('reports schema problems with a readable path', () => {
    const broken = { ...realPack, questions: [{ ...realPack.questions[0], answer: 'inte-ett-alternativ' }] };
    const result = validatePack(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('answer');
  });
});
