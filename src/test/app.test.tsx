import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { upsertImportedPack } from '@/storage/packs';
import { loadProgress } from '@/storage/progress';
import { attemptScore } from '@/engine/progress';
import { realPack } from '@/test/fixtures';

/**
 * End-to-end walkthrough of the real app.
 *
 * These drive the same code paths a person clicking through would: the router,
 * the state container, localStorage, the question components and the grading
 * engine, with only the browser chrome replaced by jsdom.
 */

/**
 * The shipped build has no bundled content -- packs are generated from her
 * teachers' material, stay out of the repo, and reach the app through the import
 * screen. So the tests install one the same way a person does, rather than
 * relying on content that is no longer committed.
 *
 * Runs after the global setup's IndexedDB reset, so each test still starts from
 * exactly one known pack.
 */
beforeEach(async () => {
  await upsertImportedPack(realPack);
});

function setup() {
  return { user: userEvent.setup(), ...render(<App />) };
}

/** Wait past the async IndexedDB load of imported packs. */
async function waitForHome() {
  await screen.findByText('Andra världskriget');
}

beforeEach(() => {
  window.location.hash = '#/';
});

describe('home screen', () => {
  it('lists the bundled pack under its subject', async () => {
    setup();
    await waitForHome();

    expect(screen.getByRole('heading', { name: 'Historia' })).toBeInTheDocument();
    // Question count and topic count share one paragraph, so scope to it --
    // otherwise every ancestor element matches too.
    expect(
      screen.getByText(
        `${realPack.questions.length} frågor · ${realPack.topics.length} områden`,
        { selector: 'p' },
      ),
    ).toBeInTheDocument();
  });

  it('is in Swedish', async () => {
    setup();
    await waitForHome();
    expect(screen.getByText('Dags att plugga')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Framsteg/ })).toBeInTheDocument();
  });
});

describe('navigating to a subject', () => {
  it('shows topics, all three levels and the four actions', async () => {
    const { user } = setup();
    await waitForHome();

    await user.click(screen.getByText('Andra världskriget'));

    expect(await screen.findByText('Krigets orsaker')).toBeInTheDocument();
    expect(screen.getByText('Grunder')).toBeInTheDocument();
    expect(screen.getByText('Förståelse')).toBeInTheDocument();
    expect(screen.getByText('Analys')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Öva/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prov/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Snabbrepetition/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Läs/ })).toBeInTheDocument();
  });

  it('lists the curated tests', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));

    expect(await screen.findByText('Nivå 1 – Grunder')).toBeInTheDocument();
    expect(screen.getByText('Nivå 3 – Analys')).toBeInTheDocument();
  });
});

describe('practice mode', () => {
  /** Start the nivå 1 quiz, which begins with a known multiple-choice question. */
  async function startLevel1Quiz(user: ReturnType<typeof userEvent.setup>) {
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 1 – Grunder'));
  }

  it('marks a correct answer, explains it, and moves on', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));

    // Narrow to level 1 so the first question is predictable, then practise.
    await user.click(screen.getByText('Grunder'));
    await user.click(screen.getByRole('button', { name: /Öva/ }));

    // Rätta is disabled until something is answered.
    const check = await screen.findByRole('button', { name: 'Rätta' });
    expect(check).toBeDisabled();

    expect(screen.getByText(/Fråga 1 av/)).toBeInTheDocument();
  });

  it('grades the first quiz question and shows the explanation', async () => {
    const { user } = setup();
    await startLevel1Quiz(user);

    // The nivå 1 quiz starts with q-start-datum: "Vilken händelse räknas som
    // starten på andra världskriget i Europa?"
    expect(
      await screen.findByText(/Vilken händelse räknas som starten/),
    ).toBeInTheDocument();

    // It is a test, so there is no Rätta button -- feedback comes at the end.
    expect(screen.queryByRole('button', { name: 'Rätta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nästa' })).toBeInTheDocument();
  });
});

