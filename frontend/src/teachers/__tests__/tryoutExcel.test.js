/* global describe, test, expect */
import * as XLSX from 'xlsx';
import { EXCEL_TEMPLATES, parseTryoutExcel } from '../components/lesson-plan-builder/tryoutExcel';

const fileFrom = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Questions');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return { arrayBuffer: async () => buf };
};

describe('tryout Excel bulk upload', () => {
  test.each(Object.keys(EXCEL_TEMPLATES))('template example for %s parses into a question', async (type) => {
    const tpl = EXCEL_TEMPLATES[type];
    const { questions, errors } = await parseTryoutExcel(fileFrom([tpl.headers, ...tpl.example]), type);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ type });
    expect(questions[0].id).toBeTruthy();
  });

  test('mcq maps the correct letter to an option index', async () => {
    const tpl = EXCEL_TEMPLATES.mcq;
    const { questions } = await parseTryoutExcel(fileFrom([tpl.headers, ['Q?', 'a', 'b', 'c', 'd', 'C', '']]), 'mcq');
    expect(questions[0]).toMatchObject({ question: 'Q?', options: ['a', 'b', 'c', 'd'], correctAnswer: 2 });
  });

  test('cloze blanks become the tokens the student view expects', async () => {
    const text = await parseTryoutExcel(fileFrom([EXCEL_TEMPLATES.cloze_text.headers, ['A ___ and a ___.', 'x', 'y', '', '']]), 'cloze_text');
    expect(text.questions[0]).toMatchObject({ text: 'A ${{input}} and a ${{input}}.', correctAnswers: ['x', 'y'] });
    const drag = await parseTryoutExcel(fileFrom([EXCEL_TEMPLATES.cloze_drag_drop.headers, ['The ___ sits.', 'cat, dog', 'dog']]), 'cloze_drag_drop');
    expect(drag.questions[0]).toMatchObject({ text: 'The ${{blank}} sits.', options: ['cat', 'dog'], correctAnswers: [1] });
  });

  test('bad rows are reported with their row number and good rows still import', async () => {
    const tpl = EXCEL_TEMPLATES.mcq;
    const { questions, errors } = await parseTryoutExcel(fileFrom([
      tpl.headers,
      ['Good', 'a', 'b', '', '', 'A', ''],
      ['No options', 'a', '', '', '', 'A', ''],
      ['Wrong letter', 'a', 'b', '', '', 'D', ''],
    ]), 'mcq');
    expect(questions).toHaveLength(1);
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
  });

  test('a file made from a different template is rejected', async () => {
    const { questions, errors } = await parseTryoutExcel(fileFrom([EXCEL_TEMPLATES.sort_list.headers, ...EXCEL_TEMPLATES.sort_list.example]), 'match_list');
    expect(questions).toHaveLength(0);
    expect(errors[0].message).toMatch(/template|pairs/i);
  });
});
