// Browser GPS helper for the teacher school-geofence. The backend decides
// whether a position is inside the school (utils/schoolGeofence.js); this
// only reads the device's current position with high accuracy.
export const GEO_ERROR_MESSAGES = {
  unsupported: 'This browser cannot share your location. Please use a phone or browser with location support.',
  denied: 'Location access is blocked. Allow location for this site in your browser settings, then try again.',
  unavailable: 'Your location is unavailable right now. Turn on GPS / location services and try again.',
  timeout: 'Getting your location took too long. Move closer to a window or open area and try again.',
};

export const getCurrentLocation = ({ timeout = 15000 } = {}) => new Promise((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new Error(GEO_ERROR_MESSAGES.unsupported));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => resolve({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    }),
    (err) => {
      if (err?.code === 1) reject(new Error(GEO_ERROR_MESSAGES.denied));
      else if (err?.code === 3) reject(new Error(GEO_ERROR_MESSAGES.timeout));
      else reject(new Error(GEO_ERROR_MESSAGES.unavailable));
    },
    { enableHighAccuracy: true, timeout, maximumAge: 0 },
  );
});

// Error codes the backend returns when the school geofence blocks a request.
export const GEOFENCE_CODES = new Set(['LOCATION_REQUIRED', 'LOCATION_INACCURATE', 'OUTSIDE_SCHOOL']);

/**
 * POSTs JSON; if the server answers LOCATION_REQUIRED (the teacher's school
 * enforces a geofence), reads GPS and retries once with `location` attached.
 * Resolves to { res, data }. `onLocating` fires before GPS is requested.
 */
export const postWithLocationRetry = async (url, { headers = {}, body = {}, onLocating } = {}) => {
  const send = (payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  let res = await send(body);
  let data = await res.json().catch(() => ({}));
  if (!res.ok && data?.code === 'LOCATION_REQUIRED') {
    onLocating?.();
    const location = await getCurrentLocation();
    res = await send({ ...body, location });
    data = await res.json().catch(() => ({}));
  }
  return { res, data };
};
