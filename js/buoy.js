// buoy.js — real-time wave-buoy readings from the CDIP Datawell Waverider
// network, via the PacIOOS ERDDAP mirror.
//
// Why JSONP: ERDDAP has CORS off by default, so a normal cross-origin fetch()
// would be blocked. JSONP (a <script> tag) sidesteps CORS entirely — no proxy,
// no API key. Dataset `cdip_wave_agg` aggregates every CDIP buoy; we select one
// by its 3-digit CDIP station_id and take the latest quality-controlled row.
// Browse/verify: https://pae-paha.pacioos.hawaii.edu/erddap/tabledap/cdip_wave_agg.html

import { compass } from "./rating.js";

const ERDDAP =
  "https://pae-paha.pacioos.hawaii.edu/erddap/tabledap/cdip_wave_agg.jsonp";
const M_TO_FT = 3.28084;
const CACHE = "aloha:buoy:";

// CDIP station_id -> friendly metadata (NDBC number for reference).
export const BUOYS = {
  "106": { name: "Waimea Bay", ndbc: "51201" },
  "233": { name: "Pearl Harbor · Māmala Bay", ndbc: "51211" },
  "098": { name: "Mokapu Point", ndbc: "51202" },
};

// Load a JSONP URL by injecting a <script>; resolves with the callback payload.
function jsonp(baseUrl, { timeoutMs = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    const cb = "__aloha_buoy_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let settled = false;
    const cleanup = () => {
      settled = true;
      delete window[cb];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (!settled) { cleanup(); reject(new Error("buoy timeout")); }
    }, timeoutMs);
    window[cb] = (data) => { if (!settled) { cleanup(); resolve(data); } };
    script.onerror = () => { if (!settled) { cleanup(); reject(new Error("buoy load error")); } };
    script.src = `${baseUrl}&.jsonp=${cb}`;
    document.head.appendChild(script);
  });
}

function buildUrl(stationId) {
  const since = new Date(Date.now() - 3 * 86400000)
    .toISOString()
    .replace(/\.\d+Z$/, "Z"); // ERDDAP-friendly ISO, no millis
  const vars = "station_id,time,waveHs,waveTp,waveDp";
  const query =
    vars +
    `&station_id=%22${stationId}%22` +
    `&time%3E=${since}` +
    `&waveFlagPrimary=1` +
    `&orderByMax(%22station_id,time%22)`;
  return `${ERDDAP}?${query}`;
}

// Parse ERDDAP's { table: { columnNames, rows } } into the latest reading.
function parse(data) {
  const t = data && data.table;
  if (!t || !t.rows || !t.rows.length) return null;
  const col = (n) => t.columnNames.indexOf(n);
  const row = t.rows[t.rows.length - 1];
  const hs = row[col("waveHs")];
  if (hs == null) return null;
  return {
    heightFt: hs * M_TO_FT,
    periodS: row[col("waveTp")],
    dirDeg: row[col("waveDp")],
    time: new Date(row[col("time")]),
  };
}

/**
 * Latest reading for one CDIP buoy. Caches last-good in localStorage so it
 * survives an offline reload. Throws only if it fails AND no cache exists.
 */
export async function getBuoy(stationId) {
  try {
    const reading = parse(await jsonp(buildUrl(stationId)));
    if (!reading) throw new Error("no rows");
    localStorage.setItem(
      CACHE + stationId,
      JSON.stringify({ savedAt: Date.now(), reading: { ...reading, time: reading.time.toISOString() } })
    );
    return { ...reading, fromCache: false };
  } catch (err) {
    const raw = localStorage.getItem(CACHE + stationId);
    if (raw) {
      const c = JSON.parse(raw);
      return { ...c.reading, time: new Date(c.reading.time), fromCache: true };
    }
    throw err;
  }
}

function obsAgo(date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
}

/** HTML for a buoy reading card body. */
export function buoyHtml(reading, stationId) {
  const meta = BUOYS[stationId];
  if (!reading || !meta) return `<p class="muted small">Buoy data unavailable right now.</p>`;
  const dir = reading.dirDeg != null ? `${compass(reading.dirDeg)} (${Math.round(reading.dirDeg)}°)` : "";
  const per = reading.periodS != null ? `@ ${Math.round(reading.periodS)} s` : "";
  return `
    <div class="buoy-reading">
      <div class="buoy-big">${reading.heightFt.toFixed(1)} ft<span>${per}</span></div>
      <div class="buoy-sub">${dir} · ${meta.name} buoy (NDBC ${meta.ndbc})</div>
      <div class="buoy-sub">observed ${obsAgo(reading.time)}${reading.fromCache ? " · cached" : ""}</div>
    </div>`;
}