describe('taking a full test end to end', () => {
  it('answers every question correctly and scores 100 %', async () => {
    const { user } = setup();
    await waitForHome();

    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 1 – Grunder'));

    const quiz = realPack.quizzes.find((q) => q.id === 'prov-niva-1')!;

    for (let i = 0; i < quiz.questionIds.length; i++) {
      const question = realPack.questions.find((q) => q.id === quiz.questionIds[i])!;
      await answerCorrectly(user, question);

      const last = i === quiz.questionIds.length - 1;
      await user.click(screen.getByRole('button', { name: last ? 'Lämna in' : 'Nästa' }));
    }

    // Result screen.
    expect(await screen.findByText('Resultat')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Snyggt jobbat.')).toBeInTheDocument();

    // And it was written to storage, with the score the engine computed.
    const saved = loadProgress();
    expect(saved.attempts).toHaveLength(1);
    expect(attemptScore(saved.attempts[0]).percent).toBe(100);
  });

  it('scores a deliberately wrong test at 0 % and offers the wrong answers for practice', async () => {
    const { user } = setup();
    await waitForHome();

    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 1 – Grunder'));

    const quiz = realPack.quizzes.find((q) => q.id === 'prov-niva-1')!;

    for (let i = 0; i < quiz.questionIds.length; i++) {
      const question = realPack.questions.find((q) => q.id === quiz.questionIds[i])!;
      await answerIncorrectly(user, question);
      const last = i === quiz.questionIds.length - 1;
      await user.click(screen.getByRole('button', { name: last ? 'Lämna in' : 'Nästa' }));
    }

    expect(await screen.findByText('Resultat')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Det här behöver mer träning.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Öva på det du missade/ })).toBeInTheDocument();
  });

  it('warns before submitting with unanswered questions', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 3 – Analys'));

    const quiz = realPack.quizzes.find((q) => q.id === 'prov-niva-3')!;

    // Click straight through without answering anything.
    for (let i = 0; i < quiz.questionIds.length - 1; i++) {
      await user.click(screen.getByRole('button', { name: 'Nästa' }));
    }

    await user.click(screen.getByRole('button', { name: 'Lämna in' }));
    expect(await screen.findByText(/frågor är obesvarade/)).toBeInTheDocument();

    // Confirming goes through.
    await user.click(screen.getByRole('button', { name: 'Lämna in ändå' }));
    expect(await screen.findByText('Resultat')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows the review with every question and its explanation', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 3 – Analys'));

    const quiz = realPack.quizzes.find((q) => q.id === 'prov-niva-3')!;
    for (let i = 0; i < quiz.questionIds.length; i++) {
      const last = i === quiz.questionIds.length - 1;
      await user.click(screen.getByRole('button', { name: last ? 'Lämna in' : 'Nästa' }));
    }
    await user.click(await screen.findByRole('button', { name: 'Lämna in ändå' }));

    await user.click(await screen.findByRole('button', { name: 'Gå igenom frågorna' }));

    // Every question from the quiz is present, each with an explanation.
    expect(await screen.findAllByText('Förklaring')).toHaveLength(quiz.questionIds.length);
  });
});

