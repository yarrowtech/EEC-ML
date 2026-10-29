const backgroundJob = require('../utils/backgroundJob');

describe('utils/backgroundJob', () => {
  test('createJob starts a job in "processing" with zeroed counters', () => {
    const jobId = backgroundJob.createJob(5);
    const job = backgroundJob.getJob(jobId);
    expect(job).toMatchObject({
      status: 'processing',
      total: 5,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      warnings: [],
    });
  });

  test('getJob returns null for an unknown id', () => {
    expect(backgroundJob.getJob('does-not-exist')).toBeNull();
  });

  test('recordSuccess and recordFailure update processed/succeeded/failed', () => {
    const jobId = backgroundJob.createJob(3);
    backgroundJob.recordSuccess(jobId);
    backgroundJob.recordFailure(jobId, { index: 1, message: 'bad row' });
    backgroundJob.recordSuccess(jobId);

    const job = backgroundJob.getJob(jobId);
    expect(job.processed).toBe(3);
    expect(job.succeeded).toBe(2);
    expect(job.failed).toBe(1);
    expect(job.errors).toEqual([{ index: 1, message: 'bad row' }]);
  });

  test('tracked errors are capped at 200 even though the failed count keeps growing', () => {
    const jobId = backgroundJob.createJob(250);
    for (let i = 0; i < 250; i += 1) {
      backgroundJob.recordFailure(jobId, { index: i, message: `row ${i}` });
    }
    const job = backgroundJob.getJob(jobId);
    expect(job.failed).toBe(250);
    expect(job.errors).toHaveLength(200);
    expect(job.errors[0]).toEqual({ index: 0, message: 'row 0' });
  });

  test('recordFailure defaults to a generic message when none is given', () => {
    const jobId = backgroundJob.createJob(1);
    backgroundJob.recordFailure(jobId, { index: 0 });
    expect(backgroundJob.getJob(jobId).errors[0].message).toBe('Import failed');
  });

  test('addWarning appends non-empty messages only', () => {
    const jobId = backgroundJob.createJob(1);
    backgroundJob.addWarning(jobId, 'created without an academic year');
    backgroundJob.addWarning(jobId, '');
    backgroundJob.addWarning(jobId, null);
    expect(backgroundJob.getJob(jobId).warnings).toEqual(['created without an academic year']);
  });

  test('completeJob marks the job completed and stamps finishedAt', () => {
    const jobId = backgroundJob.createJob(1);
    backgroundJob.completeJob(jobId, { ttlMs: 10_000 });
    const job = backgroundJob.getJob(jobId);
    expect(job.status).toBe('completed');
    expect(job.finishedAt).toEqual(expect.any(Number));
  });

  test('failJob marks the job failed and records the error message', () => {
    const jobId = backgroundJob.createJob(1);
    backgroundJob.failJob(jobId, new Error('boom'), { ttlMs: 10_000 });
    const job = backgroundJob.getJob(jobId);
    expect(job.status).toBe('failed');
    expect(job.error).toBe('boom');
  });

  test('a completed job is pruned from the store after its TTL', () => {
    jest.useFakeTimers();
    const jobId = backgroundJob.createJob(1);
    backgroundJob.completeJob(jobId, { ttlMs: 1000 });
    expect(backgroundJob.getJob(jobId)).not.toBeNull();
    jest.advanceTimersByTime(1000);
    expect(backgroundJob.getJob(jobId)).toBeNull();
    jest.useRealTimers();
  });

  test('operations against an unknown jobId are no-ops, not throws', () => {
    expect(() => {
      backgroundJob.recordSuccess('missing');
      backgroundJob.recordFailure('missing', { index: 0, message: 'x' });
      backgroundJob.addWarning('missing', 'x');
      backgroundJob.completeJob('missing');
      backgroundJob.failJob('missing', new Error('x'));
    }).not.toThrow();
  });
});
