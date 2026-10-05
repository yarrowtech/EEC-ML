// Attaches the shared X-Internal-Key secret to every outgoing request that targets
// the ai-service, so the service's request-auth middleware (app/main.py) accepts it.
// Implemented as a global axios interceptor (rather than editing every route file
// that calls axios.post(`${AI_SERVICE_URL}/...`)) so no call site can forget it.
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const INTERNAL_KEY = process.env.AI_SERVICE_INTERNAL_KEY || '';

axios.interceptors.request.use((config) => {
  const target = config.url || '';
  let matchesService = false;
  try {
    matchesService = new URL(target, config.baseURL).origin === new URL(AI_SERVICE_URL).origin;
  } catch (_) { /* Relative or invalid URLs do not receive the secret. */ }
  if (INTERNAL_KEY && matchesService) {
    config.headers = config.headers || {};
    config.headers['X-Internal-Key'] = INTERNAL_KEY;
    config.maxRedirects = 0; // Never forward the secret to redirect destinations.
  }
  return config;
});

module.exports = { AI_SERVICE_URL };
