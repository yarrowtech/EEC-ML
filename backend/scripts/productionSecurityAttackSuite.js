/* eslint-disable no-console */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const BASE_URL = process.env.API_BASE || 'http://localhost:5000';
const OUTPUT_PATH = path.join(__dirname, 'production-security-attack-report.json');
const SEED = Date.now();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const makeSchoolPayload = (suffix = 'default') => ({
  name: `Security Suite School ${suffix}`,
  campuses: [
    {
      name: `Main Campus ${suffix}`,
      address: '123 Main Campus Road, Kolkata, WB 700001',
      campusType: 'Main',
      contactPerson: 'Security Tester',
      contactPhone: '+919876543210',
    },
  ],
  officialEmail: `sec-suite-${suffix}@example.org`,
  contactPersonName: 'Security Test User',
  contactPhone: '+919876543211',
  address: '123 Main School Address, Kolkata, West Bengal 700001',
  schoolType: 'Private',
  board: 'CBSE',
  boardOther: '',
  academicYearStructure: 'Semester',
  estimatedUsers: '100-500',
  websiteURL: 'https://sec-suite.example.org',
  logo: { secure_url: 'https://example.org/logo.png' },
  verificationDocs: [{ secure_url: 'https://example.org/doc.pdf' }],
});

const parseResponse = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_err) {
    return text;
  }
};

const callJson = async ({
  method = 'GET',
  routePath,
  headers = {},
  body,
  includeRequestId = true,
  attackLabel,
}) => {
  const requestId = includeRequestId ? randomUUID() : undefined;
  const response = await fetch(`${BASE_URL}${routePath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(includeRequestId ? { 'x-request-id': requestId } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return {
    attackLabel: attackLabel || null,
    method,
    path: routePath,
    requestHeaders: headers,
    requestBody: body,
    status: response.status,
    responseBody: await parseResponse(response),
    responseRequestId: response.headers.get('x-request-id') || null,
    responseTraceId: response.headers.get('x-trace-id') || null,
  };
};

const callMalformedJson = ({ routePath, headers = {}, rawBody, attackLabel, includeRequestId = false }) =>
  new Promise((resolve) => {
    const target = new URL(`${BASE_URL}${routePath}`);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(includeRequestId ? { 'x-request-id': randomUUID() } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch (_err) {
            // Keep raw body
          }
          resolve({
            attackLabel: attackLabel || null,
            method: 'POST',
            path: routePath,
            requestHeaders: headers,
            requestBody: rawBody,
            status: res.statusCode || -1,
            responseBody: parsed,
            responseRequestId: res.headers['x-request-id'] || null,
            responseTraceId: res.headers['x-trace-id'] || null,
          });
        });
      }
    );
    req.on('error', (err) =>
      resolve({
        attackLabel: attackLabel || null,
        method: 'POST',
        path: routePath,
        requestHeaders: headers,
        requestBody: rawBody,
        status: -1,
        responseBody: { error: err.message },
        responseRequestId: null,
        responseTraceId: null,
      }));
    req.write(rawBody);
    req.end();
  });

const summarize = (calls) => {
  const byStatus = {};
  for (const call of calls) {
    byStatus[call.status] = (byStatus[call.status] || 0) + 1;
  }
  return {
    totalCalls: calls.length,
    byStatus,
    missingRequestIdCount: calls.filter((c) => !c.responseRequestId).length,
    missingTraceIdCount: calls.filter((c) => !c.responseTraceId).length,
  };
};

const run = async () => {
  const scenarios = [];

  const bruteIps = ['203.0.113.20', '203.0.113.21', '203.0.113.22', '203.0.113.23', '203.0.113.24'];
  const bruteCalls = [];
  for (let i = 0; i < 15; i += 1) {
    bruteCalls.push(await callJson({
      method: 'POST',
      routePath: '/api/admin/auth/login',
      headers: {
        'x-forwarded-for': randomFrom(bruteIps),
        'user-agent': `slow-brute/${i % 3}`,
      },
      body: { username: 'admin', password: `Invalid-${i}-${SEED}` },
      attackLabel: 'distributed_bruteforce',
    }));
    await wait(220);
  }
  scenarios.push({ name: 'distributed_bruteforce_low_and_slow', calls: bruteCalls, summary: summarize(bruteCalls) });

  const replayToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({
    sub: 'attacker-user-1',
    jti: `replay-${SEED}`,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url')}.deadbeef`;
  const replayCalls = [];
  const replayIps = ['198.51.100.90', '198.51.100.91', '198.51.100.92'];
  for (let i = 0; i < replayIps.length; i += 1) {
    replayCalls.push(await callJson({
      method: 'GET',
      routePath: '/api/super-admin/overview',
      headers: {
        authorization: `Bearer ${replayToken}`,
        'x-forwarded-for': replayIps[i],
        'user-agent': `token-replay/${i}`,
      },
      attackLabel: 'token_replay_multisource',
    }));
    await wait(100);
  }
  scenarios.push({ name: 'token_replay_multi_source', calls: replayCalls, summary: summarize(replayCalls) });

  const floodCalls = [];
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      callJson({
        method: 'POST',
        routePath: `/api/school-registration?flood=burst-${i}`,
        headers: {
          'x-forwarded-for': '198.51.100.200',
          'user-agent': `burst-flood/${i % 4}`,
        },
        body: makeSchoolPayload(`flood-${SEED}-${i}`),
        attackLabel: 'api_flood_burst',
      }).then((result) => floodCalls.push(result))
    )
  );
  scenarios.push({ name: 'api_flood_parallel_burst', calls: floodCalls, summary: summarize(floodCalls) });

  const xffBypassCalls = [];
  for (let i = 0; i < 12; i += 1) {
    xffBypassCalls.push(await callJson({
      method: 'POST',
      routePath: `/api/admin/auth/login?xff-rotate=${i}`,
      headers: {
        'x-forwarded-for': `10.0.0.${i}, 198.51.100.${100 + i}`,
        'user-agent': `xff-spoof-bypass/${i % 2}`,
      },
      body: { username: 'admin', password: `Spoofed-${i}` },
      attackLabel: 'xff_rate_limit_bypass',
    }));
    await wait(80);
  }
  scenarios.push({ name: 'rate_limit_bypass_xff_spoofing', calls: xffBypassCalls, summary: summarize(xffBypassCalls) });

  const injectionCalls = [];
  const polymorphicBodies = [
    { ...makeSchoolPayload(`xss-${SEED}`), name: '<img src=x onerror=alert(1)>' },
    { ...makeSchoolPayload(`nosql-${SEED}`), officialEmail: { $gt: '' } },
    { ...makeSchoolPayload(`sqli-${SEED}`), contactPersonName: "' OR '1'='1" },
    { ...makeSchoolPayload(`proto-${SEED}`), __proto__: { polluted: true } },
  ];
  for (let i = 0; i < polymorphicBodies.length; i += 1) {
    injectionCalls.push(await callJson({
      method: 'POST',
      routePath: '/api/school-registration',
      headers: {
        'x-forwarded-for': `203.0.113.${150 + i}`,
        'user-agent': `poly-injector/${i}`,
      },
      body: polymorphicBodies[i],
      attackLabel: 'polymorphic_injection',
    }));
  }
  scenarios.push({ name: 'injection_polymorphic_payloads', calls: injectionCalls, summary: summarize(injectionCalls) });

  const malformedCalls = [];
  for (let i = 0; i < 6; i += 1) {
    malformedCalls.push(await callMalformedJson({
      routePath: '/api/school-registration',
      headers: {
        'x-forwarded-for': `203.0.113.${200 + i}`,
        'user-agent': `malformed-json/${i}`,
      },
      rawBody: '{"name":"broken",',
      attackLabel: 'malformed_json_missing_request_id',
      includeRequestId: false,
    }));
  }
  scenarios.push({ name: 'malformed_json_without_request_id', calls: malformedCalls, summary: summarize(malformedCalls) });

  const stealthCalls = [];
  const stealthIps = ['198.18.0.1', '198.18.0.2', '198.18.0.3', '198.18.0.4', '198.18.0.5', '198.18.0.6'];
  for (let i = 0; i < 18; i += 1) {
    stealthCalls.push(await callJson({
      method: 'POST',
      routePath: '/api/admin/auth/login',
      headers: {
        'x-forwarded-for': randomFrom(stealthIps),
        'user-agent': 'stealth-distributed/1.0',
      },
      body: { username: 'super-admin', password: `drip-${i}` },
      attackLabel: 'stealth_distributed_drip',
    }));
    await wait(300 + (i % 4) * 70);
  }
  scenarios.push({ name: 'stealth_distributed_auth_drip', calls: stealthCalls, summary: summarize(stealthCalls) });

  const allCalls = scenarios.flatMap((s) => s.calls);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    objective: 'production-grade security testing and observability validation',
    attackMatrix: scenarios.map((s) => ({ scenario: s.name, summary: s.summary })),
    scenarios,
    aggregate: summarize(allCalls),
    correlation: {
      requestIds: allCalls.map((c) => c.responseRequestId).filter(Boolean),
      traceIds: allCalls.map((c) => c.responseTraceId).filter(Boolean),
      missingRequestIdCount: allCalls.filter((c) => !c.responseRequestId).length,
      missingTraceIdCount: allCalls.filter((c) => !c.responseTraceId).length,
    },
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await cleanupTestSchools();
};

