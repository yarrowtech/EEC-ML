// Excel bulk upload for tryout questions — one sheet layout per question type.
// Teachers download a template for the type, fill one question per row and
// upload it; rows are converted into the same question objects the manual
// creators in TryoutBuilder.jsx produce.

const BLANK = /_{3,}/g; // teachers type ___ for a blank in sentences

const str = (v) => String(v ?? '').trim();
const list = (v) => str(v).split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
const toBool = (v) => {
  const s = str(v).toLowerCase();
  if (['true', 't', 'yes', 'y', '1'].includes(s)) return true;
  if (['false', 'f', 'no', 'n', '0'].includes(s)) return false;
  return null;
};
const letterIndex = (v) => {
  const s = str(v).toUpperCase();
  if (/^[A-F]$/.test(s)) return s.charCodeAt(0) - 65;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n - 1 : -1;
};
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const newId = (i) => `tryout-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;

export const EXCEL_TEMPLATES = {
  mcq: {
    headers: ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option (A-D)', 'Explanation'],
    example: [['What is the brain of the computer?', 'Monitor', 'CPU', 'Keyboard', 'Mouse', 'B', 'The CPU processes all instructions.']],
    help: 'One question per row. Fill at least two options and the correct letter.',
    toQuestion: (r) => {
      const options = ['Option A', 'Option B', 'Option C', 'Option D'].map((k) => str(r[k])).filter(Boolean);
      const correct = letterIndex(r['Correct Option (A-D)']);
      if (!str(r.Question)) return 'Question is empty';
      if (options.length < 2) return 'Needs at least 2 options';
      if (correct < 0 || correct >= options.length) return 'Correct Option must be a letter of a filled option';
      return { question: str(r.Question), options, correctAnswer: correct, explanation: str(r.Explanation), theme: 'standard' };
    },
  },
  choice_matrix: {
    headers: ['Question', ...range(5).flatMap((i) => [`Statement ${i}`, `Answer ${i} (True/False)`])],
    example: [['Mark each statement True or False', 'A mouse is an input device', 'True', 'A printer is an input device', 'False', '', '', '', '', '', '']],
    help: 'Up to 5 statements per row, each with True or False.',
    toQuestion: (r) => {
      const statements = []; const answers = [];
      for (const i of range(5)) {
        const s = str(r[`Statement ${i}`]);
        if (!s) continue;
        const a = toBool(r[`Answer ${i} (True/False)`]);
        if (a === null) return `Answer ${i} must be True or False`;
        statements.push(s); answers.push(a);
      }
      if (!statements.length) return 'Add at least one statement';
      return { question: str(r.Question) || 'Mark each statement True or False', statements, answers };
    },
  },
  cloze_text: {
    headers: ['Sentence (use ___ for each blank)', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4'],
    example: [['The ___ is used to type and the ___ is used to point.', 'keyboard', 'mouse', '', '']],
    help: 'Write ___ (three underscores) where the student types. Give one answer per blank, in order.',
    toQuestion: (r) => {
      const raw = str(r['Sentence (use ___ for each blank)']);
      const blanks = (raw.match(BLANK) || []).length;
      if (!blanks) return 'Sentence needs at least one ___ blank';
      const correctAnswers = range(blanks).map((i) => str(r[`Answer ${i}`]));
      if (correctAnswers.some((a) => !a)) return `Fill ${blanks} answer(s), one per blank`;
      return { text: raw.replace(BLANK, '${{input}}'), correctAnswers };
    },
  },
  cloze_dropdown: {
    headers: ['Sentence (use ___ for each blank)', ...range(3).flatMap((i) => [`Choices ${i} (comma separated)`, `Correct ${i}`])],
    example: [['A ___ shows output on screen.', 'Monitor, Keyboard, Scanner', 'Monitor', '', '', '', '']],
    help: 'Write ___ for each dropdown. For each blank give the choices (comma separated) and the correct one.',
    toQuestion: (r) => {
      const raw = str(r['Sentence (use ___ for each blank)']);
      const blanks = (raw.match(BLANK) || []).length;
      if (!blanks) return 'Sentence needs at least one ___ blank';
      const dropdownOptions = []; const correctAnswers = [];
      for (const i of range(blanks)) {
        const choices = list(r[`Choices ${i} (comma separated)`]);
        const correct = str(r[`Correct ${i}`]);
        if (choices.length < 2) return `Blank ${i} needs at least 2 choices`;
        if (!choices.some((c) => c.toLowerCase() === correct.toLowerCase())) return `Correct ${i} must be one of its choices`;
        dropdownOptions.push(choices);
        correctAnswers.push(choices.find((c) => c.toLowerCase() === correct.toLowerCase()));
      }
      return { text: raw.replace(BLANK, '${{input}}'), dropdownOptions, correctAnswers };
    },
  },
  cloze_drag_drop: {
    headers: ['Sentence (use ___ for each blank)', 'Word Bank (comma separated)', 'Correct Words in Order (comma separated)'],
    example: [['The ___ stores data and the ___ shows it.', 'hard disk, monitor, speaker', 'hard disk, monitor']],
    help: 'Write ___ for each blank. The correct words must come from the word bank, in blank order.',
    toQuestion: (r) => {
      const raw = str(r['Sentence (use ___ for each blank)']);
      const blanks = (raw.match(BLANK) || []).length;
      const options = list(r['Word Bank (comma separated)']);
      const correct = list(r['Correct Words in Order (comma separated)']);
      if (!blanks) return 'Sentence needs at least one ___ blank';
      if (options.length < blanks) return 'Word bank has fewer words than blanks';
      if (correct.length !== blanks) return `Give exactly ${blanks} correct word(s)`;
      const correctAnswers = correct.map((w) => options.findIndex((o) => o.toLowerCase() === w.toLowerCase()));
      if (correctAnswers.some((i) => i < 0)) return 'Every correct word must be in the word bank';
      return { text: raw.replace(BLANK, '${{blank}}'), options, hints: options.map(() => ''), correctAnswers, optionPosition: 'down' };
    },
  },
  match_list: {
    headers: ['Question', ...range(6).flatMap((i) => [`Left ${i}`, `Right ${i}`])],
    example: [['Match the device with its use', 'Keyboard', 'Typing', 'Printer', 'Printing', 'Speaker', 'Sound', '', '', '', '', '', '']],
    help: 'Up to 6 pairs per row. Each Left must have its matching Right.',
    toQuestion: (r) => {
      const items = []; const pairs = [];
      for (const i of range(6)) {
        const l = str(r[`Left ${i}`]); const rt = str(r[`Right ${i}`]);
        if (!l && !rt) continue;
        if (!l || !rt) return `Pair ${i} needs both Left and Right`;
        items.push(l); pairs.push(rt);
      }
      if (items.length < 2) return 'Add at least 2 pairs';
      return { question: str(r.Question) || 'Match the following', items, pairs };
    },
  },
  sort_list: {
    headers: ['Question', ...range(6).map((i) => `Item ${i} (correct order)`)],
    example: [['Arrange the steps to start a computer', 'Switch on the power', 'Press the power button', 'Wait for the desktop', 'Log in', '', '']],
    help: 'Write the items in the CORRECT order; students will see them shuffled.',
    toQuestion: (r) => {
      const items = range(6).map((i) => str(r[`Item ${i} (correct order)`])).filter(Boolean);
      if (!str(r.Question)) return 'Question is empty';
      if (items.length < 2) return 'Add at least 2 items';
      return { question: str(r.Question), items };
    },
  },
  plain_text: {
    headers: ['Question', 'Max Words'],
    example: [['Explain what a computer is in your own words.', 100]],
    help: 'Open answer. Max Words is optional.',
    toQuestion: (r) => (str(r.Question) ? { question: str(r.Question), maxWords: Number(r['Max Words']) || 10000 } : 'Question is empty'),
  },
  rich_text: {
    headers: ['Question', 'Max Words'],
    example: [['Write a short note on input devices.', 300]],
    help: 'Formatted answer. Max Words is optional.',
    toQuestion: (r) => (str(r.Question) ? { question: str(r.Question), maxWords: Number(r['Max Words']) || 300 } : 'Question is empty'),
  },
  file_upload: {
    headers: ['Question', 'Allowed Files (image, pdf, document)'],
    example: [['Upload a photo of your labelled computer diagram.', 'image, pdf']],
    help: 'Allowed files is optional (default: image, pdf, document).',
    toQuestion: (r) => {
      if (!str(r.Question)) return 'Question is empty';
      const allowed = list(r['Allowed Files (image, pdf, document)']).map((x) => x.toLowerCase()).filter((x) => ['image', 'pdf', 'document'].includes(x));
      return { question: str(r.Question), allowedTypes: allowed.length ? allowed : ['image', 'pdf', 'document'] };
    },
  },
  image_highlighter: {
    headers: ['Question', 'Image URL'],
    example: [['Highlight the CPU in this picture.', 'https://example.com/computer.png']],
    help: 'The image must be a public link (https://…).',
    toQuestion: (r) => {
      if (!str(r.Question)) return 'Question is empty';
      if (!/^https?:\/\//i.test(str(r['Image URL']))) return 'Image URL must start with http(s)://';
      return { question: str(r.Question), imageUrl: str(r['Image URL']) };
    },
  },
};

export const downloadTryoutTemplate = async (type, typeLabel = type) => {
  const tpl = EXCEL_TEMPLATES[type];
  if (!tpl) return;
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([tpl.headers, ...tpl.example]);
  ws['!cols'] = tpl.headers.map((h) => ({ wch: Math.max(14, Math.min(48, h.length + 4)) }));
  const help = XLSX.utils.aoa_to_sheet([
    [`How to fill: ${typeLabel}`],
    [tpl.help],
    ['Fill one question per row on the "Questions" sheet. Replace or delete the example row.'],
  ]);
  help['!cols'] = [{ wch: 100 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.utils.book_append_sheet(wb, help, 'How to fill');
  XLSX.writeFile(wb, `tryout_${type}_template.xlsx`);
};

// Returns { questions, errors: [{ row, message }] }.
export const parseTryoutExcel = async (file, type) => {
  const tpl = EXCEL_TEMPLATES[type];
  if (!tpl) return { questions: [], errors: [{ row: 0, message: 'This question type does not support Excel upload' }] };
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets.Questions || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const questions = []; const errors = [];
  rows.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1
    if (Object.values(row).every((v) => !str(v))) return;
    const missing = tpl.headers.filter((h) => !(h in row));
    if (missing.length === tpl.headers.length) { errors.push({ row: rowNo, message: 'Columns do not match the template' }); return; }
    const result = tpl.toQuestion(row);
    if (typeof result === 'string') errors.push({ row: rowNo, message: result });
    else questions.push({ id: newId(i), type, ...result });
  });
  return { questions, errors };
};
