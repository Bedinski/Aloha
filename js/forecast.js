// forecast.js — Surfline-style detailed surf forecast with beach search.

import { SPOTS, searchSpots, getSpot, STATIONS } from "./spots.js";
import { getOcean } from "./surf.js";
import { getTides } from "./tides.js";
import { getSunTimes } from "./sun.js";
import { surfQuality, surfFaceRange, compass, windRelation } from "./rating.js";
import { lineChart } from "./chart.js";
import { renderAlerts, renderBuoy } from "./feeds.js";

const TZ = "Pacific/Honolulu";
const $ = (s) => document.querySelector(s);

// ---------- formatting ----------
const fmtTime = (d) =>
  d == null ? "—" : d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const hstHour = (d) => Number(d.toLocaleString("en-US", { timeZone: TZ, hour12: false, hour: "2-digit" }));
const dayKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const weekday = (d) => d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
const monthDay = (d) => d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });

function relDayLabel(d) {
  const today = dayKey(new Date());
  const tomorrow = dayKey(new Date(Date.now() + 86400000));
  const k = dayKey(d);
  if (k === today) return "Today";
  if (k === tomorrow) return "Tomorrow";
  return weekday(d);
}

function staleLabel(savedAt) {
  if (!savedAt || savedAt === Infinity) return "";
  const mins = Math.round((Date.now() - savedAt) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

// ---------- state ----------
let spot =
  getSpot(location.hash.slice(1)) ||
  getSpot(localStorage.getItem("aloha:lastSpot")) ||
  getSpot("canoes") ||
  SPOTS[0];
let ocean = null;
let tides = null;
let selectedDay = 0; // index into the day buckets

// ---------- data shaping ----------
function bucketDays(hourly) {
  const map = new Map();
  for (const h of hourly) {
    const k = dayKey(h.time);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(h);
  }
  return [...map.values()].slice(0, 7);
}

const nearestHourTo = (hours, targetHstHour) =>
  hours.reduce((best, h) =>
    best == null || Math.abs(hstHour(h.time) - targetHstHour) < Math.abs(hstHour(best.time) - targetHstHour) ? h : best,
  null);

function nearestToNow(hours) {
  const now = Date.now();
  return hours.reduce((b, h) => (b == null || Math.abs(h.time - now) < Math.abs(b.time - now) ? h : b), null);
}

function tideAt(time) {
  const curve = tides?.curve || [];
  const ts = time.getTime();
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (ts >= a.time.getTime() && ts <= b.time.getTime()) {
      const f = (ts - a.time.getTime()) / (b.time.getTime() - a.time.getTime());
      return a.heightFt + (b.heightFt - a.heightFt) * f;
    }
  }
  return null;
}

function tideTrend(time) {
  const before = tideAt(new Date(time.getTime() - 3600000));
  const after = tideAt(new Date(time.getTime() + 3600000));
  if (before == null || after == null) return "";
  if (Math.abs(after - before) < 0.15) return "slack-ish";
  return after > before ? "rising tide" : "dropping tide";
}

function rate(h) {
  return surfQuality({
    waveFt: h.waveFt,
    swellFt: h.swellFt,
    swellPeriod: h.swellPeriod,
    swellDir: h.swellDir,
    windMph: h.windMph,
    windDir: h.windDir,
    facing: spot.facing,
    swellWindow: spot.swellWindow,
  });
}

function factorPct(v) {
  return Math.round(Math.max(0, Math.min(1, v ?? 0)) * 100);
}

function factorMeters(r) {
  const rows = [
    ["Size", r.factors.size],
    ["Period", r.factors.period],
    ["Wind", r.factors.wind],
    ["Direction", r.factors.window],
  ];
  return `<div class="factor-list">${rows.map(([label, value]) => `
    <div class="factor-meter">
      <span>${label}</span>
      <div><i style="width:${factorPct(value)}%"></i></div>
      <strong>${factorPct(value)}</strong>
    </div>`).join("")}</div>`;
}

function bestSessions(days) {
  const candidates = [];
  for (const hours of days) {
    let run = null;
    for (const h of hours) {
      if (h.time.getTime() < Date.now() - 3600000 || hstHour(h.time) < 6 || hstHour(h.time) > 18) {
        if (run) { candidates.push(run); run = null; }
        continue;
      }
      const r = rate(h);
      if (r.score >= 55 && h.waveFt != null) {
        if (!run) run = { start: h.time, end: h.time, hours: [] };
        run.end = h.time;
        run.hours.push({ h, r });
      } else if (run) {
        candidates.push(run);
        run = null;
      }
    }
    if (run) candidates.push(run);
  }

  const windows = candidates.map((w) => {
    const best = w.hours.reduce((a, b) => (b.r.score > a.r.score ? b : a), w.hours[0]);
    const avg = Math.round(w.hours.reduce((sum, x) => sum + x.r.score, 0) / w.hours.length);
    return {
      start: w.start,
      end: new Date(w.end.getTime() + 3600000),
      avg,
      best,
      face: surfFaceRange(best.h.waveFt).label,
      tide: tideAt(best.h.time),
      trend: tideTrend(best.h.time),
    };
  });

  if (windows.length) return windows.sort((a, b) => b.avg - a.avg).slice(0, 3);

  return days
    .flat()
    .filter((h) => h.time.getTime() >= Date.now() - 3600000 && hstHour(h.time) >= 6 && hstHour(h.time) <= 18)
    .map((h) => ({ start: h.time, end: new Date(h.time.getTime() + 3600000), avg: rate(h).score, best: { h, r: rate(h) }, face: surfFaceRange(h.waveFt).label, tide: tideAt(h.time), trend: tideTrend(h.time) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);
}

function dayStats(hours) {
  const daylight = hours.filter((h) => hstHour(h.time) >= 6 && hstHour(h.time) <= 19 && h.waveFt != null);
  const faces = daylight.map((h) => h.waveFt);
  let faceLabel = "—";
  if (faces.length) {
    const maxHs = Math.max(...faces);
    if (maxHs < 0.8) faceLabel = "Flat";
    else {
      const lo = Math.max(1, Math.floor(Math.min(...faces)));
      faceLabel = `${lo}–${Math.max(lo + 1, Math.round(maxHs * 1.5))} ft`;
    }
  }
  const am = nearestHourTo(hours, 9);
  const pm = nearestHourTo(hours, 15);
  return { faceLabel, am: am ? rate(am) : null, pm: pm ? rate(pm) : null };
}

// ---------- rendering ----------
function pill(r) {
  if (!r) return `<span class="pill" style="background:#94a3b8">—</span>`;
  return `<span class="pill" style="background:${r.rating.color}">${r.rating.text}</span>`;
}

function renderHeader() {
  const note = spot.tideNote ? ` · tide ref: ${STATIONS[spot.station]}` : "";
  $("#spot-title").textContent = spot.name;
  $("#spot-meta").innerHTML = `${spot.island} · ${spot.region} · <span class="level">${spot.level}</span>${note}`;
  document.title = `${spot.name} — Surf forecast · Aloha`;
}

function renderNow() {
  const days = bucketDays(ocean.hourly);
  const h = nearestToNow(ocean.hourly);
  if (!h) { $("#now-panel").innerHTML = '<p class="muted">No forecast data.</p>'; return days; }
  const r = rate(h);
  const face = surfFaceRange(h.waveFt);
  const wind = windRelation(h.windDir, spot.facing, h.windMph);
  const nextTide = tides?.highsLows.find((t) => t.time.getTime() > Date.now());

  const stat = (icon, label, val, sub = "", tone = "var(--accent)") =>
    `<div class="fstat" style="--tone:${tone}"><div class="fstat-label">${icon} ${label}</div>` +
    `<div class="fstat-val">${val}</div><div class="fstat-sub">${sub}</div></div>`;

  $("#now-panel").innerHTML = `
    <div class="now-hero">
      <div class="rating-badge" style="--c:${r.rating.color}">
        <div class="rating-score">${r.score}</div>
        <div class="rating-text">${r.rating.text}</div>
      </div>
      <div class="now-face">
        <div class="face-big">${face.label}</div>
        <div class="muted small">surf (face) · updated ${staleLabel(ocean.savedAt)}</div>
      </div>
    </div>
    <div class="fstats">
      ${stat("🌊", "Primary swell", h.swellFt != null ? `${h.swellFt} ft` : "—", h.swellPeriod != null ? `${Math.round(h.swellPeriod)}s ${compass(h.swellDir)} (${Math.round(h.swellDir ?? 0)}°)` : "", "#0d9488")}
      ${stat("〰️", "Wind swell", h.windWaveFt != null ? `${h.windWaveFt} ft` : "—", h.windWavePeriod != null ? `${Math.round(h.windWavePeriod)}s ${compass(h.windWaveDir)}` : "", "#0891b2")}
      ${stat("💨", "Wind", h.windMph != null ? `${Math.round(h.windMph)} mph ${compass(h.windDir)}` : "—", `${wind.label}${h.windGustMph != null ? ` · gust ${Math.round(h.windGustMph)}` : ""}`, "#0ea5e9")}
      ${stat("🌡️", "Water", h.waterTempF != null ? `${h.waterTempF}°F` : "—", h.tempF != null ? `air ${Math.round(h.tempF)}°F` : "", "#f97362")}
      ${stat("🌙", "Next tide", nextTide ? `${nextTide.type === "H" ? "High" : "Low"} ${nextTide.heightFt.toFixed(1)} ft` : "—", nextTide ? fmtTime(nextTide.time) : "", "#6366f1")}
      ${stat("🔆", "UV", h.uv != null ? Math.round(h.uv) : "—", "reef-safe SPF", "#f59e0b")}
    </div>`;

  // 7-day surf-height overview
  $("#overview-chart").innerHTML = lineChart({
    points: ocean.hourly.filter((x) => x.waveFt != null).map((x) => ({ x: x.time, y: x.waveFt })),
    color: "#0d9488",
    height: 140,
    nowAt: new Date(),
    xFmt: (t) => relDayLabel(new Date(t)),
    unit: "ft",
  });

  return days;
}

function renderSessions(days) {
  const sessions = bestSessions(days);
  const offshoreFrom = compass((spot.facing + 180) % 360);
  const windowText = spot.swellWindow
    ? `${compass(spot.swellWindow[0])}-${compass(spot.swellWindow[1])}`
    : "open";

  const cards = sessions
    .map((s, i) => {
      const h = s.best.h;
      const r = s.best.r;
      const wind = windRelation(h.windDir, spot.facing, h.windMph);
      const tide = s.tide != null ? `${s.tide.toFixed(1)} ft · ${s.trend}` : "tide unavailable";
      return `<article class="session-card card">
        <div class="session-rank">#${i + 1}</div>
        <div class="session-top">
          <div>
            <h3>${relDayLabel(s.start)} · ${fmtTime(s.start)}-${fmtTime(s.end)}</h3>
            <p>${s.face} faces · ${wind.label.toLowerCase()} wind</p>
          </div>
          ${pill(r)}
        </div>
        <dl class="session-stats">
          <div><dt>Score</dt><dd>${s.avg}</dd></div>
          <div><dt>Swell</dt><dd>${h.swellFt != null ? `${h.swellFt} ft @ ${Math.round(h.swellPeriod ?? 0)}s ${compass(h.swellDir)}` : "—"}</dd></div>
          <div><dt>Wind</dt><dd>${h.windMph != null ? `${Math.round(h.windMph)} mph ${compass(h.windDir)}` : "—"}</dd></div>
          <div><dt>Tide</dt><dd>${tide}</dd></div>
        </dl>
        <div class="session-reasons">
          <span>size ${factorPct(r.factors.size)}</span>
          <span>period ${factorPct(r.factors.period)}</span>
          <span>wind ${factorPct(r.factors.wind)}</span>
          <span>direction ${factorPct(r.factors.window)}</span>
        </div>
      </article>`;
    })
    .join("");

  $("#session-panel").innerHTML = `
    <div class="rail-head">
      <h2>Best upcoming sessions</h2>
      <span>ranked by size, period, wind, direction, and tide context</span>
    </div>
    <div class="session-grid">${cards}</div>
    <div class="spot-intel">
      <span><strong>${spot.level}</strong> break</span>
      <span>Best wind from ${offshoreFrom}</span>
      <span>Swell window ${windowText}</span>
      <span>Check signs and lifeguards on arrival</span>
    </div>`;
}

function renderDayStrip(days) {
  $("#day-strip").innerHTML = days
    .map((hours, i) => {
      const s = dayStats(hours);
      const d = hours[0].time;
      return `<button class="day-card${i === selectedDay ? " active" : ""}" data-day="${i}">
        <div class="day-name">${relDayLabel(d)}</div>
        <div class="day-date">${monthDay(d)}</div>
        <div class="day-face">${s.faceLabel}</div>
        <div class="day-ampm"><span>AM ${pill(s.am)}</span><span>PM ${pill(s.pm)}</span></div>
      </button>`;
    })
    .join("");
  $("#day-strip").querySelectorAll(".day-card").forEach((btn) =>
    btn.addEventListener("click", () => {
      selectedDay = Number(btn.dataset.day);
      renderDayStrip(days);
      renderDayDetail(days);
    })
  );
}

function renderDayDetail(days) {
  const hours = days[selectedDay] || [];
  if (!hours.length) { $("#day-detail").innerHTML = ""; return; }
  const dayDate = hours[0].time;
  const sun = getSunTimes(hours[0].time, spot.lat, spot.lng);
  const daylight = hours.filter((h) => hstHour(h.time) >= 6 && hstHour(h.time) <= 18 && h.waveFt != null);
  const best = daylight
    .map((h) => ({ h, r: rate(h) }))
    .sort((a, b) => b.r.score - a.r.score)[0] || null;

  // hourly rows at 3-hour steps across the day
  const slots = [6, 9, 12, 15, 18, 21]
    .map((hr) => nearestHourTo(hours, hr))
    .filter((h, i, arr) => h && arr.indexOf(h) === i);

  const rows = slots
    .map((h) => {
      const r = rate(h);
      const wind = windRelation(h.windDir, spot.facing, h.windMph);
      const face = surfFaceRange(h.waveFt);
      return `<tr>
        <td>${fmtTime(h.time)}</td>
        <td>${pill(r)} <span class="muted small">${r.score}</span></td>
        <td>${face.label}</td>
        <td>${h.swellFt != null ? `${h.swellFt}ft ${Math.round(h.swellPeriod ?? 0)}s ${compass(h.swellDir)}` : "—"}</td>
        <td>${h.windMph != null ? `${Math.round(h.windMph)} ${compass(h.windDir)}` : "—"}<br><span class="muted small">${wind.label}</span></td>
      </tr>`;
    })
    .join("");

  // tide events for this day
  const dayTides = (tides?.highsLows || []).filter((t) => dayKey(t.time) === dayKey(dayDate));
  const tideLine = dayTides.length
    ? dayTides.map((t) => `${t.type === "H" ? "▲" : "▼"} ${fmtTime(t.time)} ${t.heightFt.toFixed(1)}ft`).join(" · ")
    : "—";

  $("#day-detail").innerHTML = `
    <h3>${relDayLabel(dayDate)} · ${monthDay(dayDate)}</h3>
    ${best ? `<div class="day-brief">
      <div>
        <span>Best hour</span>
        <strong>${fmtTime(best.h.time)} · ${surfFaceRange(best.h.waveFt).label}</strong>
        <em>${best.r.wind.label} · ${tideAt(best.h.time) != null ? `${tideAt(best.h.time).toFixed(1)} ft ${tideTrend(best.h.time)}` : "tide unavailable"}</em>
      </div>
      ${pill(best.r)}
    </div>
    ${factorMeters(best.r)}` : ""}
    <div class="chart-wrap">${lineChart({
      points: hours.filter((x) => x.waveFt != null).map((x) => ({ x: x.time, y: x.waveFt })),
      color: "#0284c7",
      nowAt: dayKey(dayDate) === dayKey(new Date()) ? new Date() : null,
      unit: "ft",
    })}</div>
    <table class="hourly">
      <thead><tr><th>Time</th><th>Rating</th><th>Surf</th><th>Swell</th><th>Wind</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="muted small">🌅 ${fmtTime(sun.sunrise)} · 🌇 ${fmtTime(sun.sunset)} &nbsp;|&nbsp; 🌊 Tides: ${tideLine}</p>`;
}

// ---------- search ----------
function renderResults(list) {
  const box = $("#search-results");
  if (!list.length) { box.innerHTML = '<div class="no-results">No breaks found.</div>'; box.hidden = false; return; }
  box.innerHTML = list
    .map((s) => `<button class="result" data-id="${s.id}"><strong>${s.name}</strong><span class="muted">${s.island} · ${s.region}</span></button>`)
    .join("");
  box.hidden = false;
  box.querySelectorAll(".result").forEach((b) =>
    b.addEventListener("click", () => {
      selectSpot(getSpot(b.dataset.id));
      $("#search-input").value = "";
      box.hidden = true;
    })
  );
}

function wireSearch() {
  const input = $("#search-input");
  input.addEventListener("input", () => renderResults(searchSpots(input.value)));
  input.addEventListener("focus", () => renderResults(searchSpots(input.value)));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) $("#search-results").hidden = true;
  });
}

