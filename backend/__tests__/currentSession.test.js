const mockFindOne = jest.fn();
jest.mock('../models/AcademicYear', () => ({ findOne: (...args) => mockFindOne(...args) }));

const {
  getCurrentSessionName, sessionStudentClause, withSession, attachCurrentSession, clearCurrentSessionCache,
} = require('../utils/currentSession');

const yearQuery = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

beforeEach(() => { mockFindOne.mockReset(); clearCurrentSessionCache(); });

test('reads the active academic year name and caches it per school', async () => {
  mockFindOne.mockReturnValue(yearQuery({ name: ' 2026-27 ' }));
  expect(await getCurrentSessionName('s1')).toBe('2026-27');
  expect(await getCurrentSessionName('s1')).toBe('2026-27');
  expect(mockFindOne).toHaveBeenCalledTimes(1);
  expect(mockFindOne).toHaveBeenCalledWith({ schoolId: 's1', isActive: true });
});

test('session clause keeps this session + students with no session, not the next session', () => {
  const clause = sessionStudentClause('2026-27');
  const matches = (academicYear) => clause.$or.some((c) => {
    if (c.academicYear instanceof RegExp) return typeof academicYear === 'string' && c.academicYear.test(academicYear);
    if (c.academicYear?.$in) return c.academicYear.$in.includes(academicYear);
    if (c.academicYear?.$exists === false) return academicYear === undefined;
    return false;
  });
  expect(matches('2026-27')).toBe(true);
  expect(matches('2026-27'.toUpperCase())).toBe(true);
  expect(matches('')).toBe(true);
  expect(matches(null)).toBe(true);
  expect(matches(undefined)).toBe(true);
  expect(matches('2027-28')).toBe(false); // next session — excluded
  expect(matches('2026-27x')).toBe(false);
});

test('withSession adds the clause without overwriting the filter\'s own $or', () => {
  const base = { schoolId: 's1', $or: [{ grade: '5' }, { grade: 'Class 5' }] };
  const out = withSession(base, sessionStudentClause('2026-27'));
  expect(out.$or).toEqual(base.$or);
  expect(out.$and).toHaveLength(1);
  expect(withSession(base, null)).toBe(base); // no active year → unchanged
});

test('middleware never blocks the request when the lookup fails', async () => {
  mockFindOne.mockImplementation(() => { throw new Error('db down'); });
  const req = { schoolId: 's2' };
  const next = jest.fn();
  await attachCurrentSession(req, {}, next);
  expect(req.sessionClause).toBeNull();
  expect(next).toHaveBeenCalled();
});
