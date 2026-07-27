// units.js — user unit preferences with formatters, persisted in localStorage.
// The app's canonical internal units are FEET, °F, and MPH; everything is
// stored that way and converted only at display time.

const KEY = "aloha:units";
const DEFAULTS = { height: "ft", temp: "F", speed: "mph" };
const FT_TO_M = 0.3048;

let u = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return { ...DEFAULTS }; }
})();

export const getUnits = () => ({ ...u });
export function setUnit(key, val) {
  if (!(key in DEFAULTS)) return;
  u = { ...u, [key]: val };
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* private mode */ }
}

// strip trailing zeros: 4.0 -> "4", 4.2 -> "4.2"
const trim = (v, dec) => `${+Number(v).toFixed(dec)}`;

// ---- height (canonical feet) ----
export const hUnit = () => (u.height === "m" ? "m" : "ft");
export const hVal = (ft) => (ft == null ? null : u.height === "m" ? ft * FT_TO_M : ft);
export function hgt(ft, dec = 1) {
  if (ft == null) return "—";
  return u.height === "m" ? `${(ft * FT_TO_M).toFixed(1)} m` : `${trim(ft, dec)} ft`;
}
export function hgtRange(loFt, hiFt) {
  if (loFt == null) return "—";
  return u.height === "m"
    ? `${(loFt * FT_TO_M).toFixed(1)}–${(hiFt * FT_TO_M).toFixed(1)} m`
    : `${Math.round(loFt)}–${Math.round(hiFt)} ft`;
}

// ---- temperature (canonical °F) ----
export const tempUnit = () => (u.temp === "C" ? "°C" : "°F");
// Rounded value in the active unit, no suffix — for dense views (e.g. the
// multi-day forecast grid) that label the unit once instead of per cell.
export const tempVal = (f) =>
  f == null ? null : Math.round(u.temp === "C" ? ((f - 32) * 5) / 9 : f);
export function temp(f) {
  if (f == null) return "—";
  return `${tempVal(f)}${tempUnit()}`;
}

// ---- wind speed (canonical mph) ----
export const spdUnit = () => (u.speed === "kt" ? "kt" : "mph");
export function spd(mph) {
  if (mph == null) return "—";
  const v = u.speed === "kt" ? mph * 0.868976 : mph;
  return `${Math.round(v)} ${spdUnit()}`;
}

// ---- settings UI wiring (shared by both pages) ----
// Expects a container with buttons: <button data-unit="height" data-val="m">.
export function initSettings(onChange) {
  const btns = document.querySelectorAll(".settings [data-unit]");
  const sync = () => btns.forEach((b) => {
    const on = u[b.dataset.unit] === b.dataset.val;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  btns.forEach((b) =>
    b.addEventListener("click", () => {
      setUnit(b.dataset.unit, b.dataset.val);
      sync();
      onChange && onChange();
    })
  );
  sync();
}