// ---------- load ----------
async function selectSpot(next) {
  if (!next) return;
  spot = next;
  selectedDay = 0;
  localStorage.setItem("aloha:lastSpot", spot.id);
  history.replaceState(null, "", `#${spot.id}`);
  await load();
}

async function load() {
  renderHeader();
  $("#status-line").innerHTML = `<span class="badge">Loading ${spot.name}…</span>`;
  $("#error-banner").hidden = true;
  try {
    [ocean, tides] = await Promise.all([getOcean(spot.lat, spot.lng), getTides(spot.station, 7)]);
    const days = renderNow();
    renderSessions(days);
    renderDayStrip(days);
    renderDayDetail(days);
    const cache = ocean.fromCache || tides.fromCache;
    const saved = Math.min(ocean.savedAt || Infinity, tides.savedAt || Infinity);
    $("#status-line").innerHTML = cache
      ? `<span class="badge offline">Offline — cached ${staleLabel(saved)}</span>`
      : `<span class="badge live">Updated ${staleLabel(saved)}</span>`;
  } catch (err) {
    $("#status-line").innerHTML = "";
    $("#session-panel").innerHTML = "";
    const b = $("#error-banner");
    b.hidden = false;
    b.textContent = "Couldn't load the surf forecast and no cached copy exists yet. Check your connection and try again.";
    console.error(err);
  }

  // Independent feeds — scoped to the selected spot's island/buoy.
  renderAlerts(spot.island);
  renderBuoy(spot.buoy);
}

function init() {
  wireSearch();
  $("#refresh-btn").addEventListener("click", load);
  load();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

document.addEventListener("DOMContentLoaded", init);
