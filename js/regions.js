// regions.js — the site toggles between two regions. Each carries its dashboard
// locations, timezone, NWS alert state, and region-specific copy/links so the
// whole app (dashboard + surf page) re-skins correctly. Persisted in localStorage.

export const REGIONS = {
  HI: {
    id: "HI",
    name: "Hawaiʻi",
    tz: "Pacific/Honolulu",
    tzLabel: "Hawaii Standard Time",
    alertArea: "HI",
    defaultSpot: "canoes", // surf-page default break
    jellyfish: true, // south-shore box-jellyfish card
    vog: true, // volcanic SO₂ read
    airTitle: "🌋 Vog & air quality",
    airNote: "US AQI + a vog read from SO₂ · modelled (Open-Meteo), not a ground sensor.",
    tideRef: "NOAA Honolulu station (south-shore reference)",
    snorkelReminder:
      "🐢 Hanauma Bay &amp; Diamond Head need advance online reservations. Keep 10+ ft from honu (turtles) &amp; monk seals — it's the law.",
    sunscreenNote: "Hawaii law requires reef-safe sunscreen (no oxybenzone/octinoxate).",
    safety: [
      { href: "https://hawaiibeachsafety.com/", title: "Hawaii Beach Safety", sub: "Lifeguarded beach conditions" },
      { href: "https://www.weather.gov/hfo/SRF", title: "NWS Hawaii surf forecast", sub: "Official shore-by-shore surf outlook" },
      { href: "https://www.honolulu.gov/hosd/beach-signs/", title: "Beach sign guide", sub: "Honolulu Ocean Safety warnings" },
    ],
    locations: [
      { id: "waikiki", name: "Waikiki Beach", lat: 21.2762, lng: -157.8267, station: 1612340, buoy: "233", alertRegion: "Oahu" },
      { id: "kaimana", name: "Kaimana / Sans Souci", lat: 21.266, lng: -157.823, station: 1612340, buoy: "233", alertRegion: "Oahu" },
      { id: "alamoana", name: "Ala Moana Bowls", lat: 21.288, lng: -157.852, station: 1612340, buoy: "233", alertRegion: "Oahu" },
      { id: "hanauma", name: "Hanauma Bay (snorkel)", lat: 21.269, lng: -157.6938, station: 1612340, buoy: "233", alertRegion: "Oahu" },
      { id: "diamondhead", name: "Diamond Head", lat: 21.2545, lng: -157.805, station: 1612340, buoy: "233", alertRegion: "Oahu" },
    ],
  },
  CA: {
    id: "CA",
    name: "California",
    tz: "America/Los_Angeles",
    tzLabel: "Pacific Time",
    alertArea: "CA",
    defaultSpot: "la-jolla-shores",
    jellyfish: false,
    vog: false,
    airTitle: "🌫️ Air quality",
    airNote: "US AQI (PM2.5) · modelled (Open-Meteo), not a ground sensor.",
    tideRef: "nearest NOAA CO-OPS station",
    snorkelReminder:
      "🦭 Give seals, sea lions &amp; dolphins space (50+ ft) — they're federally protected. Watch for rip currents and posted flags.",
    sunscreenNote: "Choose a reef-safe / mineral sunscreen where you can.",
    safety: [
      { href: "https://www.weather.gov/sgx/", title: "NWS San Diego", sub: "Coastal & surf forecast" },
      { href: "https://www.weather.gov/lox/", title: "NWS Los Angeles / Oxnard", sub: "Coastal & surf forecast" },
      { href: "https://www.parks.ca.gov/?page_id=30378", title: "CA State Parks ocean safety", sub: "Rip currents & beach tips" },
    ],
    locations: [
      { id: "santa-monica", name: "Santa Monica", lat: 34.0089, lng: -118.4973, station: 9410840, buoy: "028", alertRegion: "Los Angeles" },
      { id: "malibu", name: "Malibu (Surfrider)", lat: 34.0367, lng: -118.6779, station: 9410840, buoy: "028", alertRegion: "Los Angeles" },
      { id: "huntington", name: "Huntington Beach", lat: 33.6553, lng: -118.0035, station: 9410583, buoy: "092", alertRegion: "Orange County" },
      { id: "la-jolla", name: "La Jolla Shores", lat: 32.857, lng: -117.256, station: 9410230, buoy: "100", alertRegion: "San Diego" },
      { id: "oceanside", name: "Oceanside", lat: 33.193, lng: -117.386, station: 9410396, buoy: "045", alertRegion: "San Diego" },
      { id: "ocean-beach", name: "San Diego (Ocean Beach)", lat: 32.749, lng: -117.253, station: 9410170, buoy: "093", alertRegion: "San Diego" },
    ],
  },
};

const KEY = "aloha:region";

export function getRegionId() {
  try {
    const id = localStorage.getItem(KEY);
    if (id && REGIONS[id]) return id;
  } catch { /* private mode */ }
  return "HI";
}
export const getRegion = () => REGIONS[getRegionId()];
export function setRegion(id) {
  if (!REGIONS[id]) return;
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
}

// Wire the header region toggle. `onChange(regionId)` fires after a switch.
export function initRegionToggle(onChange) {
  const cur = getRegionId();
  document.querySelectorAll(".region-toggle [data-region]").forEach((b) => {
    const on = b.dataset.region === cur;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.addEventListener("click", () => {
      if (b.dataset.region === getRegionId()) return;
      setRegion(b.dataset.region);
      document.querySelectorAll(".region-toggle [data-region]").forEach((x) => {
        const active = x.dataset.region === b.dataset.region;
        x.classList.toggle("active", active);
        x.setAttribute("aria-pressed", active ? "true" : "false");
      });
      onChange && onChange(b.dataset.region);
    });
  });
}
