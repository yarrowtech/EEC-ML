const express = require('express');
const request = require('supertest');

const mockRedisIncr = jest.fn();

jest.mock('../utils/redisClient', () => ({
  client: {
    isOpen: true,
    incr: (...args) => mockRedisIncr(...args),
    pExpire: jest.fn(),
  },
}));

jest.mock('../utils/securityEventLogger', () => ({
  logSecurityEvent: jest.fn(),
}));

const rateLimit = require('../middleware/rateLimit');

describe('student rate limiting without Redis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the in-memory limiter and never calls Redis', async () => {
    const app = express();
    app.get('/student-resource', rateLimit({
      windowMs: 60 * 1000,
      max: 1,
      useRedis: false,
      keyGenerator: () => 'student-1',
    }), (_req, res) => res.json({ ok: true }));

    const first = await request(app).get('/student-resource');
    const second = await request(app).get('/student-resource');

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(mockRedisIncr).not.toHaveBeenCalled();
  });

  test('supports request-aware Redis bypass for global API limiters', async () => {
    const app = express();
    app.get('/student-global-resource', rateLimit({
      max: 2,
      useRedis: () => false,
      keyGenerator: () => 'student-global-1',
    }), (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/student-global-resource');

    expect(response.status).toBe(200);
    expect(mockRedisIncr).not.toHaveBeenCalled();
  });
});
