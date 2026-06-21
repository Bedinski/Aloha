// app.js — orchestrates the Waikiki Tide / Sun / Surf dashboard.

import { getSunTimes, dayLength } from "./sun.js";
import { getTides } from "./tides.js";
import { getOcean } from "./surf.js";
import { lineChart } from "./chart.js";
import { renderAlerts, renderBuoy } from "./feeds.js";
import { jellyfishHtml } from "./jellyfish.js";
import { getAir, airHtml } from "./air.js";

// ---------------------------------------------------------------------------
// Locations — all near Waikiki / south & east shore of Oahu, which the
// NOAA Honolulu station (1612340) represents accurately for tides. Surf, wind,
// UV and sun are computed from each spot's own coordinates.
// ---------------------------------------------------------------------------
const HONOLULU = "1612340";
const LOCATIONS = [
  { id: "waikiki", name: "Waikiki Beach", lat: 21.2762, lng: -157.8267, station: HONOLULU },
  { id: "kaimana", name: "Kaimana / Sans Souci", lat: 21.266, lng: -157.823, station: HONOLULU },
  { id: "alamoana", name: "Ala Moana Bowls", lat: 21.288, lng: -157.852, station: HONOLULU },
  { id: "hanauma", name: "Hanauma Bay (snorkel)", lat: 21.269, lng: -157.6938, station: HONOLULU },
  { id: "diamondhead", name: "Diamond Head", lat: 21.2545, lng: -157.805, station: HONOLULU },
];

const TZ = "Pacific/Honolulu";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const fmtTime = (d) =>
  d == null
    ? "—"
    : d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

const fmtDay = (d) =>
  d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });

