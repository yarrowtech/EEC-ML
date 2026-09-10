/**
 * Recommendation routes: the router registers under Express 5 (no legacy regex
 * param syntax), served recommendations carry a tracking id, and the
 * accept/dismiss/complete + history endpoints are wired to the impact service.
 */
jest.mock('../middleware/authStudent', () => (req, _res, next) => {
  req.user = { id: 'stud1' };
  req.schoolId = 'school1';
  next();
});

const mockImpact = {
  recordIssued: jest.fn(),
  recordDecision: jest.fn(),
  measureRecommendationImpact: jest.fn(),
  summarize: jest.fn(() => ({ total: 0 })),
};
jest.mock('../services/recommendationImpactService', () => mockImpact);

const leanChain = (value) => {
  const chain = {
    select: () => chain, sort: () => chain, limit: () => chain, populate: () => chain,
    lean: () => Promise.resolve(value),
    then: (res, rej) => Promise.resolve(value).then(res, rej),
  };
  return chain;
};
jest.mock('../models/MasteryScore', () => ({ find: () => leanChain([]), distinct: () => Promise.resolve([]) }));
jest.mock('../models/TeachingMaterial', () => ({ find: () => leanChain([]) }));
jest.mock('../models/SpacedRepetitionSchedule', () => ({ find: () => leanChain([]) }));
jest.mock('../models/RecommendationEvent', () => ({ find: () => leanChain([{ _id: 'r1', status: 'completed', masteryDelta: 12 }]) }));

const router = require('../routes/recommendationRoutes');

const handlerFor = (method, path) => {
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer) throw new Error(`route ${method} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const makeRes = () => ({
  statusCode: 200, body: null,
  status(c) { this.statusCode = c; return this; },
  json(p) { this.body = p; return this; },
});

beforeEach(() => jest.clearAllMocks());

test('router registers without throwing under Express 5', () => {
  expect(Array.isArray(router.stack)).toBe(true);
  const paths = router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
  expect(paths).toEqual(expect.arrayContaining(['GET /next', 'GET /history', 'POST /:id/:decision']));
});

test('GET /next attaches a tracking id from recordIssued', async () => {
  jest.doMock('../services/recommendationEngine', () => ({
    recommendNextTopic: jest.fn().mockResolvedValue({ recommendation: { type: 'gap_fill', topicTitle: 'Fractions', subject: 'Math' } }),
  }));
  mockImpact.recordIssued.mockResolvedValue({ _id: 'evt99', status: 'issued' });

  const res = makeRes();
  await handlerFor('get', '/next')({ user: { id: 'stud1' }, schoolId: 'school1', query: { subject: 'Math' } }, res);

  expect(res.body.data.id).toBe('evt99');
  expect(mockImpact.recordIssued).toHaveBeenCalled();
});

test('POST /:id/:decision rejects an unknown decision', async () => {
  const res = makeRes();
  await handlerFor('post', '/:id/:decision')(
    { user: { id: 'stud1' }, schoolId: 'school1', params: { id: '507f1f77bcf86cd799439011', decision: 'bogus' }, body: {} }, res
  );
  expect(res.statusCode).toBe(400);
  expect(mockImpact.recordDecision).not.toHaveBeenCalled();
});

test('POST /:id/:decision forwards a valid decision to the service', async () => {
  mockImpact.recordDecision.mockResolvedValue({ event: { _id: 'r1', status: 'accepted' } });
  const res = makeRes();
  await handlerFor('post', '/:id/:decision')(
    { user: { id: 'stud1' }, schoolId: 'school1', params: { id: '507f1f77bcf86cd799439011', decision: 'accept' }, body: {} }, res
  );
  expect(res.statusCode).toBe(200);
  expect(mockImpact.recordDecision).toHaveBeenCalledWith(expect.objectContaining({ decision: 'accept' }));
});

test('GET /history returns events and a summary', async () => {
  const res = makeRes();
  await handlerFor('get', '/history')({ user: { id: 'stud1' }, schoolId: 'school1', query: {} }, res);
  expect(res.body.success).toBe(true);
  expect(res.body.data).toHaveLength(1);
  expect(mockImpact.summarize).toHaveBeenCalled();
});
