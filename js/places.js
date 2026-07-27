// places.js — "around the island" weather: a 7-day forecast for several named
// destinations at once, laid out as a matrix (places down the side, days
// across) so a whole week can be compared on one screen.
//
// Uses the same keyless Open-Meteo forecast API as the rest of the app, but a
// deliberately small payload (current + 7 daily days, no hourly). Each place is
// fetched and cached independently via store.js, so one failing place never
// blanks the others and every row keeps a last-good copy offline.

import { fetchJSON } from "./store.js";
import { temp, tempVal, tempUnit } from "./units.js";

const DAYS = 7;

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
    forecast_days: String(DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${p.toString()}`;
}

/** One place's 7-day forecast. Throws only if it fails with no cached copy. */
async function getPlace(place, tz) {
  const r = await fetchJSON(url(place.lat, place.lng, tz), `place:${place.id}:${tz}`);
  const d = r.data || {};
  const day = d.daily || {};
  const at = (arr, i) => (Array.isArray(arr) ? arr[i] ?? null : null);
  const days = (day.time || []).slice(0, DAYS).map((date, i) => ({
    date, // "YYYY-MM-DD" already in the requested timezone
    code: at(day.weather_code, i),
    highF: at(day.temperature_2m_max, i),
    lowF: at(day.temperature_2m_min, i),
    rainPct: at(day.precipitation_probability_max, i),
  }));
  return {
    nowF: d.current?.temperature_2m ?? null,
    days,
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

// "2026-07-27" → { wd: "Mon", md: "7/27" }. Built from the string parts so the
// label never shifts across the viewer's own timezone. Today keeps its weekday
// and swaps the date line for "Today" — both fit a narrow phone column.
function dayLabel(date, index) {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y || !m || !d) return { wd: `Day ${index + 1}`, md: index === 0 ? "Today" : "" };
  const wd = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
  return { wd, md: index === 0 ? "Today" : `${m}/${d}` };
}

/** HTML for the places × days matrix. */
export function placesHtml(rows) {
  const withData = rows.filter((r) => r.wx?.days?.length);
  if (!withData.length) return `<p class="muted small">Forecast unavailable right now.</p>`;

  // Day headers come from the first place that loaded — all share a timezone.
  const headDays = withData[0].wx.days;
  const head =
    `<tr><th scope="col" class="pm-place">Place</th>` +
    headDays
      .map((d, i) => {
        const { wd, md } = dayLabel(d.date, i);
        return `<th scope="col"${i === 0 ? ' class="pm-today"' : ""}><span class="pm-wd">${esc(wd)}</span><span class="pm-md">${esc(md)}</span></th>`;
      })
      .join("") +
    `</tr>`;

  const body = rows
    .map(({ place, wx }) => {
      const sub = [place.note, wx?.nowF != null ? `now ${temp(wx.nowF)}` : null]
        .filter(Boolean)
        .join(" · ");
      const header =
        `<th scope="row" class="pm-place"><span class="pm-name">${esc(place.name)}</span>` +
        (sub ? `<span class="pm-sub">${esc(sub)}</span>` : "") +
        `</th>`;
      if (!wx?.days?.length) {
        return `<tr>${header}<td colspan="${headDays.length}" class="pm-none">Forecast unavailable</td></tr>`;
      }
      const cells = headDays
        .map((_, i) => {
          const d = wx.days[i];
          if (!d) return `<td class="pm-cell"></td>`;
          const [icon, label] = wmo(d.code);
          const hi = tempVal(d.highF);
          const lo = tempVal(d.lowF);
          return (
            `<td class="pm-cell${i === 0 ? " pm-today" : ""}">` +
            `<span class="pm-icon" title="${esc(label)}" aria-label="${esc(label)}">${icon}</span>` +
            `<span class="pm-hi">${hi == null ? "—" : `${hi}°`}</span>` +
            `<span class="pm-lo">${lo == null ? "—" : `${lo}°`}</span>` +
            `<span class="pm-rain">${d.rainPct == null ? "" : `${Math.round(d.rainPct)}%`}</span>` +
            `</td>`
          );
        })
        .join("");
      return `<tr>${header}${cells}</tr>`;
    })
    .join("");

  return (
    `<div class="places-scroll">` +
    `<table class="places-matrix"><caption class="sr-only">7-day forecast by destination: high and low temperature in ${tempUnit()} and chance of rain</caption>` +
    `<thead>${head}</thead><tbody>${body}</tbody></table></div>`
  );
}
