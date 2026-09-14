/**
 * Every string the student sees, in one place.
 *
 * The interface is Swedish; question content is whatever language the pack is in,
 * so an English pack renders English questions inside this Swedish chrome.
 *
 * Tone: talking to a 15-year-old. Direct and encouraging, not babyish and not
 * corporate. No exclamation marks on wrong answers.
 */
export const sv = {
  appName: 'HomeTutor',
  tagline: 'Plugga smartare',

  nav: {
    home: 'Hem',
    back: 'Tillbaka',
  },

  home: {
    greeting: 'Dags att plugga',
    noContent: 'Inget material än',
    noContentHelp:
      'Ämnen läggs till som en fil på den här enheten. Har du fått en pack-fil skickad till dig väljer du den här.',
    noContentAction: 'Lägg till ett ämne',
    continue: 'Fortsätt där du slutade',
    subjects: 'Ämnen',
    questionCount: (n: number) => `${n} frågor`,
    topicCount: (n: number) => (n === 1 ? '1 område' : `${n} områden`),
  },

  subject: {
    practice: 'Öva',
    practiceHelp: 'Svara i din egen takt och få förklaringen direkt.',
    test: 'Prov',
    testHelp: 'Alla frågor först, rättning efteråt.',
    flashcards: 'Snabbrepetition',
    flashcardsHelp: 'Korta kort du bedömer själv.',
    notes: 'Läs',
    notesHelp: 'Sammanfattningar av materialet.',
    chooseLevel: 'Välj nivå',
    chooseTopics: 'Välj områden',
    allTopics: 'Alla områden',
    readyQuestions: (n: number) => `${n} frågor redo`,
    noQuestionsHere: 'Inga frågor med de här valen',
    savedTests: 'Färdiga prov',
  },

  level: {
    1: 'Nivå 1',
    2: 'Nivå 2',
    3: 'Nivå 3',
    name: { 1: 'Grunder', 2: 'Förståelse', 3: 'Analys' },
    description: {
      1: 'Fakta, årtal, personer och begrepp.',
      2: 'Förklara, jämföra och tillämpa.',
      3: 'Analysera, värdera och resonera.',
    },
  },

  session: {
    question: (n: number, total: number) => `Fråga ${n} av ${total}`,
    check: 'Rätta',
    next: 'Nästa',
    finish: 'Avsluta',
    submitTest: 'Lämna in',
    skip: 'Hoppa över',
    showHint: 'Visa ledtråd',
    hint: 'Ledtråd',
    explanation: 'Förklaring',
    correctAnswer: 'Rätt svar',
    correct: 'Rätt',
    partial: 'Delvis rätt',
    incorrect: 'Fel',
    typoAccepted: 'Godkänt trots stavfelet',
    timeLeft: 'Tid kvar',
    exitConfirm: 'Avbryta? Det du svarat hittills sparas inte.',
    exit: 'Avbryt',
    unansweredWarning: (n: number) =>
      n === 1 ? '1 fråga är obesvarad.' : `${n} frågor är obesvarade.`,
    submitAnyway: 'Lämna in ändå',
  },

  question: {
    mcqHelp: 'Välj ett alternativ',
    multiHelp: 'Välj alla som stämmer',
    truefalseHelp: 'Stämmer påståendet?',
    true: 'Sant',
    false: 'Falskt',
    shortHelp: 'Skriv ditt svar',
    numericHelp: 'Skriv ett tal',
    clozeHelp: 'Fyll i luckorna',
    flashcardHelp: 'Tänk efter, vänd sedan på kortet',
    flip: 'Vänd på kortet',
    rate: 'Hur gick det?',
    rating: {
      again: 'Kunde inte',
      hard: 'Svårt',
      good: 'Bra',
      easy: 'Lätt',
    },
    selectPlaceholder: 'Välj…',
    blankLabel: (n: number) => `Lucka ${n}`,
    unsupportedType: (type: string) =>
      `Frågetypen "${type}" stöds inte i den här versionen av appen.`,
  },

  result: {
    title: 'Resultat',
    score: (earned: number, max: number) => `${earned} av ${max} poäng`,
    percent: (p: number) => `${p} %`,
    byTopic: 'Per område',
    review: 'Gå igenom frågorna',
    practiceWrong: 'Öva på det du missade',
    backToSubject: 'Till ämnet',
    praise: {
      high: 'Snyggt jobbat.',
      mid: 'På god väg.',
      low: 'Det här behöver mer träning.',
    },
    nextLevelSuggestion: (level: number) => `Du är redo för nivå ${level}.`,
  },

  progress: {
    title: 'Framsteg',
    streak: 'Dagar i rad',
    longestStreak: 'Längsta svit',
    totalAnswered: 'Besvarade frågor',
    average: 'Snitt',
    mastery: 'Kunskapsläge',
    weakSpots: 'Träna på det här',
    noWeakSpots: 'Inget som sticker ut just nu.',
    history: 'Historik',
    empty: 'Här dyker din statistik upp när du har övat en stund.',
    dueForReview: (n: number) => `${n} kort att repetera`,
  },

  notes: {
    title: 'Läsa',
    empty: 'Det finns inga anteckningar för det här ämnet.',
  },

  data: {
    title: 'Dina data',
    explanation:
      'Allt du gör sparas bara i den här webbläsaren. Rensar du webbläsarens data, byter telefon eller öppnar appen på en annan adress försvinner historiken. Spara en säkerhetskopia då och då.',
    export: 'Spara säkerhetskopia',
    exportDone: 'Säkerhetskopian är nedladdad.',
    import: 'Läs in säkerhetskopia',
    strategy: 'Hur vill du läsa in?',
    merge: 'Slå ihop',
    mergeHelp: 'Lägger till det som saknas. Inget du gjort försvinner. Rekommenderas.',
    replace: 'Ersätt allt',
    replaceHelp: 'Raderar historiken på den här enheten och använder filen i stället.',
    replaceConfirm:
      'Detta raderar all historik på den här enheten. En säkerhetskopia laddas ner först. Fortsätta?',
    importedSummary: (added: number, total: number) =>
      `Inläst. ${added} nya försök, ${total} totalt.`,
    importedPacks: (n: number) => (n === 1 ? '1 nytt ämne inläst.' : `${n} nya ämnen inlästa.`),
    reset: 'Nollställ allt',
    resetConfirm:
      'Detta raderar all din historik på den här enheten. En säkerhetskopia laddas ner först. Fortsätta?',
    resetDone: 'Historiken är nollställd.',
    errors: {
      json: 'Filen går inte att läsa. Är det rätt fil?',
      kind: 'Det där ser inte ut som en HomeTutor-säkerhetskopia.',
      version: 'Filen kommer från en nyare version av appen. Uppdatera appen först.',
      schema: 'Filen är skadad och kan inte läsas in.',
      storageFull: 'Lagringsutrymmet är fullt. Spara en säkerhetskopia och nollställ historiken.',
    },
  },

  importScreen: {
    title: 'Importera innehåll',
    lead: 'Välj en pack-fil (JSON) för att lägga till ett ämne på den här enheten.',
    chooseFile: 'Välj fil…',
    orPaste: 'eller klistra in innehållet nedan',
    fileError: (msg: string) => `Filen kunde inte läsas: ${msg}`,
    placeholder: 'Klistra in JSON här…',
    validate: 'Kontrollera',
    save: 'Lägg till ämne',
    valid: (title: string, n: number) => `Ser bra ut: ${title}, ${n} frågor.`,
    invalid: 'Paketet kan inte läsas in:',
    saved: 'Ämnet är tillagt.',
    installed: 'Ämnen på den här enheten',
    bundled: 'Följer med appen',
    imported: 'Tillagt här',
    remove: 'Ta bort',
    removeConfirm: 'Ta bort ämnet från den här enheten?',
    contentIssues: 'Innehåll som inte kunde läsas',
  },

  common: {
    notFound: 'Hittades inte',
    notFoundHelp: 'Sidan eller ämnet finns inte.',
    goHome: 'Till startsidan',
  },
} as const;

/** Round a 0..1 mastery score to a percentage for display. */
export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

const RELATIVE_DAY = ['idag', 'igår', 'i förrgår'];

/** Human-friendly Swedish date for the history list. */
export function formatDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days >= 0 && days < RELATIVE_DAY.length) return RELATIVE_DAY[days];
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
