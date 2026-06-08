// sun.js — local sunrise / sunset / twilight / golden-hour computation.
//
// No network needed: this runs entirely on-device, so sun times always work
// even with zero signal. Algorithm adapted from SunCalc by Vladimir Agafonkin
// (https://github.com/mourner/suncalc, BSD-2-Clause), trimmed to what we use.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397; // axial tilt of the Earth

const toJulian = (date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date) => toJulian(date) - J2000;

function declination(l, b) {
  return Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) +
      Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
  );
}

function solarMeanAnomaly(d) {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M) {
  const C =
    RAD *
    (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372; // perihelion of the Earth
  return M + C + P + Math.PI;
}

// --- sun rise/set helpers ---
const J0 = 0.0009;
const julianCycle = (d, lw) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht, lw, n) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds, M, L) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

function hourAngle(h, phi, dec) {
  return Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) /
      (Math.cos(phi) * Math.cos(dec))
  );
}

function getSetJ(h, lw, phi, dec, n, M, L) {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

/**
 * Sun event times for a given date and location.
 * Returns Date objects (UTC instants); format them in the target timezone.
 * Any value may be null at extreme latitudes where the event doesn't occur —
 * irrelevant for Hawaii, but handled so the UI never crashes.
 */
export function getSunTimes(date, lat, lng) {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);

  const result = { solarNoon: fromJulian(Jnoon) };

  const add = (angleDeg, riseKey, setKey) => {
    const h0 = angleDeg * RAD;
    const Jset = getSetJ(h0, lw, phi, dec, n, M, L);
    if (Number.isNaN(Jset)) {
      result[riseKey] = null;
      result[setKey] = null;
      return;
    }
    const Jrise = Jnoon - (Jset - Jnoon);
    result[riseKey] = fromJulian(Jrise);
    result[setKey] = fromJulian(Jset);
  };

  add(-0.833, "sunrise", "sunset"); // standard sun rise/set (incl. refraction)
  add(-6, "dawn", "dusk"); // civil twilight
  add(6, "goldenHourEnd", "goldenHour"); // soft golden light

  return result;
}

/** Day length in milliseconds, or null if rise/set unavailable. */
export function dayLength(times) {
  if (!times.sunrise || !times.sunset) return null;
  return times.sunset - times.sunrise;
}
