'use strict';

/**
 * Password hashing helpers.
 *
 * `looksHashed` lets model pre-save hooks skip re-hashing a value that is
 * already a bcrypt digest (used by the bulk-import path, which pre-hashes
 * passwords in parallel before handing them to Mongoose).
 *
 * `hashPasswordsBulk` hashes many plaintext passwords at once, spreading the
 * CPU-bound bcrypt work across worker threads so a large student import is not
 * bottlenecked on a single core. It falls back to sequential hashing when
 * worker threads are unavailable.
 */

const os = require('os');
const bcrypt = require('bcryptjs');

let Worker = null;
try {
  ({ Worker } = require('worker_threads'));
} catch (err) {
  Worker = null;
}

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const looksHashed = (value) => typeof value === 'string' && BCRYPT_RE.test(value);

const WORKER_SOURCE = `
  const bcrypt = require('bcryptjs');
  const { parentPort } = require('worker_threads');
  parentPort.on('message', (job) => {
    if (!job || job.password == null) { parentPort.postMessage({ id: job && job.id, error: 'no password' }); return; }
    bcrypt.hash(String(job.password), job.rounds || 10).then(
      (hash) => parentPort.postMessage({ id: job.id, hash }),
      (err) => parentPort.postMessage({ id: job.id, error: String((err && err.message) || err) })
    );
  });
`;

const hashSequential = async (passwords, rounds) => {
  const out = new Array(passwords.length);
  for (let i = 0; i < passwords.length; i += 1) {
    out[i] = await bcrypt.hash(String(passwords[i]), rounds);
  }
  return out;
};

const hashWithPool = (passwords, rounds) =>
  new Promise((resolve, reject) => {
    const poolSize = Math.max(
      1,
      Math.min((os.cpus() || [{}]).length - 1 || 1, 4, passwords.length)
    );
    const results = new Array(passwords.length);
    const workers = [];
    let nextIndex = 0;
    let done = 0;
    let settled = false;

    const cleanup = () => {
      workers.forEach((w) => {
        try { w.terminate(); } catch (err) { /* ignore */ }
      });
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const assign = (worker) => {
      if (nextIndex >= passwords.length) return;
      const id = nextIndex;
      nextIndex += 1;
      worker.postMessage({ id, password: passwords[id], rounds });
    };

    try {
      for (let i = 0; i < poolSize; i += 1) {
        const worker = new Worker(WORKER_SOURCE, { eval: true });
        workers.push(worker);
        worker.on('message', (msg) => {
          if (settled) return;
          if (msg.error) { fail(new Error(msg.error)); return; }
          results[msg.id] = msg.hash;
          done += 1;
          if (done === passwords.length) {
            settled = true;
            cleanup();
            resolve(results);
            return;
          }
          assign(worker);
        });
        worker.on('error', fail);
        worker.on('exit', (code) => {
          if (!settled && code !== 0) fail(new Error(`hash worker exited: ${code}`));
        });
      }
      // Prime each worker with an initial job.
      workers.forEach((worker) => assign(worker));
    } catch (err) {
      fail(err);
    }
  });

const hashPasswordsBulk = async (passwords, rounds = 10) => {
  const list = Array.isArray(passwords) ? passwords : [];
  if (list.length === 0) return [];
  if (Worker && list.length > 4) {
    try {
      return await hashWithPool(list, rounds);
    } catch (err) {
      // Fall back to single-threaded hashing on any pool failure.
    }
  }
  return hashSequential(list, rounds);
};

module.exports = { looksHashed, hashPasswordsBulk };
