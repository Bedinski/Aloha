// jellyfish.js — box-jellyfish influx window for Waikiki / south-shore Oʻahu.
//
// Box jellyfish arrive on south-facing Oʻahu shores roughly 8–10 days after
// each full moon (Waikiki Aquarium). Computed fully on-device from the lunar
// cycle — no network, works offline. Approximate (synodic-month model), so it
// flags a window, not an exact day.

const TZ = "Pacific/Honolulu";
const SYNODIC_DAYS = 29.530588853;
const SYNODIC = SYNODIC_DAYS * 86400000;
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // a known new moon (UTC)
const DAY = 86400000;

const fmtDay = (d) =>
  d.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });

export function jellyfishStatus(date = new Date()) {
  const phase = (((date.getTime() - NEW_MOON_EPOCH) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0=new, .5=full
  const daysSinceFull = ((phase - 0.5 + 1) % 1) * SYNODIC_DAYS;
  const lastFull = date.getTime() - daysSinceFull * DAY;

  // Show the relevant cycle: the current one until ~day 11, else the next.
  const fullRef = daysSinceFull > 11 ? lastFull + SYNODIC : lastFull;
  const windowStart = new Date(fullRef + 8 * DAY);
  const windowEnd = new Date(fullRef + 10 * DAY);

  let risk; // high = in/at window, soon = approaching, low = otherwise
  if (daysSinceFull >= 7.5 && daysSinceFull <= 11) risk = "high";
  else if (daysSinceFull >= 5 && daysSinceFull < 7.5) risk = "soon";
  else risk = "low";

  return { daysSinceFull, risk, windowStart, windowEnd };
}

const RISK = {
  high: { label: "Likely now", color: "#dc2626", line: "Box jellyfish are likely in the water." },
  soon: { label: "Approaching", color: "#c2410c", line: "Arriving in the next few days." },
  low: { label: "Low risk", color: "#0f766e", line: "Outside the typical influx window." },
};

export function jellyfishHtml(date = new Date()) {
  const s = jellyfishStatus(date);
  const r = RISK[s.risk];
  return `
    <div class="buoy-reading">
      <div><span class="risk" style="background:${r.color}">${r.label}</span></div>
      <div class="buoy-sub" style="margin-top:7px">${r.line}</div>
      <div class="buoy-sub">Next likely window: <strong>${fmtDay(s.windowStart)}–${fmtDay(s.windowEnd)}</strong></div>
      <div class="buoy-sub">≈ 8–10 days after the full moon · south shore</div>
    </div>`;
}