describe('progress screen', () => {
  it('reflects a finished test', async () => {
    const { user } = setup();
    await waitForHome();

    await user.click(screen.getByText('Andra världskriget'));
    await user.click(await screen.findByText('Nivå 1 – Grunder'));

    const quiz = realPack.quizzes.find((q) => q.id === 'prov-niva-1')!;
    for (let i = 0; i < quiz.questionIds.length; i++) {
      const question = realPack.questions.find((q) => q.id === quiz.questionIds[i])!;
      await answerCorrectly(user, question);
      await user.click(
        screen.getByRole('button', { name: i === quiz.questionIds.length - 1 ? 'Lämna in' : 'Nästa' }),
      );
    }
    await screen.findByText('Resultat');

    await user.click(screen.getByRole('link', { name: /Framsteg/ }));

    expect(await screen.findByText('Kunskapsläge')).toBeInTheDocument();
    expect(screen.getByText('Historik')).toBeInTheDocument();
    // One day of practice -> a streak of 1.
    expect(screen.getByText('Dagar i rad')).toBeInTheDocument();
  });

  it('shows the data section with export and import', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByRole('link', { name: /Framsteg/ }));

    expect(await screen.findByText('Dina data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spara säkerhetskopia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Läs in säkerhetskopia' })).toBeInTheDocument();
    // Merge is preselected, because it is the non-destructive option.
    expect(screen.getByRole('button', { name: /Slå ihop/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('import screen', () => {
  it('rejects a pack that is not valid, with a readable reason', async () => {
    const { user } = setup();
    window.location.hash = '#/import';

    const box = await screen.findByPlaceholderText(/Klistra in JSON/);
    await user.click(box);
    await user.paste(JSON.stringify({ schemaVersion: 1, id: 'trasig' }));

    await user.click(screen.getByRole('button', { name: 'Kontrollera' }));

    expect(await screen.findByText(/kan inte läsas in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lägg till ämne' })).toBeDisabled();
  });

  it('accepts a pack chosen as a file, validating it without a separate click', async () => {
    const { user } = setup();
    window.location.hash = '#/import';

    const extra = { ...realPack, id: 'fil-pack', title: 'Ämne från fil', subject: 'Geografi' };
    const file = new File([JSON.stringify(extra)], 'geografi.json', { type: 'application/json' });

    // The label is the control on a phone; the input behind it is visually hidden.
    const input = (await screen.findByText('Välj fil…')).closest('label')!.querySelector('input')!;
    await user.upload(input, file);

    // Picking a file validates straight away -- no "Kontrollera" click.
    expect(await screen.findByText(/Ser bra ut: Ämne från fil/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lägg till ämne' }));
    expect(await screen.findByText('Ämnet är tillagt.')).toBeInTheDocument();

    window.location.hash = '#/';
    await waitFor(async () => {
      expect(await screen.findByText('Ämne från fil')).toBeInTheDocument();
    });
  });

  it('reports a file that is not valid JSON instead of failing silently', async () => {
    const { user } = setup();
    window.location.hash = '#/import';

    const file = new File(['inte json alls'], 'trasig.json', { type: 'application/json' });
    const input = (await screen.findByText('Välj fil…')).closest('label')!.querySelector('input')!;
    await user.upload(input, file);

    expect(await screen.findByText(/kan inte läsas in/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lägg till ämne' })).toBeDisabled();
  });

  it('accepts a valid pack and adds it to the app', async () => {
    const { user } = setup();
    window.location.hash = '#/import';

    const extra = { ...realPack, id: 'extra-pack', title: 'Ett extra ämne', subject: 'Geografi' };

    const box = await screen.findByPlaceholderText(/Klistra in JSON/);
    await user.click(box);
    await user.paste(JSON.stringify(extra));

    await user.click(screen.getByRole('button', { name: 'Kontrollera' }));
    expect(await screen.findByText(/Ser bra ut: Ett extra ämne/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lägg till ämne' }));
    expect(await screen.findByText('Ämnet är tillagt.')).toBeInTheDocument();

    // It now shows up on the home screen without a rebuild.
    window.location.hash = '#/';
    await waitFor(async () => {
      expect(await screen.findByText('Ett extra ämne')).toBeInTheDocument();
    });
  });

  it('marks an imported pack as imported and lets it be removed', async () => {
    setup();
    window.location.hash = '#/import';

    // Scoped to this pack's own row rather than the whole list: a dev machine
    // still has packs sitting in content/packs/ (gitignored, not deleted), so
    // they get bundled locally even though a clean checkout builds an empty
    // shell. The test must not depend on which of those happen to be present.
    await screen.findByText('Ämnen på den här enheten');
    const row = screen.getByText(realPack.title).closest('div')!.parentElement!;
    expect(within(row).getByText(/Tillagt här/)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Ta bort' })).toBeInTheDocument();
  });
});

describe('study notes', () => {
  it('renders the markdown notes', async () => {
    const { user } = setup();
    await waitForHome();
    await user.click(screen.getByText('Andra världskriget'));
    await user.click(screen.getByRole('button', { name: /Läs/ }));

    expect(await screen.findByText('Varför bröt kriget ut?')).toBeInTheDocument();
    // Markdown headings became real elements.
    expect(screen.getByRole('heading', { name: 'Kort sammanfattning' })).toBeInTheDocument();
  });
});

// --- Helpers ----------------------------------------------------------------

type Q = (typeof realPack)['questions'][number];

/** Answer a question correctly, whatever its type. */
async function answerCorrectly(user: ReturnType<typeof userEvent.setup>, q: Q) {
  switch (q.type) {
    case 'mcq': {
      const correct = q.options.find((o) => o.id === q.answer)!;
      await user.click(await screen.findByText(correct.text));
      break;
    }
    case 'multi': {
      for (const id of q.answers) {
        const option = q.options.find((o) => o.id === id)!;
        await user.click(await screen.findByText(option.text));
      }
      break;
    }
    case 'truefalse':
      await user.click(await screen.findByRole('button', { name: q.answer ? /Sant/ : /Falskt/ }));
      break;
    case 'short':
      await user.type(await screen.findByLabelText('Skriv ditt svar'), q.accept[0]);
      break;
    case 'numeric':
      await user.type(await screen.findByLabelText('Skriv ett tal'), String(q.answer));
      break;
    case 'cloze': {
      for (let i = 0; i < q.blanks.length; i++) {
        const blank = q.blanks[i];
        const field = await screen.findByLabelText(`Lucka ${i + 1}`);
        if (blank.options) await user.selectOptions(field, blank.accept[0]);
        else await user.type(field, blank.accept[0]);
      }
      break;
    }
    default:
      break;
  }
}

/** Answer a question wrongly, whatever its type. */
async function answerIncorrectly(user: ReturnType<typeof userEvent.setup>, q: Q) {
  switch (q.type) {
    case 'mcq': {
      const wrong = q.options.find((o) => o.id !== q.answer)!;
      await user.click(await screen.findByText(wrong.text));
      break;
    }
    case 'multi': {
      const wrong = q.options.find((o) => !q.answers.includes(o.id))!;
      await user.click(await screen.findByText(wrong.text));
      break;
    }
    case 'truefalse':
      await user.click(await screen.findByRole('button', { name: q.answer ? /Falskt/ : /Sant/ }));
      break;
    case 'short':
      await user.type(await screen.findByLabelText('Skriv ditt svar'), 'fel svar');
      break;
    case 'numeric':
      await user.type(await screen.findByLabelText('Skriv ett tal'), String(q.answer + 1000));
      break;
    case 'cloze': {
      for (let i = 0; i < q.blanks.length; i++) {
        const blank = q.blanks[i];
        const field = await screen.findByLabelText(`Lucka ${i + 1}`);
        if (blank.options) {
          const wrong = blank.options.find((o) => !blank.accept.includes(o));
          if (wrong) await user.selectOptions(field, wrong);
        } else {
          await user.type(field, 'fel');
        }
      }
      break;
    }
    default:
      break;
  }
}
