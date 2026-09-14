import { z } from 'zod';

/**
 * The content pack format -- single source of truth.
 *
 * The same schema validates packs at build time (scripts/validate-content.ts) and
 * at runtime when one is pasted into the import screen, so a pack that passes the
 * CLI cannot fail in the app.
 */

export const SCHEMA_VERSION = 1;

// --- Levels -----------------------------------------------------------------

export const levelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Level = z.infer<typeof levelSchema>;

export const LEVELS: Level[] = [1, 2, 3];

/** Question types the app can render and grade today. */
export const IMPLEMENTED_TYPES = [
  'mcq',
  'multi',
  'truefalse',
  'short',
  'numeric',
  'cloze',
  'flashcard',
] as const;

/**
 * Reserved for a later pass. These parse (so a pack authored ahead of time is not
 * lost) but the validator rejects them, rather than the app silently skipping a
 * question the student was supposed to answer.
 */
export const RESERVED_TYPES = ['match', 'order', 'categorize', 'hotspot', 'openResponse'] as const;

export type ImplementedType = (typeof IMPLEMENTED_TYPES)[number];
export type ReservedType = (typeof RESERVED_TYPES)[number];

// --- Shared pieces ----------------------------------------------------------

const id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids must be lowercase kebab-case (a-z, 0-9, -)');

/**
 * Text comparison rules for free-text answers.
 *
 * foldDiacritics defaults to FALSE on purpose: folding would make "far" match
 * "får" and "hall" match "håll", which in Swedish is a wrong answer marked
 * correct. It stays opt-in per question, for the rare case where it is right.
 */
export const normalizeOptionsSchema = z
  .object({
    ignoreCase: z.boolean().default(true),
    ignorePunctuation: z.boolean().default(true),
    collapseWhitespace: z.boolean().default(true),
    foldDiacritics: z.boolean().default(false),
  })
  .default({});

export type NormalizeOptions = z.infer<typeof normalizeOptionsSchema>;

const baseQuestion = {
  id,
  topicId: id,
  level: levelSchema,
  prompt: z.string().min(1),
  hint: z.string().min(1).optional(),
  points: z.number().positive().default(1),
  assetId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
};

/**
 * Required on every graded type. The explanation is what makes this a study tool
 * rather than a test -- a wrong answer with no explanation teaches nothing.
 */
const explanation = z.string().min(1, 'every question needs an explanation');

const optionSchema = z.object({
  id,
  text: z.string().min(1),
  assetId: z.string().min(1).optional(),
});

// --- Implemented question types ---------------------------------------------

export const mcqSchema = z.object({
  ...baseQuestion,
  type: z.literal('mcq'),
  explanation,
  options: z.array(optionSchema).min(2),
  answer: id,
  shuffle: z.boolean().default(true),
});

export const multiSchema = z.object({
  ...baseQuestion,
  type: z.literal('multi'),
  explanation,
  options: z.array(optionSchema).min(2),
  answers: z.array(id).min(1),
  shuffle: z.boolean().default(true),
});

export const trueFalseSchema = z.object({
  ...baseQuestion,
  type: z.literal('truefalse'),
  explanation,
  /** The prompt is the statement being judged. */
  answer: z.boolean(),
});

export const shortSchema = z.object({
  ...baseQuestion,
  type: z.literal('short'),
  explanation,
  /** All spellings/phrasings counted as correct. The first is shown as "the" answer. */
  accept: z.array(z.string().min(1)).min(1),
  normalize: normalizeOptionsSchema,
  /** Allow one typo in words longer than 4 chars. Off by default so a wrong term is never accepted. */
  spellingTolerance: z.boolean().default(false),
  placeholder: z.string().optional(),
});

export const numericSchema = z.object({
  ...baseQuestion,
  type: z.literal('numeric'),
  explanation,
  answer: z.number(),
  /** Absolute tolerance, e.g. 0.5 accepts 41.5-42.5 for 42. */
  tolerance: z.number().min(0).default(0),
  /** Relative tolerance in percent. If both are given, the more generous wins. */
  tolerancePercent: z.number().min(0).optional(),
  unit: z.string().optional(),
  /** When a unit is set, whether a bare number is still accepted. */
  acceptUnitless: z.boolean().default(true),
});

export const CLOZE_BLANK_RE = /\{\{([a-z0-9-]+)\}\}/g;

export const clozeBlankSchema = z.object({
  id,
  accept: z.array(z.string().min(1)).min(1),
  /** When present the blank renders as a dropdown instead of a text field. */
  options: z.array(z.string().min(1)).min(2).optional(),
  normalize: normalizeOptionsSchema,
  spellingTolerance: z.boolean().default(false),
});

export const clozeSchema = z.object({
  ...baseQuestion,
  type: z.literal('cloze'),
  explanation,
  /** Prompt contains {{blankId}} markers, e.g. "Kriget bröt ut {{ar}}." */
  blanks: z.array(clozeBlankSchema).min(1),
});

