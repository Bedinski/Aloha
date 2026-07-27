// mocks.mjs — realistic external-API mocks + request interception, shared by
// the screenshot and audit harnesses so pages render fully populated offline.
const fmtParts = (t, withHour) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit",
    day: "2-digit", ...(withHour ? { hour: "2-digit", hourCycle: "h23" } : {}),
  }).formatToParts(t);
const g = (parts, k) => parts.find((x) => x.type === k).value;
const np = fmtParts(new Date(), false);
const baseUTC = Date.UTC(+g(np, "year"), +g(np, "month") - 1, +g(np, "day"), 10, 0);
const isoT = (i, sep) => {
  const p = fmtParts(new Date(baseUTC + i * 3600000), true);
  return `${g(p, "year")}-${g(p, "month")}-${g(p, "day")}${sep}${g(p, "hour")}:00`;
};
// UTC wall-clock string, matching NOAA's time_zone=gmt output.
const gmtT = (i) => new Date(baseUTC + i * 3600000).toISOString().slice(0, 16).replace("T", " ");
const HON_OFFSET = -36000; // Pacific/Honolulu utc_offset_seconds
const N = 168;
const marineHourly = { time: [], wave_height: [], wave_direction: [], wave_period: [], wave_peak_period: [],
  swell_wave_height: [], swell_wave_period: [], swell_wave_peak_period: [], swell_wave_direction: [],
  wind_wave_height: [], wind_wave_period: [], wind_wave_peak_period: [], wind_wave_direction: [], sea_surface_temperature: [] };
