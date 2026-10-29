import axios from 'axios';

// Client half of the sliding session (see backend/utils/sessionRenewal.js):
// the API returns a renewed token in X-Renewed-Token on authenticated
// requests, and GET /api/session/renew issues one on demand. Swapping it into
// localStorage keeps the user signed in until they press Logout.
const RENEWED_TOKEN_HEADER = 'x-renewed-token';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

const storeRenewedToken = (nextToken) => {
  if (!nextToken) return;
  try {
    // Never resurrect a session the user has just logged out of.
    if (!localStorage.getItem('token')) return;
    localStorage.setItem('token', nextToken);
  } catch {
    // storage blocked — the current token keeps working until it expires
  }
};

let installed = false;

/** Patch fetch + axios once, before the app renders. */
export const installSessionRenewal = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      storeRenewedToken(response.headers.get(RENEWED_TOKEN_HEADER));
    } catch {
      // opaque / cross-origin responses without the exposed header
    }
    return response;
  };

  axios.interceptors.response.use(
    (response) => {
      storeRenewedToken(response?.headers?.[RENEWED_TOKEN_HEADER]);
      return response;
    },
    (error) => {
      storeRenewedToken(error?.response?.headers?.[RENEWED_TOKEN_HEADER]);
      return Promise.reject(error);
    }
  );
};

/** Ask the server for a fresh token now (app open, "Stay signed in"). */
export const renewSession = async () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE}/api/session/renew`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    storeRenewedToken(payload?.data?.token);
    return Boolean(payload?.data?.token);
  } catch {
    return false;
  }
};
