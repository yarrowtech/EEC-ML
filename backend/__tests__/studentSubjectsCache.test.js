const mockGetNumber = jest.fn();
const mockIncrement = jest.fn();

jest.mock('../utils/redisClient', () => ({
  getNumber: (...args) => mockGetNumber(...args),
  increment: (...args) => mockIncrement(...args),
}));

const {
  getStudentSubjectsCacheKey,
  invalidateStudentSubjectsCache,
} = require('../utils/studentSubjectsCache');

describe('student subjects Redis cache isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNumber.mockResolvedValue(0);
    mockIncrement.mockResolvedValue(undefined);
  });

  const sharedScope = {
    organizationId: 'org-1',
    schoolId: 'school-1',
    campusId: 'campus-1',
    classId: 'class-1',
    sectionId: 'section-1',
  };

  test('generates different keys for two students in the same class', async () => {
    const firstKey = await getStudentSubjectsCacheKey({
      ...sharedScope,
      studentId: 'student-1',
    });
    const secondKey = await getStudentSubjectsCacheKey({
      ...sharedScope,
      studentId: 'student-2',
    });

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain('student:student-1');
    expect(secondKey).toContain('student:student-2');
  });

  test('generates different keys for different tenants and schools', async () => {
    const firstKey = await getStudentSubjectsCacheKey({
      ...sharedScope,
      studentId: 'student-1',
    });
    const otherTenantKey = await getStudentSubjectsCacheKey({
      ...sharedScope,
      organizationId: 'org-2',
      schoolId: 'school-2',
      studentId: 'student-1',
    });

    expect(firstKey).not.toBe(otherTenantKey);
  });

  test('invalidates only the affected class and section scope', async () => {
    await invalidateStudentSubjectsCache(sharedScope);

    expect(mockIncrement).toHaveBeenCalledWith(
      'cache:v1:student-subjects:version:org-1:school-1:campus-1:class-1:section-1'
    );
  });
});
