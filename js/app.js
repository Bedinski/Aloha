// app.js — orchestrates the Waikiki Tide / Sun / Surf dashboard.

import { getSunTimes, dayLength } from "./sun.js";
import { getTides } from "./tides.js";
import { getOcean } from "./surf.js";
import { lineChart } from "./chart.js";
import { renderAlerts, renderBuoy } from "./feeds.js";
import { jellyfishHtml } from "./jellyfish.js";
import { getAir, airHtml } from "./air.js";
import { hgt, temp, spd, hVal, hUnit, initSettings } from "./units.js";

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

function briefLevel(hour, sun) {
  const score = snorkelScore(hour, sun);
  const wave = hour.waveFt ?? 0;
  const wind = hour.windMph ?? 0;
  const uv = hour.uv ?? 0;

  if (score === 0) {
    return {
      label: "Use the next daylight window",
      tone: "night",
      copy: "Comfort is low right now. Use the next windows below for timing and avoid entering after dark.",
    };
  }
  if (wave >= 5 || wind >= 22) {
    return {
      label: "Shore check only",
      tone: "rough",
      copy: "Surf or wind is elevated. Favor guarded beaches and ask a lifeguard.",
    };
  }
  if (uv >= 8 && score < 70) {
    return {
      label: "Plan shade breaks",
      tone: "sun",
      copy: "Conditions are usable, but the sun load is high during the middle of the day.",
    };
  }
  if (score >= 70) {
    return {
      label: "Go now",
      tone: "good",
      copy: "A strong beach window is lining up: manageable surf, usable wind, and daylight.",
    };
  }
  if (score >= 55) {
    return {
      label: "Good window",
      tone: "ok",
      copy: "Worth going if you choose a protected entry and keep an eye on wind.",
    };
  }
  if (score >= 40) {
    return {
      label: "Choose carefully",
      tone: "watch",
      copy: "Expect some chop or reduced comfort. Protected snorkeling spots should do better.",
    };
  }
  return {
    label: "Wait for calmer water",
    tone: "rough",
    copy: "The next few hours look marginal for casual beach time.",
  };
}

function nextBestWindow(ocean, sun) {
  const today = bestWindows(ocean.hourly, sun, hstNoon(0), 45)[0];
  if (today) return today;
  const tomorrowSun = getSunTimes(hstNoon(1), activeCoords().lat, activeCoords().lng);
  return bestWindows(ocean.hourly, tomorrowSun, hstNoon(1), 45)[0] || null;
}

function renderTripBrief(ocean, tides, sun) {
  const h = nearestHour(ocean.hourly) || {};
  const cur = ocean.current || h;
  const level = briefLevel({ ...h, uv: cur.uv ?? h.uv }, sun);
  const score = snorkelScore({ ...h, uv: cur.uv ?? h.uv }, sun);
  const tNow = tideNow(tides.curve);
  const nextTide = tides.highsLows.find((t) => t.time.getTime() > Date.now());
  const uv = uvInfo(cur.uv ?? h.uv);
  const best = nextBestWindow(ocean, sun);
  const bestText = best
    ? `${fmtTime(best.start)}-${fmtTime(best.end)} · ${scoreLabel(best.avg).toLowerCase()} (${best.avg})`
    : "No standout calm window";

  const metric = (label, value, sub) =>
    `<div class="brief-metric"><span>${label}</span><strong>${value}</strong><em>${sub}</em></div>`;

  $("#trip-brief").innerHTML = `
    <div class="brief-main">
      <div class="brief-kicker">Beach briefing · ${current.name}</div>
      <h2>${level.label}</h2>
      <p>${level.copy}</p>
    </div>
    <div class="brief-score ${level.tone}">
      <span>${score == null ? "—" : score}</span>
      <small>${score == null ? "No read" : scoreLabel(score)}</small>
    </div>
    <div class="brief-grid">
      ${metric("Surf", hgt(h.waveFt), waveDesc(h.waveFt))}
      ${metric("Wind", spd(h.windMph), `${compass(h.windDir)} · ${windDesc(h.windMph)}`)}
      ${metric("Tide", hgt(tNow, 1), nextTide ? `${nextTide.type === "H" ? "High" : "Low"} ${fmtTime(nextTide.time)}` : "No event")}
      ${metric("UV", cur.uv != null ? Math.round(cur.uv) : "—", uv.cat)}
      ${metric("Best window", bestText, "next calm stretch")}
    </div>`;
}