function compass(deg) {
  if (deg == null || Number.isNaN(deg)) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmtDuration(ms) {
  if (ms == null) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function staleLabel(savedAt) {
  if (!savedAt || savedAt === Infinity) return "";
  const mins = Math.round((Date.now() - savedAt) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr ago`;
}

// Hawaii calendar-day anchored at local noon (good reference for sun times).
function hstNoon(offsetDays = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  // 22:00 UTC == 12:00 HST (UTC-10, no DST)
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day") + offsetDays, 22, 0));
}

const isSameHstDay = (a, b) =>
  a.toLocaleDateString("en-CA", { timeZone: TZ }) ===
  b.toLocaleDateString("en-CA", { timeZone: TZ });

// ---------------------------------------------------------------------------
// Descriptors / advice
// ---------------------------------------------------------------------------
function waveDesc(ft) {
  if (ft == null) return "—";
  if (ft < 1) return "Flat";
  if (ft < 2) return "Small";
  if (ft < 4) return "Moderate";
  if (ft < 6) return "Large";
  return "Big";
}

function windDesc(mph) {
  if (mph == null) return "—";
  if (mph < 4) return "Calm";
  if (mph < 12) return "Light";
  if (mph < 18) return "Breezy";
  if (mph < 25) return "Windy";
  return "Strong";
}

function uvInfo(uv) {
  if (uv == null) return { cat: "—", advice: "" };
  if (uv < 3) return { cat: "Low", advice: "Minimal protection needed." };
  if (uv < 6) return { cat: "Moderate", advice: "Wear reef-safe sunscreen." };
  if (uv < 8) return { cat: "High", advice: "SPF + hat; seek shade midday." };
  if (uv < 11) return { cat: "Very High", advice: "Extra protection; limit midday sun." };
  return { cat: "Extreme", advice: "Avoid sun 10 AM–4 PM." };
}

// ---------------------------------------------------------------------------
// Snorkel scoring — calmer water + lighter wind + good daylight = better.
// ---------------------------------------------------------------------------
function snorkelScore(hour, sun) {
  if (hour.waveFt == null && hour.windMph == null) return null;
  const t = hour.time;
  if (sun.sunrise && t < sun.sunrise) return 0;
  if (sun.sunset && t > sun.sunset) return 0;

  let score = 100;
  if (hour.waveFt != null) score -= hour.waveFt * 22;
  if (hour.windMph != null) score -= hour.windMph * 2.2;

  // Best light/visibility mid-day; gentle penalty toward the edges of the day.
  const hr = Number(t.toLocaleTimeString("en-US", { timeZone: TZ, hour12: false, hour: "2-digit" }));
  if (hr < 9) score -= (9 - hr) * 6;
  if (hr > 15) score -= (hr - 15) * 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

const scoreLabel = (s) =>
  s >= 70 ? "Excellent" : s >= 55 ? "Good" : s >= 40 ? "Fair" : "Poor";

// Find contiguous daylight windows scoring >= threshold on a given HST day.
function bestWindows(hourly, sun, dayAnchor, threshold = 55) {
  const scored = hourly
    .filter((h) => isSameHstDay(h.time, dayAnchor))
    .map((h) => ({ ...h, score: snorkelScore(h, sun) }))
    .filter((h) => h.score != null);

  const windows = [];
  let run = null;
  for (const h of scored) {
    if (h.score >= threshold) {
      if (!run) run = { start: h.time, end: h.time, scores: [] };
      run.end = h.time;
      run.scores.push(h.score);
    } else if (run) {
      windows.push(run);
      run = null;
    }
  }
  if (run) windows.push(run);

  return windows
    .map((w) => ({
      start: w.start,
      end: new Date(w.end.getTime() + 3600000), // window covers the last full hour
      avg: Math.round(w.scores.reduce((a, b) => a + b, 0) / w.scores.length),
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// State + DOM
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
let current = LOCATIONS[0];
let customCoords = null; // {lat, lng} from geolocation

function activeCoords() {
  return customCoords || { lat: current.lat, lng: current.lng };
}

function nearestHour(hourly) {
  const now = Date.now();
  let best = null, bestDelta = Infinity;
  for (const h of hourly) {
    const d = Math.abs(h.time.getTime() - now);
    if (d < bestDelta) { bestDelta = d; best = h; }
  }
  return best;
}

function tideNow(curve) {
  const now = Date.now();
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (now >= a.time.getTime() && now <= b.time.getTime()) {
      const f = (now - a.time.getTime()) / (b.time.getTime() - a.time.getTime());
      return a.heightFt + (b.heightFt - a.heightFt) * f;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderNowCards(ocean, tides) {
  const h = nearestHour(ocean.hourly) || {};
  const cur = ocean.current || h;
  const waterWave = h.waveFt;
  const tNow = tideNow(tides.curve);
  const nextTide = tides.highsLows.find((t) => t.time.getTime() > Date.now());
  const uv = uvInfo(cur.uv);

  const card = (icon, label, big, sub, tone) =>
    `<div class="card stat" style="--tone:${tone}"><div class="stat-label">${icon} ${label}</div>` +
    `<div class="stat-big">${big}</div><div class="stat-sub">${sub}</div></div>`;

  $("#now-cards").innerHTML = [
    card("🌡️", "Air", cur.tempF != null ? `${Math.round(cur.tempF)}°F` : "—", "Waikiki air temp", "#f97362"),
    card("🌊", "Surf", waterWave != null ? `${waterWave} ft` : "—", waveDesc(waterWave), "#0d9488"),
    card("💨", "Wind", cur.windMph != null ? `${Math.round(cur.windMph)} mph` : "—", `${compass(cur.windDir)} · ${windDesc(cur.windMph)}`, "#0ea5e9"),
    card("🔆", "UV", cur.uv != null ? Math.round(cur.uv) : "—", uv.cat, "#f59e0b"),
    card("🌙", "Tide now", tNow != null ? `${tNow.toFixed(1)} ft` : "—", nextTide ? `${nextTide.type === "H" ? "High" : "Low"} ${fmtTime(nextTide.time)}` : "", "#6366f1"),
  ].join("");
}

function renderSun() {
  const { lat, lng } = activeCoords();
  const today = getSunTimes(hstNoon(0), lat, lng);
  const row = (label, val) => `<div class="kv"><span>${label}</span><strong>${val}</strong></div>`;
  $("#sun-card").innerHTML =
    row("Sunrise", fmtTime(today.sunrise)) +
    row("Sunset", fmtTime(today.sunset)) +
    row("Solar noon", fmtTime(today.solarNoon)) +
    row("Morning golden hour ends", fmtTime(today.goldenHourEnd)) +
    row("Evening golden hour starts", fmtTime(today.goldenHour)) +
    row("Daylight", fmtDuration(dayLength(today)));
  return today;
}

function renderTides(tides) {
  // Table: next few high/low events
  const upcoming = tides.highsLows.filter((t) => t.time.getTime() > Date.now() - 3600000).slice(0, 6);
  $("#tide-table").innerHTML = upcoming
    .map(
      (t) =>
        `<div class="kv"><span>${t.type === "H" ? "▲ High" : "▼ Low"} · ${fmtTime(t.time)}</span><strong>${t.heightFt.toFixed(1)} ft</strong></div>`
    )
    .join("") || '<p class="muted">No tide data.</p>';

  // Curve for the next ~36h with hi/lo dots
  const fromNow = tides.curve.filter((c) => c.time.getTime() > Date.now() - 3600000).slice(0, 37);
  const markers = tides.highsLows
    .filter((t) => fromNow.length && t.time >= fromNow[0].time && t.time <= fromNow[fromNow.length - 1].time)
    .map((t) => ({ x: t.time, y: t.heightFt, label: t.type }));
  $("#tide-chart").innerHTML = lineChart({
    points: fromNow.map((c) => ({ x: c.time, y: c.heightFt })),
    color: "#0284c7",
    nowAt: new Date(),
    markers,
    unit: "ft",
  });
}

function renderSurf(ocean) {
  const h = nearestHour(ocean.hourly);
  if (h) {
    const row = (label, val) => `<div class="kv"><span>${label}</span><strong>${val}</strong></div>`;
    $("#surf-now").innerHTML =
      row("Wave height", h.waveFt != null ? `${h.waveFt} ft (${waveDesc(h.waveFt)})` : "—") +
      row("Wave period", h.wavePeriod != null ? `${Math.round(h.wavePeriod)} s` : "—") +
      row("Swell", h.swellFt != null ? `${h.swellFt} ft @ ${Math.round(h.swellPeriod || 0)} s ${compass(h.swellDir)}` : "—") +
      row("Wind", h.windMph != null ? `${Math.round(h.windMph)} mph ${compass(h.windDir)} (${windDesc(h.windMph)})` : "—");
  }
  const next36 = ocean.hourly.filter((x) => x.time.getTime() > Date.now() - 3600000 && x.waveFt != null).slice(0, 37);
  $("#surf-chart").innerHTML = lineChart({
    points: next36.map((x) => ({ x: x.time, y: x.waveFt })),
    color: "#0d9488",
    nowAt: new Date(),
    unit: "ft",
  });
}

function renderUv(ocean) {
  const today = ocean.hourly.filter((x) => isSameHstDay(x.time, new Date()) && x.uv != null);
  $("#uv-chart").innerHTML = lineChart({
    points: today.map((x) => ({ x: x.time, y: x.uv })),
    color: "#f59e0b",
    nowAt: new Date(),
  });
  const peak = today.reduce((m, x) => (x.uv > (m?.uv ?? -1) ? x : m), null);
  if (peak) {
    const info = uvInfo(peak.uv);
    $("#uv-note").textContent = `Peak UV today ~${Math.round(peak.uv)} (${info.cat}) around ${fmtTime(peak.time)}. ${info.advice} Hawaii law requires reef-safe sunscreen (no oxybenzone/octinoxate).`;
  }
}

function renderSnorkel(ocean) {
  const { lat, lng } = activeCoords();
  const sunToday = getSunTimes(hstNoon(0), lat, lng);
  const sunTomorrow = getSunTimes(hstNoon(1), lat, lng);

  const block = (title, windows) => {
    if (!windows.length)
      return `<div class="snorkel-day"><h4>${title}</h4><p class="muted">No standout calm windows — water looks choppy.</p></div>`;
    const items = windows
      .map(
        (w) =>
          `<div class="window"><div class="window-time">${fmtTime(w.start)} – ${fmtTime(w.end)}</div>` +
          `<div class="bar"><span style="width:${w.avg}%"></span></div>` +
          `<div class="window-score">${scoreLabel(w.avg)} (${w.avg})</div></div>`
      )
      .join("");
    return `<div class="snorkel-day"><h4>${title}</h4>${items}</div>`;
  };

  const t = bestWindows(ocean.hourly, sunToday, hstNoon(0));
  const tm = bestWindows(ocean.hourly, sunTomorrow, hstNoon(1));
  $("#snorkel-windows").innerHTML =
    block(`Today · ${fmtDay(hstNoon(0))}`, t) + block(`Tomorrow · ${fmtDay(hstNoon(1))}`, tm);
}

function setStatus(ocean, tides) {
  const anyCache = ocean.fromCache || tides.fromCache;
  const saved = Math.min(ocean.savedAt || Infinity, tides.savedAt || Infinity);
  const el = $("#status-line");
  if (anyCache) {
    el.innerHTML = `<span class="badge offline">Offline — cached ${staleLabel(saved)}</span>`;
  } else {
    el.innerHTML = `<span class="badge live">Updated ${staleLabel(saved)}</span>`;
  }
}

// ---------------------------------------------------------------------------
// Load + wire up
// ---------------------------------------------------------------------------
async function load() {
  $("#error-banner").hidden = true;
  $("#status-line").innerHTML = `<span class="badge">Loading…</span>`;
  const { lat, lng } = activeCoords();

  // Sun is local-only, render immediately.
  renderSun();

  try {
    const [tides, ocean] = await Promise.all([getTides(current.station), getOcean(lat, lng)]);
    renderNowCards(ocean, tides);
    renderTides(tides);
    renderSurf(ocean);
    renderUv(ocean);
    renderSnorkel(ocean);
    setStatus(ocean, tides);
  } catch (err) {
    $("#status-line").innerHTML = "";
    const b = $("#error-banner");
    b.hidden = false;
    b.textContent =
      "Couldn't reach the tide/surf services and no cached data is available yet. Check your connection and tap Refresh. (Sun times above are computed offline and remain accurate.)";
    console.error(err);
  }

  // Independent feeds — never block or break the main dashboard.
  renderAlerts("Oahu");
  renderBuoy("233"); // Pearl Harbor / Māmala Bay (south-shore reference)
  const jelly = $("#jelly");
  if (jelly) jelly.innerHTML = jellyfishHtml(); // on-device, no network
  loadAir();
}

// Vog / air quality (Open-Meteo Air Quality, keyless) — independent feed.
async function loadAir() {
  const el = $("#air");
  if (!el) return;
  el.innerHTML = `<p class="muted small">Loading…</p>`;
  try {
    const { lat, lng } = activeCoords();
    el.innerHTML = airHtml(await getAir(lat, lng));
  } catch {
    el.innerHTML = `<p class="muted small">Air quality unavailable right now.</p>`;
  }
}

function buildLocationSelect() {
  const sel = $("#location-select");
  sel.innerHTML = LOCATIONS.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
  sel.value = current.id;
  sel.addEventListener("change", () => {
    current = LOCATIONS.find((l) => l.id === sel.value) || LOCATIONS[0];
    customCoords = null;
    load();
  });
}

function wireGeo() {
  const btn = $("#geo-btn");
  if (!("geolocation" in navigator)) { btn.hidden = true; return; }
  btn.addEventListener("click", () => {
    btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        customCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        btn.textContent = "📍 Using your location";
        load();
      },
      () => {
        btn.textContent = "📍 My location";
        alert("Couldn't get your location. Using the selected spot instead.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  });
}

function init() {
  buildLocationSelect();
  wireGeo();
  $("#refresh-btn").addEventListener("click", load);
  load();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
