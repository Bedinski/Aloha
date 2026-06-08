// tides.js — NOAA CO-OPS tide predictions (free, no API key, CORS-enabled).
//
// Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
// We pull two things for the next 48h from the chosen station:
//   * high/low events (interval=hilo)  -> the labelled tide table
//   * hourly heights (interval=h)       -> the smooth tide curve

import { fetchJSON } from "./store.js";

const BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter";

function buildUrl(station, interval) {
  const p = new URLSearchParams({
    product: "predictions",
    application: "aloha-waikiki-dashboard",
    date: "today",
    range: "48", // hours
    station,
    datum: "MLLW",
    time_zone: "lst_ldt", // local station time
    units: "english", // feet
    interval, // "hilo" or "h"
    format: "json",
  });
  return `${BASE}?${p.toString()}`;
}

// NOAA returns local-station wall-clock strings like "2026-06-08 14:30".
// Treat them as Hawaii time (HST = UTC-10, no daylight saving).
function parseHstString(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) + 10 * 3600 * 1000);
}

/**
 * @returns {Promise<{
 *   highsLows: {time:Date, heightFt:number, type:'H'|'L'}[],
 *   curve: {time:Date, heightFt:number}[],
 *   fromCache: boolean, savedAt: number|null
 * }>}
 */
export async function getTides(station) {
  const [hilo, hourly] = await Promise.all([
    fetchJSON(buildUrl(station, "hilo"), `tides:hilo:${station}`),
    fetchJSON(buildUrl(station, "h"), `tides:h:${station}`),
  ]);

  const highsLows = (hilo.data.predictions || []).map((p) => ({
    time: parseHstString(p.t),
    heightFt: parseFloat(p.v),
    type: p.type, // "H" or "L"
  }));

  const curve = (hourly.data.predictions || []).map((p) => ({
    time: parseHstString(p.t),
    heightFt: parseFloat(p.v),
  }));

  return {
    highsLows,
    curve,
    fromCache: hilo.fromCache || hourly.fromCache,
    savedAt: Math.min(hilo.savedAt || Infinity, hourly.savedAt || Infinity),
  };
}
