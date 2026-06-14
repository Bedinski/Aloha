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
const ISLAND_RE = {
  Oahu: /oahu|honolulu|waikiki|waianae|ko.?olau|kaiwi|mamala|kaena|\bewa\b|kailua|kaneohe|north shore|windward|leeward/i,
  Maui: /maui|moloka|lana.?i|kahoolawe|maalaea|\bhana\b|kahului|lahaina|kihei/i,
  "Kauaʻi": /kaua|niihau|ni.ihau|hanalei|lihue|poipu|na pali|napali/i,
  "Hawaiʻi": /big island|hawaii island|\bkona\b|hilo|kohala|\bpuna\b|ka.u\b|south point|saddle|waikoloa|mauna/i,
};

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

/** @returns {Promise<{list:Array, fromCache:boolean}>} — never throws. */
export async function getAlerts() {
  try {
    const { data, fromCache } = await fetchJSON(URL, "alerts:HI");
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
    return { list, fromCache };
  } catch {
    return { list: [], fromCache: false };
  }
}

/** Keep alerts relevant to an island (plus any Extreme/Severe), worst first. */
export function filterAlerts(list, island) {
  const re = ISLAND_RE[island] || ISLAND_RE.Oahu;
  return list
    .filter((a) => re.test(a.areaDesc) || a.severity === "Extreme" || a.severity === "Severe")
    .sort((a, b) => (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0));
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
