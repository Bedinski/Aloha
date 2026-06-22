// visual.mjs -- screenshot-backed visual validation for CI.
// Fails on blank renders, dark-mode white bands, horizontal overflow, and
// unreadable native select options.
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { PNG } from "pngjs";
import { attachMocks } from "./mocks.mjs";

const BASE = `http://localhost:${process.env.PORT || "8137"}`;
const OUT = process.env.OUT || "out/visual";
fs.mkdirSync(OUT, { recursive: true });

const CASES = [
  { page: "index.html", viewport: { width: 402, height: 860, deviceScaleFactor: 1 } },
  { page: "surf.html", viewport: { width: 402, height: 860, deviceScaleFactor: 1 } },
  { page: "index.html", viewport: { width: 1280, height: 900, deviceScaleFactor: 1 } },
  { page: "surf.html", viewport: { width: 1280, height: 900, deviceScaleFactor: 1 } },
];

function colorParts(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css || "");
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(",").map((x) => Number.parseFloat(x));
  return { r, g, b, a };
}

function luminance({ r, g, b }) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function imageStats(png) {
  let n = 0, sum = 0, sumSq = 0;
  for (let y = 0; y < png.height; y += 12) {
    for (let x = 0; x < png.width; x += 12) {
      const i = (png.width * y + x) << 2;
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
      n++;
      sum += lum;
      sumSq += lum * lum;
    }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return { mean, stdev: Math.sqrt(Math.max(0, variance)) };
}

function hasWhiteBandInDarkMode(png, firstViewportHeight) {
  const startY = Math.min(png.height - 1, Math.floor(firstViewportHeight * 0.85));
  for (let y = startY; y < png.height; y += 16) {
    let nearWhite = 0, total = 0;
    for (let x = 0; x < png.width; x += 4) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 242 && g > 242 && b > 242) nearWhite++;
      total++;
    }
    if (nearWhite / total > 0.72) return true;
  }
  return false;
}

async function domChecks(page, name) {
  return page.evaluate(() => {
    const problems = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 2) {
      problems.push(`horizontal overflow ${root.scrollWidth}px > ${root.clientWidth}px`);
    }

    for (const sel of ["#status-line", ".tabs", "main"]) {
      const el = document.querySelector(sel);
      if (!el || !el.getBoundingClientRect().width || !el.textContent.trim()) {
        problems.push(`${sel} did not render useful content`);
      }
    }

    const select = document.querySelector(".controls select");
    if (select) {
      const option = select.querySelector("option");
      if (!option) {
        problems.push("location select has no options");
      } else {
        const cs = getComputedStyle(option);
        problems.push({ kind: "select-option-style", color: cs.color, backgroundColor: cs.backgroundColor });
      }
    }

    return problems;
  }).then((items) => {
    const problems = [];
    for (const item of items) {
      if (typeof item === "string") {
        problems.push(item);
        continue;
      }
      if (item.kind === "select-option-style") {
        const fg = colorParts(item.color);
        let bg = colorParts(item.backgroundColor);
        if (!bg || bg.a < 0.5) bg = { r: 255, g: 255, b: 255, a: 1 };
        if (!fg || contrast(fg, bg) < 4.5) {
          problems.push(`unreadable select option in ${name}: ${item.color} on ${item.backgroundColor}`);
        }
      }
    }
    return problems;
  });
}

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
});

let failed = false;
for (const dark of [false, true]) {
  for (const c of CASES) {
    const page = await browser.newPage();
    await page.setViewport(c.viewport);
    if (dark) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    await attachMocks(page);
    await page.goto(`${BASE}/${c.page}`, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));

    const stem = `${dark ? "dark-" : ""}${c.page.replace(".html", "")}-${c.viewport.width}`;
    const file = path.join(OUT, `${stem}.png`);
    const buf = await page.screenshot({ path: file, fullPage: true });
    const png = PNG.sync.read(Buffer.from(buf));
    const stats = imageStats(png);
    const problems = await domChecks(page, stem);

    if (stats.stdev < 10) problems.push(`screenshot looks blank/flat (stdev ${stats.stdev.toFixed(1)})`);
    if (dark && hasWhiteBandInDarkMode(png, c.viewport.height * c.viewport.deviceScaleFactor)) {
      problems.push("dark screenshot contains a wide white band below the first viewport");
    }

    await page.close();
    const bad = problems.length > 0;
    failed = failed || bad;
    console.log(`\n${bad ? "FAIL" : "PASS"} ${stem}`);
    console.log(`  ${png.width}x${png.height}, mean ${stats.mean.toFixed(1)}, stdev ${stats.stdev.toFixed(1)}`);
    for (const p of problems) console.log(`  - ${p}`);
  }
}

await browser.close();
console.log(`\n${failed ? "Visual validation FAILED" : "Visual validation passed"}`);
process.exit(failed ? 1 : 0);
