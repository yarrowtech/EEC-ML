import { logoutAndRedirect, AUTH_NOTICE } from '../utils/authSession';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/**
 * fetch() wrapper for the parent portal.
 *
 * - Prefixes relative paths with the API base URL.
 * - Attaches the bearer token automatically.
 * - Redirects to login ONLY on 401 (expired / invalid token). Business-logic
 *   403s (e.g. "student not linked to this parent") are returned to the caller
 *   so the screen can show a real message instead of bouncing to login.
 *
 * @param {string} path      Absolute URL or path beginning with "/"
 * @param {RequestInit} [options]
 * @param {(to: string) => void} [navigate]  react-router navigate, for the redirect
 */
export const parentApiFetch = async (path, options = {}, navigate = null) => {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    logoutAndRedirect({ navigate, notice: AUTH_NOTICE.EXPIRED, clearAllLocalStorage: true });
    const err = new Error('Your session has expired. Please sign in again.');
    err.code = AUTH_NOTICE.EXPIRED;
    throw err;
  }

  return res;
};

/**
 * parentApiFetch + JSON parse + non-2xx → throw Error(payload.error).
 * Returns the parsed body on success.
 */
export const parentApiJson = async (path, options = {}, navigate = null) => {
  const res = await parentApiFetch(path, options, navigate);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data;
};

export { API_BASE as PARENT_API_BASE };
