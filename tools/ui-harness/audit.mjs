// audit.mjs — objective UI gate against the live DOM: WCAG text contrast,
// tap-target sizes, and tiny fonts. Exits non-zero if any threshold is
// exceeded, so CI fails on a UI regression.
// Env: PORT (default 8137); MAX_CONTRAST / MAX_TAP / MAX_TINY thresholds.
import puppeteer from "puppeteer";
import { attachMocks } from "./mocks.mjs";

const BASE = `http://localhost:${process.env.PORT || "8137"}`;
const MAX = {
  contrast: +(process.env.MAX_CONTRAST ?? 0),
  tap: +(process.env.MAX_TAP ?? 0),
  tiny: +(process.env.MAX_TINY ?? 0),
};

const AUDIT = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] };
  };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.5) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length);

  let textTotal = 0, contrastFail = 0, tiny = 0;
  const worst = [];
  // Header text sits over the hero image (validated visually) — out of scope.
  for (const el of document.querySelectorAll("main *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const fs = parseFloat(cs.fontSize);
    if (hasText(el)) {
      textTotal++;
      const fg = parse(cs.color), bg = bgOf(el);
      if (fg && bg) {
        const r = ratio(fg, bg);
        const big = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
        if (r < (big ? 3 : 4.5)) { contrastFail++; if (worst.length < 8) worst.push({ t: el.textContent.trim().slice(0, 28), r: +r.toFixed(2), fs }); }
      }
      if (fs < 12) tiny++;
    }
  }
  let tapTotal = 0, tapFail = 0;
  for (const el of document.querySelectorAll("a,button,select,input,[role=button]")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    tapTotal++;
    if (r.width < 44 || r.height < 44) tapFail++;
  }
  return { textTotal, contrastFail, tiny, tapTotal, tapFail, worst };
};

const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
let failed = false;
for (const pg of ["index.html", "surf.html"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 402, height: 860, deviceScaleFactor: 2 });
  await attachMocks(page);
  await page.goto(`${BASE}/${pg}`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  const a = await page.evaluate(AUDIT);
  await page.close();
  const bad =
    a.contrastFail > MAX.contrast || a.tapFail > MAX.tap || a.tiny > MAX.tiny;
  failed = failed || bad;
  console.log(`\n${bad ? "✗ FAIL" : "✓ PASS"}  ${pg}`);
  console.log(`   contrast fails : ${a.contrastFail}  (max ${MAX.contrast})`);
  console.log(`   tiny fonts <12 : ${a.tiny}  (max ${MAX.tiny})`);
  console.log(`   tap < 44px     : ${a.tapFail}/${a.tapTotal}  (max ${MAX.tap})`);
  if (a.worst.length) console.log("   worst contrast :", a.worst.map((w) => `${JSON.stringify(w.t)}@${w.r}`).join(", "));
}
await browser.close();
console.log(`\n${failed ? "UI audit FAILED" : "UI audit passed"}`);
process.exit(failed ? 1 : 0);
