// rating.js — transparent surf-quality heuristic (a Surfline-style read built
// from open model data). Not affiliated with Surfline; it's our own scoring.
//
// Inputs are per-hour: wave/swell height (ft), swell period (s), wind speed
// (mph) and direction (deg FROM), plus the break's `facing` bearing and
// optional `swellWindow`. Outputs a 0-100 score, a worded rating, a colour,
// and the human-readable factors behind it.

// Smallest absolute angle between two compass bearings (0-180).
export function angleDiff(a, b) {
  let d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

const compassDirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export const compass = (deg) =>
  deg == null || Number.isNaN(deg) ? "" : compassDirs[Math.round(deg / 22.5) % 16];

/**
 * Wind relative to a break. Offshore = blowing from land out to sea, which
 * grooms the waves; onshore = blowing in, which adds chop. Offshore wind comes
 * FROM the direction opposite the way the beach faces.
 */
export function windRelation(windFromDeg, facingDeg, windMph) {
  if (windFromDeg == null || facingDeg == null)
    return { label: "—", quality: 0.6, kind: "unknown" };
  if (windMph != null && windMph < 4)
    return { label: "Glassy", quality: 0.95, kind: "glassy" };

  const offFrom = (facingDeg + 180) % 360; // ideal offshore source
  const off = angleDiff(windFromDeg, offFrom);

  let kind, quality;
  if (off <= 45) { kind = "offshore"; quality = 0.95; }
  else if (off <= 90) { kind = "cross-offshore"; quality = 0.8; }
  else if (off <= 135) { kind = "cross-onshore"; quality = 0.45; }
  else { kind = "onshore"; quality = 0.2; }

  // Strong onshore blows it out; strong offshore can be too much, too.
  if (windMph != null) {
    if (kind === "onshore" && windMph > 20) quality = 0.1;
    if (kind === "offshore" && windMph > 25) quality = 0.7;
  }
  const label = kind.charAt(0).toUpperCase() + kind.slice(1);
  return { label, quality, kind, dir: compass(windFromDeg) };
}

// Longer-period swell carries more energy and breaks cleaner.
function periodFactor(period) {
  if (period == null) return 0.6;
  if (period >= 14) return 1.0;
  if (period >= 12) return 0.9;
  if (period >= 10) return 0.75;
  if (period >= 8) return 0.55;
  if (period >= 6) return 0.35;
  return 0.2;
}

// More size is better up to a point; very big closes out for most.
function sizeFactor(ft) {
  if (ft == null || ft < 0.7) return 0.05;
  if (ft < 1.5) return 0.45;
  if (ft < 3) return 0.75;
  if (ft < 5) return 0.95;
  if (ft < 9) return 1.0;
  if (ft < 15) return 0.9;
  return 0.7;
}

// Is the swell actually pointed at the break?
function windowFactor(swellDir, swellWindow) {
  if (swellDir == null || !swellWindow) return 1;
  let [lo, hi] = swellWindow;
  const inArc =
    lo <= hi ? swellDir >= lo && swellDir <= hi : swellDir >= lo || swellDir <= hi; // wrap past N
  if (inArc) return 1;
  // graceful falloff just outside the window
  const edge = Math.min(angleDiff(swellDir, lo), angleDiff(swellDir, hi));
  return edge <= 25 ? 0.7 : 0.45;
}

// Colours are chosen so WHITE text on them clears WCAG AA (contrast ≥ 4.5).
const RATINGS = [
  { max: 8, text: "Flat", color: "#64748b" },
  { max: 22, text: "Very poor", color: "#be123c" },
  { max: 35, text: "Poor", color: "#c2410c" },
  { max: 48, text: "Poor–Fair", color: "#b45309" },
  { max: 60, text: "Fair", color: "#4d7c0f" },
  { max: 72, text: "Fair–Good", color: "#15803d" },
  { max: 84, text: "Good", color: "#0f766e" },
  { max: 93, text: "Very good", color: "#0e7490" },
  { max: 101, text: "Epic", color: "#6d28d9" },
];

export function ratingFor(score) {
  return RATINGS.find((r) => score < r.max) || RATINGS[RATINGS.length - 1];
}

/**
 * Score one hour at a break.
 * @returns {{score:number, rating:{text:string,color:string}, wind:object,
 *            factors:{size:number,period:number,wind:number,window:number}}}
 */
export function surfQuality({ waveFt, swellFt, swellPeriod, swellDir, windMph, windDir, facing, swellWindow }) {
  const size = sizeFactor(swellFt ?? waveFt);
  const period = periodFactor(swellPeriod);
  const wind = windRelation(windDir, facing, windMph);
  const win = windowFactor(swellDir, swellWindow);

  // Flat water can't be good no matter the wind.
  let score = 100 * (0.42 * size + 0.33 * wind.quality + 0.25 * period) * win;
  if ((swellFt ?? waveFt ?? 0) < 0.7) score = Math.min(score, 6);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    rating: ratingFor(score),
    wind,
    factors: { size, period, wind: wind.quality, window: win },
  };
}

/** A plain-language one-liner about current conditions (Surfline-style).
 *  `faceLabel` is already unit-formatted; `wind` is a windRelation() result. */
export function conditionsSummary({ waveFt, faceLabel, swellPeriod, swellDir, wind, ratingText }) {
  if (waveFt == null || waveFt < 0.8) return "Flat — nothing much to ride right now.";
  const clean =
    !wind || wind.kind === "glassy" || wind.kind === "offshore" ? "Clean" :
    wind.kind === "cross-offshore" ? "Fairly clean" :
    wind.kind === "onshore" ? "Choppy" : "Bumpy";
  const dir = compass(swellDir);
  const per = swellPeriod != null ? ` at ${Math.round(swellPeriod)}s` : "";
  const windPhrase =
    !wind || wind.kind === "unknown" ? "" :
    wind.kind === "glassy" ? ", glassy" : `, ${wind.label.toLowerCase()} wind`;
  const tail = ratingText ? ` — ${ratingText.toLowerCase()}.` : ".";
  return `${clean} ${faceLabel}${dir ? " " + dir : ""} swell${per}${windPhrase}${tail}`;
}

/** Significant wave height (ft) -> a Surfline-style breaking-face range. */
export function surfFaceRange(hsFt) {
  if (hsFt == null) return { min: 0, max: 0, label: "—" };
  if (hsFt < 0.8) return { min: 0, max: 0, label: "Flat" };
  const min = Math.max(1, Math.floor(hsFt));
  const max = Math.max(min + 1, Math.round(hsFt * 1.5));
  return { min, max, label: `${min}–${max} ft` };
}
