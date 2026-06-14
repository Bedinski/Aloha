// alerts.js — active NWS watches/warnings/advisories for Hawaii.
//
// Source: the National Weather Service API (api.weather.gov) — free, no key,
// CORS-enabled for simple GETs. IMPORTANT: do NOT set a custom User-Agent from
// the browser (it's a forbidden header and triggers a CORS preflight failure);
// the browser's default UA is fine. Returns GeoJSON; we keep what matters.

import { fetchJSON } from "./store.js";

const TZ = "Pacific/Honolulu";
const URL = "https://api.weather.gov/alerts/active?area=HI";

const fmtTime = (d) =>
  d == null ? "" : d.toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });

// Match an alert's areaDesc to an island. Statewide/severe alerts show anyway.
// Keyed by an ASCII-normalised island name (see canonIsland) so the ʻokina in
// "Hawaiʻi"/"Kauaʻi" can't cause a mismatch. Tokens are island-SPECIFIC:
// generic words like "windward"/"leeward"/"north shore" are intentionally
// avoided because they also appear in other islands' marine-zone names.
const ISLAND_RE = {
  oahu: /oahu|honolulu|waikiki|waianae|ko.?olau|kaiwi|mamala|kaena|\bewa\b|kailua|kaneohe/i,
  maui: /maui|moloka|lana.?i|kahoolawe|maalaea|\bhana\b|kahului|lahaina|kihei/i,
  kauai: /kaua|niihau|ni.ihau|hanalei|lihue|poipu|na ?pali/i,
  hawaii: /big island|hawaii island|\bkona\b|hilo|kohala|\bpuna\b|ka.u\b|south point|saddle|waikoloa/i,
};

// Strip the ʻokina/diacritics: "Hawaiʻi" -> "hawaii", "Kauaʻi" -> "kauai".
const canonIsland = (s) => (s || "").normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase();

const SEV_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 0 };
const SEV_COLOR = {
  Extreme: "#b91c1c",
  Severe: "#dc2626",
  Moderate: "#ea580c",
  Minor: "#ca8a04",
  Unknown: "#64748b",
};

function iconFor(event = "") {
  const e = event.toLowerCase();
  if (/tsunami/.test(e)) return "🌊";
  if (/hurricane|tropical|typhoon/.test(e)) return "🌀";
  if (/surf/.test(e)) return "🌊";
  if (/rip current|swim|beach/.test(e)) return "🏊";
  if (/flood/.test(e)) return "🌧️";
  if (/wind|gale|craft/.test(e)) return "💨";
  if (/heat/.test(e)) return "🥵";
  if (/fire|red flag/.test(e)) return "🔥";
  if (/thunder/.test(e)) return "⛈️";
  return "⚠️";
}

const shorten = (areaDesc = "") => {
  const parts = areaDesc.split(";").map((s) => s.trim()).filter(Boolean);
  return parts.length <= 2 ? parts.join(", ") : `${parts.slice(0, 2).join(", ")} +${parts.length - 2} more`;
};

// The alerts feed is statewide and island-independent, so cache it briefly in
// memory — switching spots then just re-filters instead of re-hitting the API.
let memo = null; // { at:number, list:Array }
const TTL_MS = 5 * 60 * 1000;

/** @returns {Promise<{list:Array}>} — never throws. */
export async function getAlerts() {
  if (memo && Date.now() - memo.at < TTL_MS) return { list: memo.list };
  try {
    const { data } = await fetchJSON(URL, "alerts:HI");
    const list = (data.features || []).map((f) => {
      const p = f.properties || {};
      return {
        id: f.id,
        event: p.event || "Alert",
        severity: p.severity || "Unknown",
        headline: p.headline || "",
        areaDesc: p.areaDesc || "",
        expires: p.ends || p.expires ? new Date(p.ends || p.expires) : null,
      };
    });
    memo = { at: Date.now(), list };
    return { list };
  } catch {
    return { list: memo ? memo.list : [] };
  }
}

/** Keep alerts relevant to an island (plus any Extreme/Severe), worst first,
 *  de-duplicated by event (NWS often emits one feature per zone), capped. */
export function filterAlerts(list, island) {
  const re = ISLAND_RE[canonIsland(island)] || ISLAND_RE.oahu;
  const relevant = list
    .filter((a) => re.test(a.areaDesc) || a.severity === "Extreme" || a.severity === "Severe")
    .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
  const seen = new Set();
  const deduped = [];
  for (const a of relevant) {
    if (seen.has(a.event)) continue;
    seen.add(a.event);
    deduped.push(a);
  }
  return deduped.slice(0, 6);
}

/** HTML for the alerts banner (empty string when there are none). */
export function alertsHtml(list) {
  if (!list.length) return "";
  return list
    .map((a) => {
      const color = SEV_COLOR[a.severity] || SEV_COLOR.Unknown;
      const until = a.expires ? ` · until ${fmtTime(a.expires)}` : "";
      return `<div class="alert" style="--ac:${color}">
        <div class="alert-event">${iconFor(a.event)} ${a.event}</div>
        <div class="alert-area">${shorten(a.areaDesc)}${until}</div>
      </div>`;
    })
    .join("");
}
