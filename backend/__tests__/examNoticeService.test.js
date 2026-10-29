jest.mock('../utils/formalNoticeCommon', () => ({
  ...jest.requireActual('../utils/formalNoticeCommon'),
  buildNoticePdfAttachment: jest.fn(),
}));

const { buildDocument } = require('../services/examNoticeService');

const school = { name: 'Kelomal Santoshini High School', address: 'Barasat' };
const groups = [
  { _id: 'g6a', classId: { name: '6' }, sectionId: { name: 'A' }, startDate: '2026-10-05', endDate: '2026-10-31' },
  { _id: 'g5b', classId: { name: '5' }, sectionId: { name: 'B' }, startDate: '2026-10-05', endDate: '2026-10-31' },
  { _id: 'g5a', classId: { name: '5' }, sectionId: { name: 'A' }, startDate: '2026-10-05', endDate: '2026-10-31' },
];
const exams = [
  { groupId: 'g5a', subject: 'Maths', date: '2026-10-07', time: '10:00', duration: 60 },
  { groupId: 'g5a', subject: 'English', date: '2026-10-05', time: '10:00', duration: 60 },
  { groupId: 'g6a', subjectId: { name: 'Science' }, date: '2026-10-09', time: '10:00', duration: 60 },
];
const base = { title: 'Class Test 2', session: { name: '2026-2027' }, school, noticeNo: 'KSHS/2026-27/EXAM/001', publishedAt: new Date('2026-09-25') };

describe('exam notice document', () => {
  it('scheduled notice: dates only, routine to be published soon, no times or tables', () => {
    const doc = buildDocument({ ...base, kind: 'scheduled', groups, exams });
    const details = Object.fromEntries(doc.details.map((d) => [d.label, d.value]));

    expect(doc.salutation).toBe('Dear Students and Parents/Guardians,');
    expect(doc.subject).toBe('CLASS TEST 2 – 2026–2027');
    expect(doc.paragraphs[0]).toContain('**Class Test 2** for the Academic Session **2026–2027**');
    expect(doc.paragraphs[0]).toContain('will be held from **05 October 2026** to **09 October 2026**');
    expect(doc.paragraphs[1]).toContain('will be published soon');
    expect(details.Classes).toBe('5, 6');
    expect(details.Sections).toBeUndefined();
    expect(doc.variants.student).toEqual({ salutation: 'Dear Student,', sections: [doc.sections[0]] });
    expect(doc.variants.parent).toEqual({ salutation: 'Dear Parent/Guardian,', sections: [doc.sections[1]] });
    expect(details.Routine).toBe('Will be published soon');
    expect(details['Reporting Time']).toBeUndefined();
    expect(doc.tables).toBeUndefined();
  });

  it('class routine notice: only that class/section table and its own details', () => {
    const doc = buildDocument({ ...base, kind: 'routineClass', groups: [groups[2]], exams: exams.filter((e) => e.groupId === 'g5a') });
    const details = Object.fromEntries(doc.details.map((d) => [d.label, d.value]));

    expect(doc.paragraphs[0]).toContain('for **Class 5, Section A**');
    expect(doc.variants.parent.salutation).toBe('Dear Parent/Guardian,');
    expect(details.Class).toBe('5');
    expect(details.Section).toBe('A');
    expect(details['Examination From']).toBe('05 October 2026');
    expect(details['Examination To']).toBe('07 October 2026');
    expect(details['Examination Time']).toBe('10:00 AM – 11:00 AM');
    expect(doc.tables.map((t) => t.title)).toEqual(['Class 5 – Section A']);
    expect(doc.tables[0].rows.map((r) => r[2])).toEqual(['English', 'Maths']);
    expect(doc.tables[0].rows[0]).toEqual(['05 Oct 2026', 'Monday', 'English', '10:00 AM – 11:00 AM', '60 min']);
  });

  it('consolidated routine (staff): every class with exams, sorted', () => {
    const doc = buildDocument({ ...base, kind: 'routine', groups, exams });
    expect(doc.tables.map((t) => t.title)).toEqual(['Class 5 – Section A', 'Class 6 – Section A']);
    expect(doc.sections[0].title).toBe('For Teachers:');
  });

  it('says "As per the examination routine" when exam slots differ', () => {
    const mixed = [...exams, { groupId: 'g6a', subject: 'Art', date: '2026-10-10', time: '12:00', duration: 90 }];
    const doc = buildDocument({ ...base, kind: 'routine', groups, exams: mixed });
    expect(doc.details.find((d) => d.label === 'Examination Time').value).toBe('As per the examination routine');
  });
});
