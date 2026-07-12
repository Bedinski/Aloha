// feeds.js — shared rendering for the live feeds (alerts + buoy) used by both
// the dashboard and the surf-forecast page. Keeps the two pages DRY.

import { getAlerts, filterAlerts, alertsHtml } from "./alerts.js";
import { getBuoy, buoyHtml, BUOYS } from "./buoy.js";

/** Render the NWS advisory banner into #alerts. Never throws.
 *  @param area two-letter state ("HI"/"CA"), region name, and display tz. */
export async function renderAlerts(area, region, tz) {
  const el = document.getElementById("alerts");
  if (!el) return;
  const { list } = await getAlerts(area);
  el.innerHTML = alertsHtml(filterAlerts(list, region), tz);
}

/** Render the latest reading for a CDIP buoy into #buoy (hides panel if none). */
export async function renderBuoy(stationId) {
  const el = document.getElementById("buoy");
  if (!el) return;
  const panel = document.getElementById("buoy-panel");
  if (!stationId || !BUOYS[stationId]) {
    if (panel) panel.hidden = true;
    return;
  }
  if (panel) panel.hidden = false;
  el.innerHTML = `<p class="muted small">Loading buoy…</p>`;
  try {
    el.innerHTML = buoyHtml(await getBuoy(stationId), stationId);
  } catch {
    el.innerHTML = `<p class="muted small">Buoy data unavailable right now.</p>`;
  }
}
