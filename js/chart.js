// chart.js — tiny dependency-free SVG line/area chart shared across pages.

const TZ = "Pacific/Honolulu";
const defaultXFmt = (t) =>
  new Date(t).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric" });

export function lineChart({
  points,
  width = 320,
  height = 150,
  color = "#0ea5e9",
  markers = [],
  nowAt = null,
  xFmt = defaultXFmt,
  unit = "",
  label = "",
}) {
  if (!points.length) return '<p class="muted small">No data yet.</p>';
  const padT = 16, padB = 26, padL = 8, padR = 34;
  const xs = points.map((p) => p.x.getTime());
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const dataMin = Math.min(...ys), dataMax = Math.max(...ys);
  let lo = dataMin, hi = dataMax;
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.14;
  lo -= pad; hi += pad;

  const px = (t) => padL + ((t - minX) / (maxX - minX || 1)) * (width - padL - padR);
  const py = (v) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB);
  const fmtV = (v) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${px(p.x.getTime()).toFixed(1)},${py(p.y).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${px(maxX).toFixed(1)},${(height - padB).toFixed(1)} L${px(minX).toFixed(1)},${(height - padB).toFixed(1)} Z`;
  const gid = "g" + Math.random().toString(36).slice(2, 8);

  const aria = label ? ` aria-label="${label.replace(/"/g, "'")}"` : "";
  let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img"${aria} preserveAspectRatio="none">`;
  if (label) svg += `<title>${label.replace(/[<>&]/g, " ")}</title>`;
  svg += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">`;
  svg += `<stop offset="0" stop-color="${color}" stop-opacity="0.40"/><stop offset="1" stop-color="${color}" stop-opacity="0.02"/></linearGradient></defs>`;

  // horizontal gridlines + value labels (data max / mid / min)
  for (const v of [dataMax, (dataMax + dataMin) / 2, dataMin]) {
    const y = py(v);
    svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(width - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1" opacity="0.7"/>`;
    svg += `<text x="${(width - padR + 5).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" fill="var(--muted)" font-size="12" text-anchor="start">${fmtV(v)}${unit}</text>`;
  }

  svg += `<path d="${area}" fill="url(#${gid})"/>`;
  svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // "now" marker + value dot
  if (nowAt) {
    const nx = px(nowAt.getTime());
    if (nx >= padL && nx <= width - padR) {
      // nearest data point to now
      let best = points[0], bd = Infinity;
      for (const p of points) { const d = Math.abs(p.x.getTime() - nowAt.getTime()); if (d < bd) { bd = d; best = p; } }
      const ny = py(best.y);
      svg += `<line x1="${nx.toFixed(1)}" y1="${padT}" x2="${nx.toFixed(1)}" y2="${(height - padB).toFixed(1)}" stroke="var(--coral)" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      svg += `<circle cx="${px(best.x.getTime()).toFixed(1)}" cy="${ny.toFixed(1)}" r="4" fill="${color}" stroke="var(--card)" stroke-width="2"/>`;
      svg += `<text x="${nx.toFixed(1)}" y="11" fill="var(--coral)" font-size="12" font-weight="700" text-anchor="middle">now ${fmtV(best.y)}${unit}</text>`;
    }
  }

  for (const m of markers) {
    const x = px(m.x.getTime()), y = py(m.y);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}"/>`;
    svg += `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" fill="var(--ink)" font-size="12" font-weight="600" text-anchor="middle">${m.label}</text>`;
  }

  // x-axis: 4 evenly spaced time ticks
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const t = minX + ((maxX - minX) * i) / ticks;
    const x = px(t);
    const anchor = i === 0 ? "start" : i === ticks ? "end" : "middle";
    svg += `<text x="${x.toFixed(1)}" y="${height - 7}" fill="var(--muted)" font-size="12" text-anchor="${anchor}">${xFmt(t)}</text>`;
  }
  svg += `</svg>`;
  return svg;
}
