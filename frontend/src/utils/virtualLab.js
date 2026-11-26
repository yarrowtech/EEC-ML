// Virtual Lab: experiment data shape, the Seed Germination template, and the
// simulation rules shared by the teacher builder (preview) and the student player.
//
// Experiment shape (stored on a lesson-plan chapter as chapter.labExperiments[]):
// {
//   id, title, kind: 'germination' | 'steps', objective, materials: [string],
//   stages: [{ title, instruction }],              // what the student does, in order
//   jars: [{ name, water: 0|1|2, air: bool, warm: bool, light: bool }],   // germination only
//   totalDays, days: [{ day, observation }],       // what happens each simulated day
//   conclusion, questions: [{ question, options: [string], correctAnswer: index }],
//   xp: { complete, observations, quiz },
// }

import { isAllowedSimUrl } from './simulationCatalog';

export const newLabId = () => `lab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const WATER_LEVELS = ['No water', 'Moist', 'Too much water'];

export const SEED_GERMINATION_TEMPLATE = () => ({
  id: newLabId(),
  kind: 'germination',
  title: 'How Does a Seed Germinate?',
  objective: 'To understand the conditions required for seed germination and observe the different stages of seed growth.',
  materials: ['Bean or gram seeds', 'Transparent glass jar', 'Cotton wool', 'Water', 'Sunlight', 'Virtual observation notebook'],
  stages: [
    { title: 'Select a seed', instruction: 'Choose a bean or gram seed for your experiment.' },
    { title: 'Prepare the jar', instruction: 'Place cotton inside a transparent jar and put the seeds on it.' },
    { title: 'Add water', instruction: 'Add water so the cotton is moist — not flooded.' },
    { title: 'Observe growth', instruction: 'Move forward day by day and watch the root and shoot appear.' },
    { title: 'Record observations', instruction: 'Write what you see in your notebook and name the parts of the seedling.' },
  ],
  jars: [
    { name: 'Jar A – Water + Air + Warmth', water: 1, air: true, warm: true, light: true },
    { name: 'Jar B – No Water', water: 0, air: true, warm: true, light: true },
    { name: 'Jar C – Too Much Water', water: 2, air: false, warm: true, light: true },
    { name: 'Jar D – No Light', water: 1, air: true, warm: true, light: false },
  ],
  totalDays: 7,
  days: [
    { day: 1, observation: 'Seed absorbs water and swells.' },
    { day: 2, observation: 'Seed coat begins to split.' },
    { day: 3, observation: 'A small root emerges.' },
    { day: 4, observation: 'The root grows longer.' },
    { day: 5, observation: 'The shoot begins to emerge.' },
    { day: 6, observation: 'The seedling grows upward.' },
    { day: 7, observation: 'The first leaves become visible.' },
  ],
  conclusion: 'Seeds need water, air and suitable warmth to germinate. Sunlight is not essential for the first stage of germination, but it is important for healthy growth after the seedling comes out.',
  questions: [
    { question: 'What is seed germination?', options: ['A seed growing into a young plant', 'A seed drying in the sun', 'A flower making seeds', 'A leaf falling off'], correctAnswer: 0 },
    { question: 'Why does a seed need water?', options: ['To make it heavier', 'To soften the seed coat and start growth', 'To change its colour', 'It does not need water'], correctAnswer: 1 },
    { question: 'Which part of the seed grows into the root?', options: ['Plumule', 'Seed coat', 'Radicle', 'Cotyledon'], correctAnswer: 2 },
    { question: 'Does a seed need sunlight to begin germination?', options: ['Yes, always', 'No, not for the first stage', 'Only at night', 'Only in winter'], correctAnswer: 1 },
    { question: 'What happens if a seed gets too much water and not enough air?', options: ['It grows faster', 'It germinates poorly or rots', 'It turns into a flower', 'Nothing changes'], correctAnswer: 1 },
  ],
  xp: { complete: 10, observations: 5, quiz: 10 },
});

export const BLANK_EXPERIMENT = () => ({
  id: newLabId(),
  kind: 'steps',
  title: '',
  objective: '',
  materials: [],
  stages: [{ title: '', instruction: '' }],
  jars: [],
  totalDays: 0,
  days: [],
  conclusion: '',
  questions: [],
  xp: { complete: 10, observations: 5, quiz: 10 },
});

/** 'good' | 'poor' | 'none' — what a jar's conditions lead to. */
export const jarOutcome = (jar) => {
  if (!jar) return 'none';
  if (jar.water === 0 || !jar.warm) return 'none'; // no water / too cold → no germination
  if (jar.water === 2 || !jar.air) return 'poor'; // flooded → little air → poor germination
  return 'good'; // light does not matter for germination itself
};

export const OUTCOME_LABEL = { good: 'Germination expected', poor: 'Poor germination', none: 'No germination' };

/**
 * Growth stage 0–7 shown for a jar on a given day.
 * good → follows the days; poor → slower and stops at a small root; none → stays a seed.
 */
export const growthStage = (jar, day) => {
  const d = Math.max(0, Number(day) || 0);
  const outcome = jarOutcome(jar);
  if (outcome === 'none') return d >= 1 && jar?.water > 0 ? 1 : 0;
  if (outcome === 'poor') return Math.min(3, Math.floor(d / 2));
  return Math.min(7, d);
};

/** Short description of what a jar looks like on a day. */
export const jarObservation = (experiment, jar, day) => {
  const stage = growthStage(jar, day);
  if (day <= 0) return 'Seeds placed. Nothing has happened yet.';
  const outcome = jarOutcome(jar);
  if (outcome === 'none') return jar?.water === 0 ? 'The seed is dry and unchanged.' : 'The seed is cold — no change.';
  if (outcome === 'poor' && stage < 3) return 'The seed is soaked; very little change.';
  if (outcome === 'poor') return 'A weak root appeared, but growth has stopped (not enough air).';
  const fromDays = (experiment?.days || []).find((x) => Number(x.day) === stage);
  const base = fromDays?.observation || `Growth stage ${stage}.`;
  return !jar?.light && stage >= 6 ? `${base} The shoot is pale and thin (no light).` : base;
};

/** XP earned for a finished run. */
export const labXp = (experiment, { completed, observationsCount, quizCorrect, quizTotal }) => {
  const xp = experiment?.xp || {};
  let total = 0;
  if (completed) total += Number(xp.complete) || 0;
  if (observationsCount >= 3) total += Number(xp.observations) || 0;
  if (quizTotal > 0 && quizCorrect === quizTotal) total += Number(xp.quiz) || 0;
  return total;
};

/** Experiment has enough content to be shown to students. */
export const isExperimentReady = (exp) => {
  if (!String(exp?.title || '').trim()) return false;
  // Imported third-party simulation: needs an approved, embeddable link.
  if (exp?.kind === 'embed') return isAllowedSimUrl(exp.simUrl);
  return (exp?.stages || []).some((s) => String(s?.title || '').trim());
};
