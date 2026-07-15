// Converts subject/topic/chapter names to and from URL-safe slugs. Spaces
// become underscores instead of the browser's default %20 so links read
// cleanly, e.g. /subject/english_(second_language) instead of
// /subject/english%20(second%20language).
export const slugifyForUrl = (value) =>
  encodeURIComponent(String(value || '').trim().replace(/\s+/g, '_'));

export const deslugifyFromUrl = (value) =>
  decodeURIComponent(String(value || '')).replace(/_/g, ' ');
