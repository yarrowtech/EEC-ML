import { useCallback, useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}/api/settings/payment${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || 'Payment gateway request failed');
  return data;
};

export default function usePaymentGateway() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('');
      setSettings(data);
      return data;
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh().catch(() => setSettings(null)); }, [refresh]);

  const save = async (payload) => {
    setSaving(true);
    try {
      const data = await request('', { method: 'POST', body: JSON.stringify(payload) });
      setSettings(data);
      return data;
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const result = await request('/test', { method: 'POST', body: '{}' });
      setSettings((current) => current ? { ...current, ...result, connected: true } : current);
      return result;
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const data = await request('', { method: 'DELETE' });
      setSettings(data);
      return data;
    } finally {
      setDisconnecting(false);
    }
  };

  return { settings, loading, saving, testing, disconnecting, error, refresh, save, test, disconnect };
}
