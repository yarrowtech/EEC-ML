// Small helpers shared by the entity importers in this directory (see
// backend/routes/superAdminMigrationRoutes.js for how they're wired up).

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

// Maps a normalized lookup key (e.g. a class name) to the doc that owns it,
// first match wins on a duplicate key.
const buildLookupMap = (docs, keyFn) => {
  const map = new Map();
  docs.forEach((doc) => {
    const key = normalizeKey(keyFn(doc));
    if (key && !map.has(key)) map.set(key, doc);
  });
  return map;
};

const parseDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseAmount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

module.exports = { normalizeKey, buildLookupMap, parseDate, parseAmount };
