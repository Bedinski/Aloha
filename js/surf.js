// surf.js — Open-Meteo Marine + Weather (free, no API key, CORS-enabled).
//
// Marine docs:  https://open-meteo.com/en/docs/marine-weather-api
// Weather docs: https://open-meteo.com/en/docs
// We merge wave data (height / period / direction / swell) with surface
// weather (air temp, wind, UV) into one hourly timeline for the dashboard.

import { fetchJSON } from "./store.js";

const M_TO_FT = 3.28084;
const FORECAST_DAYS = 3;

// Open-Meteo returns local wall-clock ISO strings (no offset) for the
// requested timezone. Hawaii is UTC-10 with no daylight saving.
function parseHst(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) + 10 * 3600 * 1000);
}

function marineUrl(lat, lng) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    hourly:
      "wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction",
    timezone: "Pacific/Honolulu",
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://marine-api.open-meteo.com/v1/marine?${p.toString()}`;
}

function weatherUrl(lat, lng) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,uv_index",
    hourly: "temperature_2m,wind_speed_10m,wind_direction_10m,uv_index",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "Pacific/Honolulu",
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

const ft = (meters) =>
  meters == null ? null : Math.round(meters * M_TO_FT * 10) / 10;

/**
 * @returns {Promise<{
 *   current: {tempF:number, windMph:number, windDir:number, uv:number}|null,
 *   hourly: {time:Date, waveFt:number, wavePeriod:number, waveDir:number,
 *            swellFt:number, swellPeriod:number, swellDir:number,
 *            windMph:number, windDir:number, tempF:number, uv:number}[],
 *   fromCache: boolean, savedAt: number|null
 * }>}
 */
export async function getOcean(lat, lng) {
  const [marine, weather] = await Promise.all([
    fetchJSON(marineUrl(lat, lng), `marine:${lat},${lng}`),
    fetchJSON(weatherUrl(lat, lng), `weather:${lat},${lng}`),
  ]);

  const mh = marine.data.hourly || {};
  const wh = weather.data.hourly || {};

  // Index weather by timestamp so we merge by time, not by array position.
  const wIndex = new Map();
  (wh.time || []).forEach((t, i) => wIndex.set(t, i));

  const hourly = (mh.time || []).map((t, i) => {
    const wi = wIndex.has(t) ? wIndex.get(t) : i;
    return {
      time: parseHst(t),
      waveFt: ft(mh.wave_height?.[i]),
      wavePeriod: mh.wave_period?.[i] ?? null,
      waveDir: mh.wave_direction?.[i] ?? null,
      swellFt: ft(mh.swell_wave_height?.[i]),
      swellPeriod: mh.swell_wave_period?.[i] ?? null,
      swellDir: mh.swell_wave_direction?.[i] ?? null,
      windMph: wh.wind_speed_10m?.[wi] ?? null,
      windDir: wh.wind_direction_10m?.[wi] ?? null,
      tempF: wh.temperature_2m?.[wi] ?? null,
      uv: wh.uv_index?.[wi] ?? null,
    };
  });

  const c = weather.data.current;
  const current = c
    ? {
        tempF: c.temperature_2m,
        windMph: c.wind_speed_10m,
        windDir: c.wind_direction_10m,
        uv: c.uv_index,
      }
    : null;

  return {
    current,
    hourly,
    fromCache: marine.fromCache || weather.fromCache,
    savedAt: Math.min(
      marine.savedAt || Infinity,
      weather.savedAt || Infinity
    ),
  };
}
