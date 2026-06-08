# 🌺 Aloha — Waikiki Tide · Sun · Surf Dashboard

A tiny, fast, **offline-friendly** dashboard for a Waikiki / Oahu trip. It shows
today's **tides**, **sunrise/sunset & golden hour**, **surf & wind**, the **UV
index**, and the **best snorkeling windows** — all in one screen.

- **No API keys, no backend, no build step.** Pure static HTML/CSS/JS.
- **Free to host** on GitHub Pages.
- **Installable on Android** (Add to Home Screen) and works **offline** once
  loaded — sun times are computed on-device, and the last weather/tide data is
  cached so the app still shows useful info with no signal.

Data sources (all free + CORS-enabled, fetched directly from your phone):

| What | Source |
| --- | --- |
| Tides (high/low + curve) | [NOAA CO-OPS](https://api.tidesandcurrents.noaa.gov/api/prod/) — Honolulu station 1612340 |
| Waves, swell, wind, UV, air temp | [Open-Meteo](https://open-meteo.com/) Marine + Weather APIs |
| Sunrise / sunset / twilight / golden hour | Computed on-device (SunCalc algorithm) — **works with zero signal** |

> ⚠️ For trip planning only — **not** for navigation or safety decisions.
> Always check official surf, weather, and lifeguard advisories before entering
> the water.

---

## Spots included

Waikiki Beach (default), Kaimana/Sans Souci, Ala Moana Bowls, Hanauma Bay, and
Diamond Head — all on Oahu's south/east shore, where the NOAA Honolulu tide
station is an accurate reference. There's also a **📍 My location** button that
uses your phone's GPS for surf/wind/UV/sun at wherever you actually are.

---

## Run it locally

ES modules need to be served over HTTP (opening `index.html` via `file://`
won't work). Any static server is fine:

```bash
# Python (already on most machines)
python3 -m http.server 8000
# then open http://localhost:8000
```

```bash
# or Node
npx serve .
```

Re-generate the app icons (optional — they're committed already):

```bash
python3 tools/make_icons.py
```

---

## Deploy to GitHub Pages (free)

**Option A — Deploy from a branch (zero config):**

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick your branch and **`/ (root)`**, then **Save**.
5. Your site goes live at `https://<you>.github.io/<repo>/` in a minute or two.

**Option B — GitHub Actions (auto-deploy on push to `main`):**

1. **Settings → Pages → Source → GitHub Actions.**
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow from the
   Actions tab). The included `.github/workflows/deploy-pages.yml` handles it.

> The site is served from a subpath (`/<repo>/`), which is why every link in the
> app is **relative** (`./…`) — it works at any base path without changes.

---

## Install on your Android phone

1. Open the GitHub Pages URL in **Chrome**.
2. Tap the **⋮** menu → **Add to Home screen** (or accept the install prompt).
3. Launch it from your home screen — it opens full-screen like a native app and
   keeps working offline.

---

## How "best snorkeling windows" is scored

A simple, transparent heuristic over daylight hours:

- **Calmer water** scores higher (lower forecast wave height).
- **Lighter wind** scores higher.
- **Good daylight** — mid-morning to mid-afternoon is favored for visibility.

Contiguous good hours are grouped into windows and ranked. It's a planning aid,
not a substitute for checking conditions and lifeguard flags on the day.

---

## Project layout

```
index.html              # the dashboard
css/styles.css          # styling (light/dark, responsive)
js/app.js               # orchestration, rendering, charts, snorkel scoring
js/sun.js               # on-device sunrise/sunset/twilight math
js/tides.js             # NOAA tide fetch + parse
js/surf.js              # Open-Meteo marine + weather fetch
js/store.js             # fetch-with-cache helper (offline fallback)
manifest.webmanifest    # PWA metadata
service-worker.js       # offline app-shell caching
icons/                  # generated PNG icons
tools/make_icons.py     # regenerate icons (pure stdlib)
.github/workflows/      # optional auto-deploy to Pages
```

🤙 Mahalo & enjoy Waikiki!