function renderHourPlan(ocean, sun) {
  const now = Date.now();
  const upcoming = [];
  for (const h of ocean.hourly) {
    if (h.time.getTime() < now - 1800000 || h.time.getTime() > now + 14 * 3600000) continue;
    if (!upcoming.length || h.time.getTime() - upcoming[upcoming.length - 1].time.getTime() >= 3 * 3600000) {
      upcoming.push(h);
    }
    if (upcoming.length >= 6) break;
  }

  const item = (h) => {
    const score = snorkelScore(h, sun);
    const tone = score >= 70 ? "good" : score >= 55 ? "ok" : score >= 40 ? "watch" : "rough";
    return `<article class="hour-chip ${tone}">
      <div class="hour-time">${fmtTime(h.time)}</div>
      <strong>${scoreLabel(score || 0)}</strong>
      <span>${hgt(h.waveFt)} surf</span>
      <span>${h.windMph != null ? `${spd(h.windMph)} ${compass(h.windDir)}` : "—"} wind</span>
    </article>`;
  };

  $("#hour-plan").innerHTML = `
    <div class="rail-head">
      <h2>Next beach windows</h2>
      <span>3-hour checkpoints</span>
    </div>
    <div class="hour-track">${upcoming.map(item).join("")}</div>`;
}

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
let last = { ocean: null, tides: null, sun: null }; // for instant unit re-render

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
    card("🌡️", "Air", temp(cur.tempF), "Waikiki air temp", "#f97362"),
    card("🌊", "Surf", hgt(waterWave), waveDesc(waterWave), "#0d9488"),
    card("💨", "Wind", spd(cur.windMph), `${compass(cur.windDir)} · ${windDesc(cur.windMph)}`, "#0ea5e9"),
    card("🔆", "UV", cur.uv != null ? Math.round(cur.uv) : "—", uv.cat, "#f59e0b"),
    card("🌙", "Tide now", hgt(tNow, 1), nextTide ? `${nextTide.type === "H" ? "High" : "Low"} ${fmtTime(nextTide.time)}` : "", "#6366f1"),
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
        `<div class="kv"><span>${t.type === "H" ? "▲ High" : "▼ Low"} · ${fmtTime(t.time)}</span><strong>${hgt(t.heightFt, 1)}</strong></div>`
    )
    .join("") || '<p class="muted">No tide data.</p>';

  // Curve for the next ~36h with hi/lo dots
  const fromNow = tides.curve.filter((c) => c.time.getTime() > Date.now() - 3600000).slice(0, 37);
  const markers = tides.highsLows
    .filter((t) => fromNow.length && t.time >= fromNow[0].time && t.time <= fromNow[fromNow.length - 1].time)
    .map((t) => ({ x: t.time, y: hVal(t.heightFt), label: t.type }));
  $("#tide-chart").innerHTML = lineChart({
    points: fromNow.map((c) => ({ x: c.time, y: hVal(c.heightFt) })),
    color: "#0284c7",
    nowAt: new Date(),
    markers,
    unit: hUnit(),
    label: `Tide height over the next 36 hours, in ${hUnit()}`,
  });
}

function renderSurf(ocean) {
  const h = nearestHour(ocean.hourly);
  if (h) {
    const row = (label, val) => `<div class="kv"><span>${label}</span><strong>${val}</strong></div>`;
    $("#surf-now").innerHTML =
      row("Wave height", h.waveFt != null ? `${hgt(h.waveFt)} (${waveDesc(h.waveFt)})` : "—") +
      row("Wave period", h.wavePeriod != null ? `${Math.round(h.wavePeriod)} s` : "—") +
      row("Swell", h.swellFt != null ? `${hgt(h.swellFt)} @ ${Math.round(h.swellPeriod || 0)} s ${compass(h.swellDir)}` : "—") +
      row("Wind", h.windMph != null ? `${spd(h.windMph)} ${compass(h.windDir)} (${windDesc(h.windMph)})` : "—");
  }
  const next36 = ocean.hourly.filter((x) => x.time.getTime() > Date.now() - 3600000 && x.waveFt != null).slice(0, 37);
  $("#surf-chart").innerHTML = lineChart({
    points: next36.map((x) => ({ x: x.time, y: hVal(x.waveFt) })),
    color: "#0d9488",
    nowAt: new Date(),
    unit: hUnit(),
    label: `Wave height forecast over the next 36 hours, in ${hUnit()}`,
  });
}

function renderUv(ocean) {
  const today = ocean.hourly.filter((x) => isSameHstDay(x.time, new Date()) && x.uv != null);
  $("#uv-chart").innerHTML = lineChart({
    points: today.map((x) => ({ x: x.time, y: x.uv })),
    color: "#f59e0b",
    nowAt: new Date(),
    label: "UV index across today",
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
  $("#trip-brief").innerHTML = `<div class="brief-loading">Building beach briefing…</div>`;
  $("#hour-plan").innerHTML = "";
  const { lat, lng } = activeCoords();

  // Sun is local-only, render immediately.
  const sun = renderSun();

  try {
    const [tides, ocean] = await Promise.all([getTides(current.station), getOcean(lat, lng)]);
    last = { ocean, tides, sun };
    renderTripBrief(ocean, tides, sun);
    renderHourPlan(ocean, sun);
    renderNowCards(ocean, tides);
    renderTides(tides);
    renderSurf(ocean);
    renderUv(ocean);
    renderSnorkel(ocean);
    setStatus(ocean, tides);
  } catch (err) {
    $("#status-line").innerHTML = "";
    $("#trip-brief").innerHTML = `<div class="brief-loading">Sun times are still available offline. Tide and surf data need a first successful connection.</div>`;
    $("#hour-plan").innerHTML = "";
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

// Re-render unit-dependent views from stored data (no refetch).
function applyUnits() {
  const { ocean, tides, sun } = last;
  if (ocean && tides && sun) {
    renderTripBrief(ocean, tides, sun);
    renderHourPlan(ocean, sun);
    renderNowCards(ocean, tides);
    renderTides(tides);
    renderSurf(ocean);
  }
  renderBuoy("233"); // buoy height re-renders (in-memory cache → instant)
}

function init() {
  buildLocationSelect();
  wireGeo();
  initSettings(applyUnits);
  $("#refresh-btn").addEventListener("click", load);
  load();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