export const flashcardSchema = z.object({
  ...baseQuestion,
  type: z.literal('flashcard'),
  /** Prompt is the front. Self-rated, so there is nothing to auto-grade. */
  back: z.string().min(1),
  explanation: z.string().min(1).optional(),
});

// --- Reserved types ---------------------------------------------------------

export const reservedSchema = z
  .object({
    ...baseQuestion,
    type: z.enum(RESERVED_TYPES),
  })
  .passthrough();

// --- The question union -----------------------------------------------------

const questionUnion = z.discriminatedUnion('type', [
  mcqSchema,
  multiSchema,
  trueFalseSchema,
  shortSchema,
  numericSchema,
  clozeSchema,
  flashcardSchema,
  reservedSchema,
]);

/**
 * Per-type structural checks.
 *
 * These live here rather than on each type's schema because Zod's
 * discriminatedUnion only accepts plain objects -- a `.superRefine()` on a member
 * turns it into a ZodEffects and breaks discrimination (and with it the good
 * "unknown type" error messages). One refinement on top of the union keeps both.
 */
function checkQuestion(q: z.infer<typeof questionUnion>, ctx: z.RefinementCtx): void {
  switch (q.type) {
    case 'mcq': {
      const ids = q.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: 'custom', message: 'option ids must be unique', path: ['options'] });
      }
      if (!ids.includes(q.answer)) {
        ctx.addIssue({
          code: 'custom',
          message: `answer "${q.answer}" is not one of the options (${ids.join(', ')})`,
          path: ['answer'],
        });
      }
      break;
    }

    case 'multi': {
      const ids = q.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({ code: 'custom', message: 'option ids must be unique', path: ['options'] });
      }
      if (new Set(q.answers).size !== q.answers.length) {
        ctx.addIssue({ code: 'custom', message: 'answers must be unique', path: ['answers'] });
      }
      for (const a of q.answers) {
        if (!ids.includes(a)) {
          ctx.addIssue({
            code: 'custom',
            message: `answer "${a}" is not one of the options (${ids.join(', ')})`,
            path: ['answers'],
          });
        }
      }
      if (q.answers.length === q.options.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'every option is correct -- that is not a real question',
          path: ['answers'],
        });
      }
      break;
    }

    case 'numeric': {
      if (q.tolerancePercent !== undefined && q.answer === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'tolerancePercent is meaningless when the answer is 0 -- use tolerance',
          path: ['tolerancePercent'],
        });
      }
      break;
    }

    case 'cloze': {
      const inPrompt = [...q.prompt.matchAll(CLOZE_BLANK_RE)].map((m) => m[1]);
      const declared = q.blanks.map((b) => b.id);

      if (new Set(declared).size !== declared.length) {
        ctx.addIssue({ code: 'custom', message: 'blank ids must be unique', path: ['blanks'] });
      }
      for (const marker of inPrompt) {
        if (!declared.includes(marker)) {
          ctx.addIssue({
            code: 'custom',
            message: `prompt has {{${marker}}} but no blank declares id "${marker}"`,
            path: ['prompt'],
          });
        }
      }
      for (const b of declared) {
        if (!inPrompt.includes(b)) {
          ctx.addIssue({
            code: 'custom',
            message: `blank "${b}" is declared but {{${b}}} never appears in the prompt`,
            path: ['blanks'],
          });
        }
      }
      // A dropdown whose options omit the answer is unanswerable.
      q.blanks.forEach((b, i) => {
        if (b.options && !b.options.some((o) => b.accept.includes(o))) {
          ctx.addIssue({
            code: 'custom',
            message: `dropdown options for blank "${b.id}" contain none of its accepted answers`,
            path: ['blanks', i, 'options'],
          });
        }
      });
      break;
    }

    default:
      break;
  }
}

export const questionSchema = questionUnion.superRefine(checkQuestion);

export type Question = z.infer<typeof questionSchema>;
export type McqQuestion = z.infer<typeof mcqSchema>;
export type MultiQuestion = z.infer<typeof multiSchema>;
export type TrueFalseQuestion = z.infer<typeof trueFalseSchema>;
export type ShortQuestion = z.infer<typeof shortSchema>;
export type NumericQuestion = z.infer<typeof numericSchema>;
export type ClozeQuestion = z.infer<typeof clozeSchema>;
export type FlashcardQuestion = z.infer<typeof flashcardSchema>;

export function isImplemented(q: Question): q is Exclude<Question, { type: ReservedType }> {
  return (IMPLEMENTED_TYPES as readonly string[]).includes(q.type);
}

/**
 * Whether a question counts towards a score.
 *
 * The single source of truth for this. Flashcards are self-rated, so including
 * them would let the student grade her own test; reserved types cannot be
 * rendered at all. Everything that builds a session, counts questions or totals
 * a score asks here rather than restating the rule.
 */
export function isGradable(q: Question): boolean {
  return isImplemented(q) && q.type !== 'flashcard';
}

// --- Pack -------------------------------------------------------------------

export const topicSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string().optional(),
});

