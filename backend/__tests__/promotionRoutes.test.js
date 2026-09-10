jest.mock('../middleware/adminAuth', () => (req, res, next) => {
  req.admin = { _id: 'admin-1', schoolId: '507f1f77bcf86cd799439011' };
  req.schoolId = '507f1f77bcf86cd799439011';
  next();
});

const mockStudentUser = {
  find: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
};
jest.mock('../models/StudentUser', () => mockStudentUser);

const mockExamResult = {
  find: jest.fn(),
};
jest.mock('../models/ExamResult', () => mockExamResult);

const mockPromotionHistory = {
  create: jest.fn(),
  find: jest.fn(),
};
jest.mock('../models/PromotionHistory', () => mockPromotionHistory);

const mockAuditLog = {
  create: jest.fn(),
};
jest.mock('../models/AuditLog', () => mockAuditLog);

const mockChatProvisioning = {
  syncAllocationGroupThreads: jest.fn(),
  syncTimetableGroupThreads: jest.fn(),
};
jest.mock('../utils/chatGroupProvisioning', () => mockChatProvisioning);

const mockParentArchiveSync = {
  syncParentArchiveStatusForStudents: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../utils/parentArchiveSync', () => mockParentArchiveSync);

const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const PromotionHistory = require('../models/PromotionHistory');
const {
  syncAllocationGroupThreads,
  syncTimetableGroupThreads,
} = require('../utils/chatGroupProvisioning');
const promotionRoutes = require('../routes/promotionRoutes');

const createFindChain = (rows) => {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(rows);
  return chain;
};

const createExamChain = (rows) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(rows);
  return chain;
};

const resetMocks = () => {
  Object.values(StudentUser).forEach((fn) => fn.mockReset());
  ExamResult.find.mockReset();
  PromotionHistory.create.mockReset();
  syncAllocationGroupThreads.mockReset();
  syncTimetableGroupThreads.mockReset();
};

const SCHOOL_ID = '507f1f77bcf86cd799439011';

const findRouteHandler = (method, path) => {
  const layer = promotionRoutes.stack.find(
    (stackLayer) =>
      stackLayer.route && stackLayer.route.path === path && stackLayer.route.methods[method]
  );
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
};

const invokeRoute = async (method, path, { body, query, params } = {}) => {
  const handler = findRouteHandler(method, path);
  const req = {
    body: body || {},
    query: query || {},
    params: params || {},
    admin: { _id: 'admin-1' },
    schoolId: SCHOOL_ID,
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await handler(req, res);
  return res;
};

describe('promotionRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  test('POST /preview requires fromClass', async () => {
    const res = await invokeRoute('post', '/preview');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/fromClass is required/i);
    expect(StudentUser.find).not.toHaveBeenCalled();
  });

  test('POST /preview returns filtered students', async () => {
    const students = [{ _id: '507f1f77bcf86cd799439012', name: 'Student A' }];
    StudentUser.find.mockReturnValue(createFindChain(students));

    const res = await invokeRoute('post', '/preview', {
      body: { fromClass: 'Class 5', fromSection: 'A', fromAcademicYear: '2024-25' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ students, count: 1 });
    expect(StudentUser.find).toHaveBeenCalledWith(
      expect.objectContaining({
        grade: 'Class 5',
        section: 'A',
        academicYear: '2024-25',
      })
    );
  });

  test('POST /preview-marks aggregates percentages and eligible ids', async () => {
    const students = [
      { _id: '507f1f77bcf86cd799439013', name: 'Eligible' },
      { _id: '507f1f77bcf86cd799439014', name: 'Ineligible' },
    ];
    StudentUser.find.mockReturnValue(createFindChain(students));
    ExamResult.find.mockReturnValue(
      createExamChain([
        { studentId: students[0]._id, examId: { marks: 100 }, marks: 80, published: true },
        { studentId: students[1]._id, examId: { marks: 100 }, marks: 40, published: true },
      ])
    );

    const res = await invokeRoute('post', '/preview-marks', {
      body: { fromClass: 'Class 5', minPercentage: 60 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.eligibleIds).toEqual([students[0]._id]);
    expect(res.body.students[0]._id).toBe(students[0]._id);
    expect(ExamResult.find).toHaveBeenCalled();
  });

  test('POST /execute promotes students in bulk mode', async () => {
    const studentIds = ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'];
    StudentUser.find.mockImplementationOnce(() =>
      createFindChain(studentIds.map((_id) => ({ _id })))
    );
    StudentUser.updateMany.mockResolvedValue({ modifiedCount: studentIds.length });
    PromotionHistory.create.mockResolvedValue({ _id: 'history-1' });
    syncAllocationGroupThreads.mockResolvedValue();
    syncTimetableGroupThreads.mockResolvedValue();

    const res = await invokeRoute('post', '/execute', {
      body: {
        studentIds,
        toClass: 'Class 6',
        fromClass: 'Class 5',
        type: 'bulk',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      promoted: studentIds.length,
      matched: studentIds.length,
      skipped: 0,
    });
    expect(StudentUser.updateMany).toHaveBeenCalledWith(
      { _id: { $in: studentIds }, schoolId: SCHOOL_ID },
      { $set: { grade: 'Class 6' } }
    );
    expect(PromotionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fromClass: 'Class 5',
        toClass: 'Class 6',
        studentIds,
        studentCount: studentIds.length,
        type: 'bulk',
      })
    );
  });
});
