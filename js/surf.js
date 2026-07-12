// surf.js — Open-Meteo Marine + Weather (free, no API key, CORS-enabled).
//
// Marine docs:  https://open-meteo.com/en/docs/marine-weather-api
// Weather docs: https://open-meteo.com/en/docs
// We merge wave data (height / period / direction / swell) with surface
// weather (air temp, wind, UV) into one hourly timeline for the dashboard.

import { fetchJSON } from "./store.js";

const M_TO_FT = 3.28084;
const FORECAST_DAYS = 7;
const cToF = (c) => (c == null ? null : Math.round((c * 9) / 5 + 32));

// Open-Meteo returns local wall-clock ISO strings (no offset) for the requested
// timezone; convert to a true UTC instant with the response's utc_offset_seconds
// (which already accounts for daylight saving), so any timezone works.
function parseLocal(iso, offsetSec) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - offsetSec * 1000);
}

function marineUrl(lat, lng, tz) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    hourly: [
      "wave_height",
      "wave_direction",
      "wave_period",
      "wave_peak_period",
      "swell_wave_height",
      "swell_wave_period",
      "swell_wave_peak_period",
      "swell_wave_direction",
      "wind_wave_height",
      "wind_wave_period",
      "wind_wave_peak_period",
      "wind_wave_direction",
      "sea_surface_temperature",
    ].join(","),
    timezone: tz,
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://marine-api.open-meteo.com/v1/marine?${p.toString()}`;
}

function weatherUrl(lat, lng, tz) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index",
    hourly:
      "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: tz,
    forecast_days: String(FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

const ft = (meters) =>
  meters == null ? null : Math.round(meters * M_TO_FT * 10) / 10;

// Periods: prefer PEAK period (Tp, the surf-relevant figure that matches the
// CDIP buoy's waveTp); fall back to the combined peak, then the mean period,
// since peak-period variables are only served by some Open-Meteo wave models.
const peakOr = (...vals) => vals.find((v) => v != null) ?? null;

/**
 * Merged hourly ocean + weather timeline (7 days) plus current conditions.
 * Heights are feet, periods seconds (peak where available), directions degrees
 * (the direction waves come FROM), temps °F.
 * `swell*` = groundswell train, `windWave*` = local wind sea.
 */
export async function getOcean(lat, lng, tz = "Pacific/Honolulu") {
  const [marine, weather] = await Promise.all([
    fetchJSON(marineUrl(lat, lng, tz), `marine:${lat},${lng},${tz}`),
    fetchJSON(weatherUrl(lat, lng, tz), `weather:${lat},${lng},${tz}`),
  ]);

  const mh = marine.data.hourly || {};
  const wh = weather.data.hourly || {};
  const off = marine.data.utc_offset_seconds ?? weather.data.utc_offset_seconds ?? 0;

  // Index weather by timestamp so we merge by time, not by array position.
  const wIndex = new Map();
  (wh.time || []).forEach((t, i) => wIndex.set(t, i));

  const hourly = (mh.time || []).map((t, i) => {
    const wi = wIndex.has(t) ? wIndex.get(t) : i;
    return {
      time: parseLocal(t, off),
      waveFt: ft(mh.wave_height?.[i]),
      wavePeriod: peakOr(mh.wave_peak_period?.[i], mh.wave_period?.[i]),
      waveDir: mh.wave_direction?.[i] ?? null,
      swellFt: ft(mh.swell_wave_height?.[i]),
      swellPeriod: peakOr(mh.swell_wave_peak_period?.[i], mh.wave_peak_period?.[i], mh.swell_wave_period?.[i]),
      swellDir: mh.swell_wave_direction?.[i] ?? null,
      windWaveFt: ft(mh.wind_wave_height?.[i]),
      windWavePeriod: peakOr(mh.wind_wave_peak_period?.[i], mh.wind_wave_period?.[i]),
      windWaveDir: mh.wind_wave_direction?.[i] ?? null,
      waterTempF: cToF(mh.sea_surface_temperature?.[i]),
      windMph: wh.wind_speed_10m?.[wi] ?? null,
      windDir: wh.wind_direction_10m?.[wi] ?? null,
      windGustMph: wh.wind_gusts_10m?.[wi] ?? null,
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
        windGustMph: c.wind_gusts_10m,
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
