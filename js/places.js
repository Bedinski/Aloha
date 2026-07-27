// places.js — "around the island" weather: a compact forecast for several
// named destinations at once, so you can compare spots before planning a day.
//
// Uses the same keyless Open-Meteo forecast API as the rest of the app, but a
// deliberately small payload (current + 2 daily days, no hourly). Each place is
// fetched and cached independently via store.js, so one failing place never
// blanks the others and every card keeps a last-good copy offline.

import { fetchJSON } from "./store.js";
import { temp } from "./units.js";

// WMO weather codes → [emoji, short label]. https://open-meteo.com/en/docs
const WMO = {
  0: ["☀️", "Clear"],
  1: ["🌤️", "Mostly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Freezing fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌦️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Freezing drizzle"],
  61: ["🌦️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["❄️", "Snow grains"],
  80: ["🌦️", "Light showers"],
  81: ["🌧️", "Showers"],
  82: ["⛈️", "Heavy showers"],
  85: ["🌨️", "Snow showers"],
  86: ["❄️", "Snow showers"],
  95: ["⛈️", "Thunderstorms"],
  96: ["⛈️", "Storms + hail"],
  99: ["⛈️", "Storms + hail"],
};
const wmo = (code) => WMO[code] || ["🌡️", "—"];

function url(lat, lng, tz) {
  const p = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: tz,
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

/** One place's compact forecast. Throws only if it fails with no cached copy. */
async function getPlace(place, tz) {
  const r = await fetchJSON(url(place.lat, place.lng, tz), `place:${place.id}:${tz}`);
  const d = r.data || {};
  const day = d.daily || {};
  const at = (arr, i) => (Array.isArray(arr) ? arr[i] ?? null : null);
  return {
    nowF: d.current?.temperature_2m ?? null,
    nowCode: d.current?.weather_code ?? at(day.weather_code, 0),
    highF: at(day.temperature_2m_max, 0),
    lowF: at(day.temperature_2m_min, 0),
    rainPct: at(day.precipitation_probability_max, 0),
    tmwCode: at(day.weather_code, 1),
    tmwHighF: at(day.temperature_2m_max, 1),
    tmwLowF: at(day.temperature_2m_min, 1),
    fromCache: r.fromCache,
  };
}

/**
 * Fetch every place in parallel. Never rejects: a place that fails with no
 * cache resolves to `{ place, wx: null }` and renders as unavailable.
 */
export function getPlaces(places, tz) {
  return Promise.all(
    places.map((place) =>
      getPlace(place, tz).then(
        (wx) => ({ place, wx }),
        () => ({ place, wx: null })
      )
    )
  );
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function cardHtml({ place, wx }) {
  const head = `<div class="place-name">${esc(place.name)}</div>` +
    (place.note ? `<div class="place-note">${esc(place.note)}</div>` : "");
  if (!wx || wx.nowF == null) {
    return `<div class="place-card">${head}<p class="muted small">Forecast unavailable.</p></div>`;
  }
  const [icon, label] = wmo(wx.nowCode);
  const [tIcon] = wmo(wx.tmwCode);
  const hilo = wx.highF != null && wx.lowF != null ? `${temp(wx.highF)} / ${temp(wx.lowF)}` : "";
  const rain = wx.rainPct != null ? `${Math.round(wx.rainPct)}% rain` : "";
  const tmw =
    wx.tmwHighF != null && wx.tmwLowF != null
      ? `<div class="place-tmw"><span>Tomorrow</span><b>${tIcon} ${temp(wx.tmwHighF)} / ${temp(wx.tmwLowF)}</b></div>`
      : "";
  return `
    <div class="place-card">
      ${head}
      <div class="place-now"><span class="place-icon">${icon}</span><span class="place-temp">${temp(wx.nowF)}</span></div>
      <div class="place-cond">${esc(label)}</div>
      <div class="place-meta">${[hilo, rain].filter(Boolean).join(" · ")}</div>
      ${tmw}
    </div>`;
}

/** HTML for the whole grid of place cards. */
export const placesHtml = (rows) =>
  `<div class="places-grid">${rows.map(cardHtml).join("")}</div>`;
