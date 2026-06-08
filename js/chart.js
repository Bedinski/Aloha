// chart.js — tiny dependency-free SVG line/area chart shared across pages.

const TZ = "Pacific/Honolulu";

const defaultXFmt = (t) =>
  new Date(t).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric" });

export function lineChart({
  points,
  width = 320,
  height = 120,
  color = "#0ea5e9",
  markers = [],
  nowAt = null,
  xFmt = defaultXFmt,
}) {
  if (!points.length) return '<p class="muted">No data.</p>';
  const padT = 14, padB = 22, padL = 4, padR = 4;
  const xs = points.map((p) => p.x.getTime());
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const pad = (maxY - minY) * 0.12;
  minY -= pad; maxY += pad;

  const px = (t) => padL + ((t - minX) / (maxX - minX || 1)) * (width - padL - padR);
  const py = (v) => padT + (1 - (v - minY) / (maxY - minY)) * (height - padT - padB);

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${px(p.x.getTime()).toFixed(1)},${py(p.y).toFixed(1)}`)
    .join(" ");
  const area = `${path} L${px(maxX).toFixed(1)},${(height - padB).toFixed(1)} L${px(minX).toFixed(1)},${(height - padB).toFixed(1)} Z`;
  const gid = "g" + Math.random().toString(36).slice(2, 8);

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" preserveAspectRatio="none">`;
  svg += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1">`;
  svg += `<stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  svg += `<path d="${area}" fill="url(#${gid})"/>`;
  svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  if (nowAt) {
    const x = px(nowAt.getTime());
    if (x >= padL && x <= width - padR) {
      svg += `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${height - padB}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3"/>`;
      svg += `<text x="${x.toFixed(1)}" y="10" fill="#ef4444" font-size="9" text-anchor="middle">now</text>`;
    }
  }

  for (const m of markers) {
    const x = px(m.x.getTime()), y = py(m.y);
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`;
    svg += `<text x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}" fill="var(--ink)" font-size="9" text-anchor="middle">${m.label}</text>`;
  }

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const t = minX + ((maxX - minX) * i) / ticks;
    const x = px(t);
    const lbl = xFmt(t);
    svg += `<text x="${x.toFixed(1)}" y="${height - 6}" fill="var(--muted)" font-size="9" text-anchor="middle">${lbl}</text>`;
  }
  svg += `</svg>`;
  return svg;
}