/**
 * Remove the school registrations this suite created so they don't pollute
 * the Super Admin portal. Best-effort: skipped without MONGODB_URL, and any
 * failure is logged but never fails the run. Matches only the suite's own
 * naming (@example.org emails / "Security Suite School" names).
 */
const cleanupTestSchools = async () => {
  if (process.env.SKIP_SECURITY_SUITE_CLEANUP === '1') {
    console.warn('Skipping test-school cleanup (SKIP_SECURITY_SUITE_CLEANUP=1).');
    return;
  }
  if (!process.env.MONGODB_URL) {
    console.warn('Skipping test-school cleanup: MONGODB_URL not set. Run scripts/cleanupSecuritySuiteSchools.js --apply manually.');
    return;
  }
  try {
    require('dotenv').config();
    const mongoose = require('mongoose');
    const School = require('../models/School');
    await mongoose.connect(process.env.MONGODB_URL);
    const result = await School.deleteMany({
      $or: [
        { name: /^Security Suite School/i },
        { officialEmail: /@example\.org$/i },
        { contactEmail: /@example\.org$/i },
      ],
    });
    console.warn(`Cleaned up ${result.deletedCount} security-suite test school(s).`);
    await mongoose.disconnect();
  } catch (err) {
    console.warn('Test-school cleanup failed (safe to ignore):', err.message);
  }
};

run().catch((err) => {
  console.error('production security suite failed', err);
  process.exit(1);
});
