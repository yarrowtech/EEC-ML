/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_BRANDING = Object.freeze({
  name: 'Electronic Educare',
  logo: '',
  favicon: '',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  theme: 'light',
  settings: {},
});

const TenantContext = createContext(null);
const isCssColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''));

export function TenantProvider({ children }) {
  const [organization, setOrganization] = useState(null);
  const [isMainDomain, setIsMainDomain] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

    fetch(`${apiBase}/api/tenant`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Organization not found' : 'Unable to load organization');
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        setOrganization(payload.organization || null);
        setIsMainDomain(Boolean(payload.isMainDomain));
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const branding = useMemo(() => ({
    ...DEFAULT_BRANDING,
    ...(organization || {}),
  }), [organization]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', isCssColor(branding.primaryColor) ? branding.primaryColor : DEFAULT_BRANDING.primaryColor);
    root.style.setProperty('--tenant-secondary', isCssColor(branding.secondaryColor) ? branding.secondaryColor : DEFAULT_BRANDING.secondaryColor);
    document.title = branding.name;

    let favicon = document.querySelector("link[rel~='icon']");
    if (branding.favicon) {
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = branding.favicon;
    }
    root.dataset.tenantTheme = branding.theme;
  }, [branding]);

  const value = useMemo(() => ({
    organization,
    isMainDomain,
    loading,
    error,
    name: branding.name,
    logo: branding.logo,
    favicon: branding.favicon,
    colors: {
      primary: branding.primaryColor,
      secondary: branding.secondaryColor,
    },
    theme: branding.theme,
    settings: branding.settings,
  }), [branding, error, isMainDomain, loading, organization]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}

export default TenantContext;
