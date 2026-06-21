// shoot.mjs — full-page screenshots of both pages with mocked data.
// Env: PORT (default 8137), OUT (default ./out), DARK=1 for dark mode.
import puppeteer from "puppeteer";
import fs from "fs";
import { attachMocks } from "./mocks.mjs";

const BASE = `http://localhost:${process.env.PORT || "8137"}`;
const OUT = process.env.OUT || "out";
const dark = process.env.DARK === "1";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
for (const pg of ["index.html", "surf.html"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 402, height: 860, deviceScaleFactor: 2 });
  if (dark) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await attachMocks(page);
  await page.goto(`${BASE}/${pg}`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const file = `${OUT}/${dark ? "dark-" : ""}${pg.replace(".html", "")}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
  await page.close();
}
await browser.close();
console.log("done");
