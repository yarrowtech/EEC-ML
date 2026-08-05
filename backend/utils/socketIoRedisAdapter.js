const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { logger } = require('./logger');

let adapterClients = null;

const buildRedisClient = (url) => createClient({
  url,
  socket: {
    reconnectStrategy: (retries) => Math.min(Math.max(retries, 1) * 250, 5000),
  },
});

const configureSocketIoRedisAdapter = async (io) => {
  if (!io || process.env.SOCKET_IO_REDIS_ENABLED === 'false') {
    return { enabled: false, reason: 'disabled' };
  }

  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const pubClient = buildRedisClient(redisUrl);
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => logger.error({ err }, 'Socket.IO Redis publisher error'));
  subClient.on('error', (err) => logger.error({ err }, 'Socket.IO Redis subscriber error'));

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    adapterClients = { pubClient, subClient };
    logger.info('Socket.IO Redis adapter enabled for cross-worker realtime events');
    return { enabled: true };
  } catch (err) {
    await Promise.allSettled([
      pubClient.isOpen ? pubClient.quit() : Promise.resolve(),
      subClient.isOpen ? subClient.quit() : Promise.resolve(),
    ]);
    logger.error({ err }, 'Socket.IO Redis adapter unavailable');
    if (process.env.SOCKET_IO_REDIS_REQUIRED === 'true') throw err;
    return { enabled: false, reason: 'connection_failed' };
  }
};

const closeSocketIoRedisAdapter = async () => {
  if (!adapterClients) return;
  const { pubClient, subClient } = adapterClients;
  adapterClients = null;
  await Promise.allSettled([
    pubClient?.isOpen ? pubClient.quit() : Promise.resolve(),
    subClient?.isOpen ? subClient.quit() : Promise.resolve(),
  ]);
};

module.exports = {
  configureSocketIoRedisAdapter,
  closeSocketIoRedisAdapter,
};