const wxHourly = { time: [], temperature_2m: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [], uv_index: [] };
const airHourly = { time: [], us_aqi: [], pm2_5: [], sulphur_dioxide: [] };
for (let i = 0; i < N; i++) {
  const t = isoT(i, "T"); const hr = i % 24;
  marineHourly.time.push(t);
  marineHourly.wave_height.push(0.9 + 0.4 * Math.sin(i / 7));
  marineHourly.wave_direction.push(198); marineHourly.wave_period.push(13 + 2 * Math.sin(i / 11));
  marineHourly.wave_peak_period.push(15 + 2 * Math.sin(i / 11));
  marineHourly.swell_wave_height.push(0.8 + 0.35 * Math.sin(i / 7));
  marineHourly.swell_wave_period.push(14); marineHourly.swell_wave_peak_period.push(16); marineHourly.swell_wave_direction.push(200);
  marineHourly.wind_wave_height.push(0.3); marineHourly.wind_wave_period.push(6); marineHourly.wind_wave_peak_period.push(7); marineHourly.wind_wave_direction.push(70);
  marineHourly.sea_surface_temperature.push(26.4);
  wxHourly.time.push(t);
  wxHourly.temperature_2m.push(81 + 3 * Math.sin((hr - 14) / 24 * Math.PI * 2));
  wxHourly.wind_speed_10m.push(8 + 4 * Math.sin(i / 5));
  wxHourly.wind_direction_10m.push(60); wxHourly.wind_gusts_10m.push(16);
  wxHourly.uv_index.push(Math.max(0, 10 * Math.sin((hr - 6) / 12 * Math.PI)));
  airHourly.time.push(t);
  airHourly.us_aqi.push(28 + Math.round(8 * Math.sin(i / 9)));
  airHourly.pm2_5.push(5 + 2 * Math.sin(i / 9)); airHourly.sulphur_dioxide.push(3 + 2 * Math.sin(i / 6));
}
const tideHilo = { predictions: [] };
const tideH = { predictions: [] };
for (let d = 0; d < 3; d++) {
  tideHilo.predictions.push({ t: gmtT(d * 24 + 4), v: "0.20", type: "L" });
  tideHilo.predictions.push({ t: gmtT(d * 24 + 10), v: "1.85", type: "H" });
  tideHilo.predictions.push({ t: gmtT(d * 24 + 16), v: "0.55", type: "L" });
  tideHilo.predictions.push({ t: gmtT(d * 24 + 22), v: "1.40", type: "H" });
}
for (let i = 0; i < 72; i++) tideH.predictions.push({ t: gmtT(i), v: (1 + Math.sin(i / 3)).toFixed(3) });
const alertsGeo = { features: [
  { id: "a1", properties: { event: "High Surf Advisory", severity: "Moderate", headline: "High Surf Advisory",
    areaDesc: "Oahu North Shore; Oahu West Facing Shores", ends: new Date(Date.now() + 6 * 3.6e6).toISOString() } },
  { id: "a2", properties: { event: "Small Craft Advisory", severity: "Moderate", headline: "Small Craft Advisory",
    areaDesc: "Kaiwi Channel; Oahu Windward Waters", ends: new Date(Date.now() + 12 * 3.6e6).toISOString() } },
] };
const alertsCA = { features: [
  { id: "c1", properties: { event: "High Surf Advisory", severity: "Moderate", headline: "High Surf Advisory",
    areaDesc: "San Diego County Coastal Areas; Orange County Coastal", ends: new Date(Date.now() + 8 * 3.6e6).toISOString() } },
  { id: "c2", properties: { event: "Beach Hazards Statement", severity: "Moderate", headline: "Beach Hazards Statement",
    areaDesc: "San Diego County Coastal Areas", ends: new Date(Date.now() + 10 * 3.6e6).toISOString() } },
] };
function buoyJsonp(url) {
  const cb = (url.match(/\.jsonp=([^&]+)/) || [])[1] || "cb";
  const sid = (url.match(/station_id=%22(\d+)%22/) || [])[1] || "233";
  const table = { table: { columnNames: ["station_id", "time", "waveHs", "waveTp", "waveDp"],
    rows: [[sid, new Date(Date.now() - 22 * 60000).toISOString(), 0.82, 13.5, 201]] } };
  return `${cb}(${JSON.stringify(table)});`;
}
// Around-the-island panel: compact current+daily payload, varied per latitude
// so the five destination cards don't all render identically.
function placesForecast(url) {
  const lat = parseFloat((url.match(/latitude=([-\d.]+)/) || [])[1] || "21.3");
  const k = Math.min(5, Math.max(0, Math.round((lat - 21.2) * 10)));
  const code = [0, 1, 2, 3, 80, 61][k % 6];
  const now = 84 - k;
  return {
    utc_offset_seconds: HON_OFFSET,
    current: { temperature_2m: now, weather_code: code },
    daily: {
      time: [isoT(0, "T").slice(0, 10), isoT(24, "T").slice(0, 10)],
      weather_code: [code, [2, 3, 80, 1, 0, 61][(k + 2) % 6]],
      temperature_2m_max: [now + 3, now + 2],
      temperature_2m_min: [now - 10, now - 9],
      precipitation_probability_max: [10 + k * 12, 15 + k * 8],
    },
  };
}
function mockFor(url) {
  if (url.includes("marine-api.open-meteo.com")) return { ct: "application/json", body: JSON.stringify({ utc_offset_seconds: HON_OFFSET, hourly: marineHourly }) };
  if (url.includes("air-quality-api.open-meteo.com")) return { ct: "application/json", body: JSON.stringify({ hourly: airHourly }) };
  if (url.includes("api.open-meteo.com/v1/forecast") && url.includes("daily="))
    return { ct: "application/json", body: JSON.stringify(placesForecast(url)) };
  if (url.includes("api.open-meteo.com/v1/forecast")) return { ct: "application/json", body: JSON.stringify({
    utc_offset_seconds: HON_OFFSET,
    current: { temperature_2m: 83, wind_speed_10m: 9, wind_direction_10m: 60, wind_gusts_10m: 17, uv_index: 8 }, hourly: wxHourly }) };
  if (url.includes("tidesandcurrents.noaa.gov") && url.includes("interval=hilo")) return { ct: "application/json", body: JSON.stringify(tideHilo) };
  if (url.includes("tidesandcurrents.noaa.gov")) return { ct: "application/json", body: JSON.stringify(tideH) };
  if (url.includes("api.weather.gov")) return { ct: "application/geo+json", body: JSON.stringify(url.includes("area=CA") ? alertsCA : alertsGeo) };
  if (url.includes("pae-paha.pacioos.hawaii.edu") || url.includes("erddap.cdip.ucsd.edu")) return { ct: "application/javascript", body: buoyJsonp(url) };
  return null;
}
export async function attachMocks(page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.endsWith("service-worker.js")) return req.respond({ status: 200, contentType: "application/javascript", body: "/* noop */" });
    const m = mockFor(u);
    if (m) return req.respond({ status: 200, contentType: m.ct, headers: { "Access-Control-Allow-Origin": "*" }, body: m.body });
    req.continue();
  });
}
