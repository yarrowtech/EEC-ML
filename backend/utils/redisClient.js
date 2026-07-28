const { createClient } = require('redis');
const { logger } = require('./logger');

const client = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  socket: {
    reconnectStrategy: (retries) => (
      retries >= 3 ? new Error('Redis reconnect limit reached') : Math.min(retries * 100, 500)
    ),
  },
});

client.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

async function connectRedis() {
  if (client.isOpen) return;

  try {
    await client.connect();
    logger.info('Redis connected');
  } catch (err) {
    // Redis is an optimization. MongoDB remains the source of truth.
    logger.warn({ err }, 'Redis unavailable; continuing without cache');
  }
}

async function getJson(key) {
  if (!client.isReady) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn({ err, key }, 'Redis read failed');
    return null;
  }
}

async function setJson(key, value, ttlSeconds = 60) {
  if (!client.isReady) return;

  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn({ err, key }, 'Redis write failed');
  }
}

async function getNumber(key, fallback = 0) {
  if (!client.isReady) return fallback;

  try {
    const value = await client.get(key);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch (err) {
    logger.warn({ err, key }, 'Redis version read failed');
    return fallback;
  }
}

async function increment(key) {
  if (!client.isReady) return;

  try {
    await client.incr(key);
  } catch (err) {
    logger.warn({ err, key }, 'Redis version increment failed');
  }
}

module.exports = {
  client,
  connectRedis,
  getJson,
  setJson,
  getNumber,
  increment,
};
