// air.js — vog / air quality via the Open-Meteo Air-Quality API (keyless,
// CORS-enabled, same infra as the weather/marine feeds we already use).
// Surfaces US AQI + a vog hint from SO₂ (relevant on Oʻahu when it's hazy).

import { fetchJSON } from "./store.js";

const TZ = "Pacific/Honolulu";
const parseHst = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) + 10 * 3600 * 1000);
};

export async function getAir(lat, lng) {
  const p = new URLSearchParams({
    latitude: lat, longitude: lng,
    hourly: "us_aqi,pm2_5,sulphur_dioxide",
    timezone: TZ, forecast_days: "1",
  });
  const { data } = await fetchJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?${p}`, `air:${lat},${lng}`);
  const h = data.hourly || {};
  const times = h.time || [];
  if (!times.length) return null;
  const now = Date.now();
  let idx = 0, best = Infinity;
  times.forEach((t, i) => { const d = Math.abs(parseHst(t) - now); if (d < best) { best = d; idx = i; } });
  return { usAqi: h.us_aqi?.[idx] ?? null, pm25: h.pm2_5?.[idx] ?? null, so2: h.sulphur_dioxide?.[idx] ?? null };
}

// Colours double as pill backgrounds, so white text on them clears WCAG AA.
function aqiInfo(aqi) {
  if (aqi == null) return { cat: "—", color: "#64748b" };
  if (aqi <= 50) return { cat: "Good", color: "#15803d" };
  if (aqi <= 100) return { cat: "Moderate", color: "#a16207" };
  if (aqi <= 150) return { cat: "Unhealthy for sensitive", color: "#c2410c" };
  if (aqi <= 200) return { cat: "Unhealthy", color: "#b91c1c" };
  if (aqi <= 300) return { cat: "Very unhealthy", color: "#6d28d9" };
  return { cat: "Hazardous", color: "#7f1d1d" };
}

// Rough vog read from SO₂ concentration (µg/m³).
const vog = (so2) =>
  so2 == null ? "" : so2 < 40 ? "vog: low" : so2 < 200 ? "vog: moderate" : "vog: high";

export function airHtml(a, showVog = true) {
  if (!a || a.usAqi == null) return `<p class="muted small">Air quality unavailable.</p>`;
  const info = aqiInfo(a.usAqi);
  const sub = [a.pm25 != null ? `PM2.5 ${Math.round(a.pm25)}` : null, showVog ? vog(a.so2) : null].filter(Boolean).join(" · ");
  return `
    <div class="buoy-reading">
      <div class="buoy-big">AQI ${Math.round(a.usAqi)}</div>
      <div class="buoy-sub" style="margin-top:5px"><span class="pill" style="background:${info.color}">${info.cat}</span>${sub ? ` · ${sub}` : ""}</div>
    </div>`;
}
