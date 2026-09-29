// School geofence for teachers: when a school enables it, teachers can only
// sign in / check in / check out while physically inside the school radius.
// The browser only sends raw GPS readings (lat, lng, accuracy); every decision
// is made here so a modified frontend can't just claim "inside school".
const School = require('../models/School');

const EARTH_RADIUS_M = 6371000;
const DEFAULT_RADIUS_M = 100;
const DEFAULT_MAX_ACCURACY_M = 100;

const toRad = (deg) => (deg * Math.PI) / 180;

// Haversine great-circle distance in metres.
const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

const isValidLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90;
const isValidLng = (v) => Number.isFinite(v) && v >= -180 && v <= 180;

// Normalises the stored school geofence; returns null when it isn't enforced.
const activeGeofence = (school) => {
  const g = school?.teacherGeofence;
  if (!g?.enabled) return null;
  const latitude = Number(g.latitude);
  const longitude = Number(g.longitude);
  if (!isValidLat(latitude) || !isValidLng(longitude)) return null;
  return {
    latitude,
    longitude,
    radius: Number(g.radius) > 0 ? Number(g.radius) : DEFAULT_RADIUS_M,
    maxAccuracy: Number(g.maxAccuracy) > 0 ? Number(g.maxAccuracy) : DEFAULT_MAX_ACCURACY_M,
  };
};

// Pulls { latitude, longitude, accuracy } from a request body (`location`
// object or top-level fields). Returns null when missing / malformed.
const readLocation = (body = {}) => {
  const src = body.location && typeof body.location === 'object' ? body.location : body;
  const latitude = Number(src.latitude);
  const longitude = Number(src.longitude);
  const accuracy = Number(src.accuracy);
  if (!isValidLat(latitude) || !isValidLng(longitude)) return null;
  return { latitude, longitude, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null };
};

// Per-school fence cache for the per-request session check in authTeacher.
const FENCE_CACHE_TTL_MS = 60 * 1000;
const fenceCache = new Map(); // schoolId -> { fence, expires }

const getSchoolFence = async (schoolId) => {
  if (!schoolId) return null;
  const key = String(schoolId);
  const hit = fenceCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.fence;
  const school = await School.findById(schoolId).select('teacherGeofence').lean();
  const fence = activeGeofence(school);
  fenceCache.set(key, { fence, expires: Date.now() + FENCE_CACHE_TTL_MS });
  return fence;
};

const invalidateSchoolFence = (schoolId) => {
  if (schoolId) fenceCache.delete(String(schoolId));
  else fenceCache.clear();
};

/**
 * Verifies a teacher's reported position against their school's geofence.
 * Resolves to { ok: true, enforced, location? } or
 * { ok: false, status, code, error, distance? }.
 */
const verifyTeacherLocation = async (schoolId, body) => {
  if (!schoolId) return { ok: true, enforced: false };
  invalidateSchoolFence(schoolId); // always read fresh on login / check-in
  const fence = await getSchoolFence(schoolId);
  if (!fence) return { ok: true, enforced: false };

  const loc = readLocation(body);
  if (!loc) {
    return {
      ok: false,
      status: 428,
      code: 'LOCATION_REQUIRED',
      error: 'Your school requires your location to access the teacher portal. Please allow location access and try again.',
    };
  }
  if (loc.accuracy === null || loc.accuracy > fence.maxAccuracy) {
    return {
      ok: false,
      status: 400,
      code: 'LOCATION_INACCURATE',
      error: 'Unable to determine your location accurately. Please turn on GPS / precise location and try again.',
    };
  }
  const distance = Math.round(distanceMeters(loc.latitude, loc.longitude, fence.latitude, fence.longitude));
  if (distance > fence.radius) {
    return {
      ok: false,
      status: 403,
      code: 'OUTSIDE_SCHOOL',
      error: "You can't access the teacher portal from outside the school premises. Please enter the school campus and try again.",
      distance,
    };
  }
  return { ok: true, enforced: true, location: { ...loc, distanceFromSchool: distance } };
};

module.exports = {
  DEFAULT_RADIUS_M,
  DEFAULT_MAX_ACCURACY_M,
  distanceMeters,
  readLocation,
  activeGeofence,
  getSchoolFence,
  invalidateSchoolFence,
  verifyTeacherLocation,
};