export const studyNoteSchema = z.object({
  id,
  topicId: id,
  title: z.string().min(1),
  markdown: z.string().min(1),
});

export const quizSchema = z.object({
  id,
  title: z.string().min(1),
  level: levelSchema.optional(),
  description: z.string().optional(),
  timeLimitMinutes: z.number().positive().optional(),
  questionIds: z.array(id).min(1),
});

export const packSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    id,
    subject: z.string().min(1),
    title: z.string().min(1),
    /** BCP-47-ish. Content language, independent of the Swedish UI. */
    language: z.string().min(2).default('sv'),
    grade: z.string().optional(),
    description: z.string().optional(),
    /** Free-text note to the author about where this came from. Not shown to the student. */
    source: z.string().optional(),
    createdAt: z.string().optional(),
    topics: z.array(topicSchema).min(1),
    /** assetId -> relative path under content/assets/, or a data: URI for imported packs. */
    assets: z.record(z.string().min(1)).default({}),
    studyNotes: z.array(studyNoteSchema).default([]),
    questions: z.array(questionSchema).min(1),
    quizzes: z.array(quizSchema).default([]),
  })
  .superRefine((pack, ctx) => {
    const topicIds = new Set(pack.topics.map((t) => t.id));
    const questionIds = new Set<string>();

    const seenTopicIds = new Set<string>();
    pack.topics.forEach((t, i) => {
      if (seenTopicIds.has(t.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate topic id "${t.id}"`,
          path: ['topics', i, 'id'],
        });
      }
      seenTopicIds.add(t.id);
    });

    pack.questions.forEach((q, i) => {
      if (questionIds.has(q.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate question id "${q.id}"`,
          path: ['questions', i, 'id'],
        });
      }
      questionIds.add(q.id);

      if (!topicIds.has(q.topicId)) {
        ctx.addIssue({
          code: 'custom',
          message: `question "${q.id}" references unknown topic "${q.topicId}"`,
          path: ['questions', i, 'topicId'],
        });
      }
      if (q.assetId && !(q.assetId in pack.assets)) {
        ctx.addIssue({
          code: 'custom',
          message: `question "${q.id}" references unknown asset "${q.assetId}"`,
          path: ['questions', i, 'assetId'],
        });
      }
      if ('options' in q && Array.isArray(q.options)) {
        q.options.forEach((o, oi) => {
          if (o.assetId && !(o.assetId in pack.assets)) {
            ctx.addIssue({
              code: 'custom',
              message: `option "${o.id}" references unknown asset "${o.assetId}"`,
              path: ['questions', i, 'options', oi, 'assetId'],
            });
          }
        });
      }
    });

    pack.studyNotes.forEach((n, i) => {
      if (!topicIds.has(n.topicId)) {
        ctx.addIssue({
          code: 'custom',
          message: `study note "${n.id}" references unknown topic "${n.topicId}"`,
          path: ['studyNotes', i, 'topicId'],
        });
      }
    });

    const seenQuizIds = new Set<string>();
    pack.quizzes.forEach((qz, i) => {
      if (seenQuizIds.has(qz.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate quiz id "${qz.id}"`,
          path: ['quizzes', i, 'id'],
        });
      }
      seenQuizIds.add(qz.id);
      qz.questionIds.forEach((qid, qi) => {
        if (!questionIds.has(qid)) {
          ctx.addIssue({
            code: 'custom',
            message: `quiz "${qz.id}" references unknown question "${qid}"`,
            path: ['quizzes', i, 'questionIds', qi],
          });
        }
      });
    });
  });

export type Pack = z.infer<typeof packSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type StudyNote = z.infer<typeof studyNoteSchema>;
export type Quiz = z.infer<typeof quizSchema>;

// --- Validation used by every entry point ----------------------------------

/** Flatten Zod issues to "path -- message" lines. Used wherever a pack is parsed. */
export function formatIssues(error: z.ZodError, limit = 10): string[] {
  return error.issues
    .slice(0, limit)
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'} -- ${i.message}`);
}

export type PackValidation =
  | { ok: true; pack: Pack }
  | { ok: false; errors: string[] };

/**
 * The gate every pack must pass, wherever it arrives from.
 *
 * Schema plus the implemented-types check. Keeping these together is the point:
 * `packSchema` alone accepts reserved types (so a pack authored ahead of time is
 * not lost), which means a bare `safeParse` would let the import screen install
 * questions the app cannot render and the grader would mark wrong unanswered.
 */
export function validatePack(raw: unknown, limit = 10): PackValidation {
  const parsed = packSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error, limit) };

  const unsupported = parsed.data.questions.filter(
    (q) => !(IMPLEMENTED_TYPES as readonly string[]).includes(q.type),
  );

  if (unsupported.length > 0) {
    return {
      ok: false,
      errors: unsupported.map(
        (q) =>
          `questions.${q.id} -- type "${q.type}" is reserved but not implemented yet ` +
          `(implemented: ${IMPLEMENTED_TYPES.join(', ')})`,
      ),
    };
  }

  return { ok: true, pack: parsed.data };
}
