/**
 * Single owner of `document.title`.
 *
 * Two independent inputs feed the tab title: the tenant/school name (the "base",
 * set once when branding resolves) and the current page (set per route). Routing
 * both through here means the order in which React effects fire no longer matters
 * — the title is always `"<page> · <base>"`, or just `"<base>"` on routes that
 * don't register a page title.
 */

const DEFAULT_BASE = 'Electronic Educare';

let base = DEFAULT_BASE;
let page = '';

const apply = () => {
  document.title = page ? `${page} · ${base}` : base;
};

export const setTitleBase = (value) => {
  base = String(value || '').trim() || DEFAULT_BASE;
  apply();
};

export const setTitlePage = (value) => {
  page = String(value || '').trim();
  apply();
};
