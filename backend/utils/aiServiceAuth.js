// Attaches the shared X-Internal-Key secret to every outgoing request that targets
// the ai-service, so the service's request-auth middleware (app/main.py) accepts it.
// Implemented as a global axios interceptor (rather than editing every route file
// that calls axios.post(`${AI_SERVICE_URL}/...`)) so no call site can forget it.
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const INTERNAL_KEY = process.env.AI_SERVICE_INTERNAL_KEY || '';

axios.interceptors.request.use((config) => {
  const target = config.baseURL ? `${config.baseURL}${config.url || ''}` : config.url || '';
  if (INTERNAL_KEY && target.startsWith(AI_SERVICE_URL)) {
    config.headers = config.headers || {};
    config.headers['X-Internal-Key'] = INTERNAL_KEY;
  }
  return config;
});

module.exports = { AI_SERVICE_URL };
