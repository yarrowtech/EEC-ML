/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
const DEFAULT_FAVICON = '/logo_new.png';
const isCssColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''));
const resolveAssetUrl = (asset) => {
  if (!asset) return '';
  if (typeof asset === 'string') return asset.trim();
  if (typeof asset === 'object') return asset.secure_url || asset.url || asset.path || '';
  return '';
};

export function TenantProvider({ children }) {
  const [organization, setOrganization] = useState(null);
  const [isMainDomain, setIsMainDomain] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestSequence = useRef(0);

  const loadTenant = useCallback(async (signal) => {
    const requestId = ++requestSequence.current;
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const token = localStorage.getItem('token');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/api/tenant`, {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Organization not found' : 'Unable to load organization');
      }
      const payload = await response.json();
      if (requestId !== requestSequence.current) return;
      setOrganization(payload.organization || null);
      setIsMainDomain(Boolean(payload.isMainDomain));
    } catch (requestError) {
      if (requestId === requestSequence.current && requestError.name !== 'AbortError') {
        setError(requestError.message);
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadTenant(controller.signal);
    return () => controller.abort();
  }, [loadTenant]);

  const branding = useMemo(() => ({
    ...DEFAULT_BRANDING,
    ...(organization || {}),
  }), [organization]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', isCssColor(branding.primaryColor) ? branding.primaryColor : DEFAULT_BRANDING.primaryColor);
    root.style.setProperty('--tenant-secondary', isCssColor(branding.secondaryColor) ? branding.secondaryColor : DEFAULT_BRANDING.secondaryColor);
    document.title = String(branding.name || DEFAULT_BRANDING.name).trim() || DEFAULT_BRANDING.name;

    let favicon = document.querySelector("link[rel~='icon']");
    const faviconUrl = resolveAssetUrl(branding.favicon) || resolveAssetUrl(branding.logo) || DEFAULT_FAVICON;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    // The school logo can be PNG, JPEG, SVG, or a Cloudinary URL without an extension.
    favicon.removeAttribute('type');
    favicon.href = faviconUrl;
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
    refreshBranding: loadTenant,
  }), [branding, error, isMainDomain, loadTenant, loading, organization]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}

export default TenantContext;
