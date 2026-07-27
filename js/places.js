// places.js — "around the island" weather: a 7-day forecast for several named
// destinations at once, laid out as a matrix (places down the side, days
// across) so a whole week can be compared on one screen.
//
// Drill-down: pick a place to expand its week, then pick a day to see that
// day's hourly forecast. Daily data loads for every place up front (small
// payload); hourly loads lazily for one place at a time and is cached, so the
// dashboard stays light until you actually ask for the detail.
//
// Uses the same keyless Open-Meteo forecast API as the rest of the app. Each
// request goes through store.js, so every place keeps a last-good copy offline
// and one failing place never blanks the others.

import { fetchJSON } from "./store.js";
import { temp, tempVal, tempUnit, spd } from "./units.js";

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

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
function baseParams(lat, lng, tz) {
  return {
    latitude: lat,
    longitude: lng,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: tz,
    forecast_days: String(DAYS),
  };
}

const dailyUrl = (lat, lng, tz) =>
  `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
    ...baseParams(lat, lng, tz),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  })}`;

const hourlyUrl = (lat, lng, tz) =>
  `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
    ...baseParams(lat, lng, tz),
    hourly: "temperature_2m,weather_code,precipitation_probability,wind_speed_10m",
  })}`;

/** One place's 7-day summary. Throws only if it fails with no cached copy. */
async function getPlace(place, tz) {
  const r = await fetchJSON(dailyUrl(place.lat, place.lng, tz), `place:${place.id}:${tz}`);
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
  return { nowF: d.current?.temperature_2m ?? null, days, fromCache: r.fromCache };
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

/** One place's hourly forecast, grouped by local date ("YYYY-MM-DD" → hours). */
async function getHourly(place, tz) {
  const r = await fetchJSON(hourlyUrl(place.lat, place.lng, tz), `placeHr:${place.id}:${tz}`);
  const h = r.data?.hourly || {};
  const byDate = new Map();
  (h.time || []).forEach((t, i) => {
    const [date, clock] = String(t).split("T");
    if (!date || !clock) return;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({
      clock: clock.slice(0, 5), // "14:00", already local to the place
      tempF: h.temperature_2m?.[i] ?? null,
      code: h.weather_code?.[i] ?? null,
      rainPct: h.precipitation_probability?.[i] ?? null,
      windMph: h.wind_speed_10m?.[i] ?? null,
    });
  });
  return byDate;
}

// ---------------------------------------------------------------------------
// View state — which place is expanded, which day is selected, hourly cache
// ---------------------------------------------------------------------------
const hourly = new Map(); // place.id -> Map(date -> hours[]) | "loading" | "error"
let sel = { placeId: null, dayIndex: 0 };
let ctx = { el: null, rows: [], tz: null };
const wired = new WeakSet();

const rerender = () => renderPlaces(ctx.el, ctx.rows, ctx.tz);

async function loadHourly(id) {
  const place = ctx.rows.find((r) => r.place.id === id)?.place;
  if (!place) return;
  hourly.set(id, "loading");
  try {
    hourly.set(id, await getHourly(place, ctx.tz));
  } catch {
    hourly.set(id, "error");
  }
  if (sel.placeId === id) rerender();
}

function onClick(e) {
  const placeBtn = e.target.closest("[data-place]");
  if (placeBtn) {
    const id = placeBtn.dataset.place;
    const opening = sel.placeId !== id;
    sel = { placeId: opening ? id : null, dayIndex: 0 };
    rerender();
    ctx.el.querySelector(`[data-place="${CSS.escape(id)}"]`)?.focus();
    if (opening && !hourly.has(id)) loadHourly(id);
    return;
  }
  const dayBtn = e.target.closest("[data-pmday]");
  if (dayBtn) {
    sel.dayIndex = Number(dayBtn.dataset.pmday);
    rerender();
    ctx.el.querySelector(`[data-pmday="${sel.dayIndex}"]`)?.focus();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
// "2026-07-27" → { wd: "Mon", md: "7/27" }. Built from the string parts so the
// label never shifts across the viewer's own timezone. Today keeps its weekday
// and swaps the date line for "Today" — both fit a narrow phone column.
function dayLabel(date, index) {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y || !m || !d) return { wd: `Day ${index + 1}`, md: index === 0 ? "Today" : "" };
  const wd = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
  return { wd, md: index === 0 ? "Today" : `${m}/${d}` };
}

const longDay = (date) => {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

// "14:00" → "2 PM". The string is already local to the place, so no conversion.
function clock12(clock) {
  const h = Number(String(clock).slice(0, 2));
  if (!Number.isFinite(h)) return clock;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

// The place's own "now" as { date: "YYYY-MM-DD", hour: "HH" }, for highlighting
// and auto-scrolling the current hour into view.
function nowIn(tz) {
  try {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const g = (t) => p.find((x) => x.type === t)?.value;
    return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: g("hour") };
  } catch {
    return { date: "", hour: "" };
  }
}

function hoursHtml(id, day) {
  const data = hourly.get(id);
  if (data === "loading" || data === undefined) return `<p class="muted small">Loading hourly forecast…</p>`;
  if (data === "error") return `<p class="muted small">Hourly forecast unavailable right now.</p>`;
  const hrs = data.get(day.date) || [];
  if (!hrs.length) return `<p class="muted small">No hourly data for this day.</p>`;
  const now = nowIn(ctx.tz);
  const rows = hrs
    .map((h) => {
      const [icon, label] = wmo(h.code);
      const isNow = day.date === now.date && h.clock.slice(0, 2) === now.hour;
      return `<tr class="${isNow ? "pm-now" : ""}">
        <td class="pm-hr-time">${esc(clock12(h.clock))}${isNow ? ' <span class="pm-nowtag">now</span>' : ""}</td>
        <td>${icon} <span class="muted small">${esc(label)}</span></td>
        <td>${temp(h.tempF)}</td>
        <td>${h.rainPct == null ? "—" : `${Math.round(h.rainPct)}%`}</td>
        <td class="pm-hr-wind">${h.windMph == null ? "—" : spd(h.windMph)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="pm-hours"><table class="hourly">
      <thead><tr><th>Time</th><th>Sky</th><th>Temp</th><th>Rain</th><th>Wind</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

function detailHtml({ place, wx }) {
  const days = wx?.days || [];
  if (!days.length) return `<p class="muted small">Forecast unavailable for this place.</p>`;
  const i = Math.min(sel.dayIndex, days.length - 1);
  const day = days[i];
  const [icon, label] = wmo(day.code);

  const strip = days
    .map((d, n) => {
      const { wd, md } = dayLabel(d.date, n);
      const [dIcon] = wmo(d.code);
      const hi = tempVal(d.highF);
      const lo = tempVal(d.lowF);
      return `<button type="button" class="pm-daybtn${n === i ? " active" : ""}" data-pmday="${n}"
                aria-pressed="${n === i ? "true" : "false"}">
        <span class="pm-db-day">${esc(wd)}</span>
        <span class="pm-db-date">${esc(md)}</span>
        <span class="pm-db-icon">${dIcon}</span>
        <span class="pm-db-temp">${hi == null ? "—" : `${hi}°`}<span> / ${lo == null ? "—" : `${lo}°`}</span></span>
      </button>`;
    })
    .join("");

  const summary = [
    label,
    day.highF != null ? `High ${temp(day.highF)}` : null,
    day.lowF != null ? `Low ${temp(day.lowF)}` : null,
    day.rainPct != null ? `${Math.round(day.rainPct)}% chance of rain` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <h3 class="pm-detail-title">${icon} ${esc(place.name)} — ${esc(longDay(day.date))}</h3>
    <p class="pm-detail-sum">${esc(summary)}</p>
    <div class="day-strip pm-daystrip" role="group" aria-label="Choose a day">${strip}</div>
    ${hoursHtml(place.id, day)}`;
}

/** Render the matrix (and any expanded detail) into `el`, wiring interaction. */
export function renderPlaces(el, rows, tz) {
  if (!el) return;
  ctx = { el, rows, tz };
  // A place that is no longer listed (region switch) must not stay expanded.
  if (sel.placeId && !rows.some((r) => r.place.id === sel.placeId)) sel = { placeId: null, dayIndex: 0 };

  const withData = rows.filter((r) => r.wx?.days?.length);
  if (!withData.length) {
    el.innerHTML = `<p class="muted small">Forecast unavailable right now.</p>`;
    return;
  }

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
    .map((row) => {
      const { place, wx } = row;
      const open = sel.placeId === place.id;
      const sub = [place.note, wx?.nowF != null ? `now ${temp(wx.nowF)}` : null].filter(Boolean).join(" · ");
      const header =
        `<th scope="row" class="pm-place">` +
        `<button type="button" class="pm-rowbtn" data-place="${esc(place.id)}" aria-expanded="${open}" aria-controls="pm-detail-${esc(place.id)}">` +
        `<span class="pm-chev" aria-hidden="true">${open ? "▾" : "▸"}</span>` +
        `<span><span class="pm-name">${esc(place.name)}</span>` +
        (sub ? `<span class="pm-sub">${esc(sub)}</span>` : "") +
        `</span></button></th>`;

      const cells = !wx?.days?.length
        ? `<td colspan="${headDays.length}" class="pm-none">Forecast unavailable</td>`
        : headDays
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

      const detail = open
        ? `<tr class="pm-detail-row"><td colspan="${headDays.length + 1}" id="pm-detail-${esc(place.id)}" class="pm-detail">${detailHtml(row)}</td></tr>`
        : "";
      return `<tr class="pm-row${open ? " open" : ""}">${header}${cells}</tr>${detail}`;
    })
    .join("");

  el.innerHTML =
    `<div class="places-scroll">` +
    `<table class="places-matrix"><caption class="sr-only">7-day forecast by destination: high and low temperature in ${tempUnit()} and chance of rain. Choose a place for its daily and hourly detail.</caption>` +
    `<thead>${head}</thead><tbody>${body}</tbody></table></div>`;

  if (!wired.has(el)) {
    el.addEventListener("click", onClick);
    wired.add(el);
  }

  // Start today's hourly list at the current hour rather than at midnight.
  const nowRow = el.querySelector(".pm-hours .pm-now");
  if (nowRow) {
    const box = nowRow.closest(".pm-hours");
    box.scrollTop = Math.max(0, nowRow.offsetTop - box.offsetTop - 4);
  }
}
