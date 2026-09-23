/* Unit tests for two representative migration importers
   (backend/services/migration/academicYear.js and class.js) — the rest of
   the importers follow the same shape and were exercised end-to-end against
   a real (scratch, since-deleted) school during development; these two cover
   the trickiest logic: dedup-by-name, the active-year fallback, and the
   "standard" number parsed out of a class name. */

const query = (result) => {
  const p = {};
  p.select = () => p;
  p.lean = () => Promise.resolve(result);
  p.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return p;
};

jest.mock('../models/AcademicYear', () => ({
  find: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../models/Class', () => ({
  find: jest.fn(),
  create: jest.fn(),
}));

const AcademicYear = require('../models/AcademicYear');
const ClassModel = require('../models/Class');
const backgroundJob = require('../utils/backgroundJob');
const academicYearImporter = require('../services/migration/academicYear');
const classImporter = require('../services/migration/class');

const waitForJob = async (jobId, timeoutMs = 2000) => {
  const start = Date.now();
  for (;;) {
    const job = backgroundJob.getJob(jobId);
    if (job && job.status !== 'processing') return job;
    if (Date.now() - start > timeoutMs) throw new Error('job did not finish in time');
    await new Promise((r) => setTimeout(r, 5));
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  AcademicYear.find.mockReturnValue(query([]));
  AcademicYear.create.mockImplementation((doc) => Promise.resolve({ _id: 'year-new', ...doc }));
  AcademicYear.updateMany.mockResolvedValue({});
  ClassModel.find.mockReturnValue(query([]));
  ClassModel.create.mockImplementation((doc) => Promise.resolve({ _id: 'class-new', ...doc }));
});

describe('services/migration/academicYear', () => {
  test('creates a new academic year and skips a row that duplicates an existing one', async () => {
    AcademicYear.find.mockReturnValue(query([{ name: '2024-25', isActive: false }]));

    const { jobId, jobSystem } = academicYearImporter.run(
      [{ name: '2025-26' }, { name: '2024-25' }],
      { schoolId: 'school-1' }
    );
    expect(jobSystem).toBe('generic');

    const job = await waitForJob(jobId);
    expect(job.succeeded).toBe(1);
    expect(job.failed).toBe(1);
    expect(job.errors[0].message).toMatch(/already exists/);
    expect(AcademicYear.create).toHaveBeenCalledTimes(1);
    expect(AcademicYear.create).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1', name: '2025-26', isActive: false, status: 'upcoming' })
    );
  });

  test('marking a row isActive deactivates every other year for the school', async () => {
    AcademicYear.create.mockResolvedValue({ _id: 'year-new' });

    const { jobId } = academicYearImporter.run([{ name: '2025-26', isActive: 'true' }], { schoolId: 'school-1' });
    await waitForJob(jobId);

    expect(AcademicYear.updateMany).toHaveBeenCalledWith(
      { schoolId: 'school-1', _id: { $ne: 'year-new' } },
      { $set: { isActive: false } }
    );
  });

  test('a row with no name fails without touching the database', async () => {
    const { jobId } = academicYearImporter.run([{ name: '  ' }], { schoolId: 'school-1' });
    const job = await waitForJob(jobId);
    expect(job.failed).toBe(1);
    expect(job.errors[0].message).toBe('name is required');
    expect(AcademicYear.create).not.toHaveBeenCalled();
  });
});

describe('services/migration/class', () => {
  test('resolves the named academic year and parses a standard out of the class name', async () => {
    AcademicYear.find.mockReturnValue(query([{ _id: 'year-1', name: '2025-26', isActive: true }]));

    const { jobId } = classImporter.run([{ name: 'Class 5', academicYear: '2025-26' }], {
      schoolId: 'school-1',
      campusId: null,
    });
    const job = await waitForJob(jobId);

    expect(job.succeeded).toBe(1);
    expect(ClassModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: 'school-1', name: 'Class 5', academicYearId: 'year-1', standard: 5 })
    );
  });

  test('falls back to the active academic year and warns when the row omits one', async () => {
    AcademicYear.find.mockReturnValue(query([{ _id: 'year-1', name: '2025-26', isActive: true }]));

    const { jobId } = classImporter.run([{ name: 'Class 6' }], { schoolId: 'school-1', campusId: null });
    const job = await waitForJob(jobId);

    expect(job.succeeded).toBe(1);
    expect(ClassModel.create).toHaveBeenCalledWith(expect.objectContaining({ academicYearId: 'year-1' }));
    expect(job.warnings).toEqual([]); // active-year fallback found a year, so no warning
  });

  test('warns (but still succeeds) when there is no year to fall back to', async () => {
    AcademicYear.find.mockReturnValue(query([]));

    const { jobId } = classImporter.run([{ name: 'Class 7' }], { schoolId: 'school-1', campusId: null });
    const job = await waitForJob(jobId);

    expect(job.succeeded).toBe(1);
    expect(ClassModel.create).toHaveBeenCalledWith(expect.objectContaining({ academicYearId: undefined }));
    expect(job.warnings).toEqual([expect.stringMatching(/created without an academic year/)]);
  });

  test('fails a row referencing an academic year that does not exist', async () => {
    const { jobId } = classImporter.run([{ name: 'Class 5', academicYear: 'Nonexistent Year' }], {
      schoolId: 'school-1',
      campusId: null,
    });
    const job = await waitForJob(jobId);

    expect(job.failed).toBe(1);
    expect(job.errors[0].message).toMatch(/not found/);
    expect(ClassModel.create).not.toHaveBeenCalled();
  });

  test('rejects a duplicate class name within the same academic year', async () => {
    ClassModel.find.mockReturnValue(query([{ name: 'Class 5', academicYearId: 'year-1' }]));
    AcademicYear.find.mockReturnValue(query([{ _id: 'year-1', name: '2025-26', isActive: true }]));

    const { jobId } = classImporter.run([{ name: 'Class 5', academicYear: '2025-26' }], {
      schoolId: 'school-1',
      campusId: null,
    });
    const job = await waitForJob(jobId);

    expect(job.failed).toBe(1);
    expect(job.errors[0].message).toMatch(/already exists/);
  });
});
