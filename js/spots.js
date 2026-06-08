// spots.js — curated Hawaii surf-break database for the forecast page.
//
// Each spot carries the coordinates used for the wave/wind model plus a
// `facing` bearing: the compass direction (degrees) you look when facing the
// ocean from the beach. That single value powers the onshore/offshore wind
// read and the swell-window check in rating.js. `swellWindow` (optional) is the
// arc of swell directions the break actually receives.
//
// Tide stations: Honolulu (1612340) is the standard south-shore reference and
// the closest active NOAA prediction station for most of Oahu. Windward Oahu
// uses Mokuoloe; neighbor islands use their own stations.

export const STATIONS = {
  1612340: "Honolulu",
  1612480: "Kāneʻohe (Mokuoloe)",
  1615680: "Kahului, Maui",
  1611400: "Nāwiliwili, Kauaʻi",
  1617760: "Hilo",
  1617433: "Kawaihae",
};

// region "shore" groups spots for filtering; tideNote flags an approximate
// tide reference (the model wave/wind data is always local to the spot).
export const SPOTS = [
  // ---- Oahu · Waikiki breaks (the reef out front, ʻEwa → Diamond Head) ----
  // Summer / south-swell spots. Open-Meteo's wave grid is coarse, so raw swell
  // *size* is similar across these neighbours — the per-break differences come
  // from each one's orientation (`facing`) and swell window, plus the wind read.
  { id: "kaisers", name: "Kaisers (Kaiser Bowls)", island: "Oahu", region: "Waikiki", lat: 21.2815, lng: -157.8385, facing: 205, swellWindow: [170, 245], station: 1612340, level: "Advanced" },
  { id: "rockpiles", name: "Rockpiles", island: "Oahu", region: "Waikiki", lat: 21.2800, lng: -157.8360, facing: 205, swellWindow: [175, 245], station: 1612340, level: "Advanced" },
  { id: "threes", name: "Threes (3's)", island: "Oahu", region: "Waikiki", lat: 21.2758, lng: -157.8332, facing: 200, swellWindow: [170, 240], station: 1612340, level: "Intermediate" },
  { id: "fours", name: "Fours (4's)", island: "Oahu", region: "Waikiki", lat: 21.2754, lng: -157.8322, facing: 198, swellWindow: [170, 240], station: 1612340, level: "Intermediate" },
  { id: "populars", name: "Populars (Pops)", island: "Oahu", region: "Waikiki", lat: 21.2746, lng: -157.8302, facing: 195, swellWindow: [165, 235], station: 1612340, level: "Intermediate" },
  { id: "paradise", name: "Paradise", island: "Oahu", region: "Waikiki", lat: 21.2740, lng: -157.8292, facing: 195, swellWindow: [165, 235], station: 1612340, level: "Advanced" },
  { id: "canoes", name: "Canoes", island: "Oahu", region: "Waikiki", lat: 21.2730, lng: -157.8278, facing: 190, swellWindow: [160, 230], station: 1612340, level: "Beginner" },
  { id: "queens", name: "Queens (Queen's)", island: "Oahu", region: "Waikiki", lat: 21.2724, lng: -157.8264, facing: 188, swellWindow: [158, 228], station: 1612340, level: "Intermediate" },
  { id: "cunhas", name: "Cunha's", island: "Oahu", region: "Waikiki", lat: 21.2706, lng: -157.8250, facing: 185, swellWindow: [155, 225], station: 1612340, level: "Intermediate" },
  { id: "publics", name: "Publics", island: "Oahu", region: "Waikiki", lat: 21.2662, lng: -157.8206, facing: 178, swellWindow: [150, 220], station: 1612340, level: "Advanced" },
  { id: "tonggs", name: "Tongg's", island: "Oahu", region: "Waikiki", lat: 21.2642, lng: -157.8186, facing: 175, swellWindow: [148, 215], station: 1612340, level: "Intermediate" },

  // ---- Oahu · South Shore (Kakaʻako & Diamond Head, just outside Waikiki) ----
  { id: "ala-moana-bowls", name: "Ala Moana Bowls", island: "Oahu", region: "South Shore", lat: 21.2880, lng: -157.8520, facing: 200, swellWindow: [170, 240], station: 1612340, level: "Advanced" },
  { id: "kewalos", name: "Kewalos", island: "Oahu", region: "South Shore", lat: 21.2930, lng: -157.8585, facing: 200, swellWindow: [170, 240], station: 1612340, level: "Intermediate" },
  { id: "diamond-head", name: "Diamond Head (Cliffs)", island: "Oahu", region: "South Shore", lat: 21.2545, lng: -157.8050, facing: 165, swellWindow: [130, 210], station: 1612340, level: "Intermediate" },

  // ---- Oahu · North Shore (winter; tide ref Honolulu) ----
  { id: "pipeline", name: "Banzai Pipeline (Ehukai)", island: "Oahu", region: "North Shore", lat: 21.6650, lng: -158.0530, facing: 325, swellWindow: [290, 360], station: 1612340, tideNote: true, level: "Expert" },
  { id: "sunset", name: "Sunset Beach", island: "Oahu", region: "North Shore", lat: 21.6790, lng: -158.0410, facing: 340, swellWindow: [300, 30], station: 1612340, tideNote: true, level: "Expert" },
  { id: "waimea", name: "Waimea Bay", island: "Oahu", region: "North Shore", lat: 21.6420, lng: -158.0660, facing: 315, swellWindow: [290, 350], station: 1612340, tideNote: true, level: "Expert" },
  { id: "haleiwa", name: "Haleʻiwa", island: "Oahu", region: "North Shore", lat: 21.5940, lng: -158.1070, facing: 300, swellWindow: [280, 350], station: 1612340, tideNote: true, level: "Advanced" },
  { id: "laniakea", name: "Laniakea", island: "Oahu", region: "North Shore", lat: 21.6170, lng: -158.0920, facing: 320, swellWindow: [290, 350], station: 1612340, tideNote: true, level: "Intermediate" },
  { id: "chuns", name: "Chun's Reef", island: "Oahu", region: "North Shore", lat: 21.6260, lng: -158.0850, facing: 320, swellWindow: [290, 350], station: 1612340, tideNote: true, level: "Intermediate" },
  { id: "velzyland", name: "Velzyland", island: "Oahu", region: "North Shore", lat: 21.6830, lng: -158.0270, facing: 350, swellWindow: [310, 40], station: 1612340, tideNote: true, level: "Advanced" },

  // ---- Oahu · East / Windward ----
  { id: "makapuu", name: "Makapuʻu", island: "Oahu", region: "East Side", lat: 21.3100, lng: -157.6590, facing: 110, swellWindow: [60, 160], station: 1612480, level: "Advanced" },
  { id: "sandys", name: "Sandy Beach", island: "Oahu", region: "East Side", lat: 21.2850, lng: -157.6720, facing: 150, swellWindow: [110, 200], station: 1612340, level: "Advanced" },
  { id: "kailua", name: "Kailua Beach", island: "Oahu", region: "East Side", lat: 21.3930, lng: -157.7330, facing: 70, swellWindow: [30, 130], station: 1612480, level: "Beginner" },

  // ---- Oahu · West Side ----
  { id: "makaha", name: "Mākaha", island: "Oahu", region: "West Side", lat: 21.4770, lng: -158.2200, facing: 250, swellWindow: [200, 320], station: 1612340, tideNote: true, level: "Advanced" },
  { id: "yokohama", name: "Yokohama Bay", island: "Oahu", region: "West Side", lat: 21.5550, lng: -158.2470, facing: 270, swellWindow: [210, 330], station: 1612340, tideNote: true, level: "Advanced" },

  // ---- Maui (Kahului ref) ----
  { id: "honolua", name: "Honolua Bay", island: "Maui", region: "Maui", lat: 21.0150, lng: -156.6380, facing: 300, swellWindow: [280, 350], station: 1615680, tideNote: true, level: "Expert" },
  { id: "hookipa", name: "Hoʻokipa", island: "Maui", region: "Maui", lat: 20.9330, lng: -156.3580, facing: 20, swellWindow: [340, 70], station: 1615680, tideNote: true, level: "Advanced" },
  { id: "jaws", name: "Peʻahi (Jaws)", island: "Maui", region: "Maui", lat: 20.9450, lng: -156.3000, facing: 10, swellWindow: [330, 50], station: 1615680, tideNote: true, level: "Expert" },
  { id: "lahaina", name: "Lahaina Breakwall", island: "Maui", region: "Maui", lat: 20.8720, lng: -156.6800, facing: 250, swellWindow: [200, 300], station: 1615680, level: "Beginner" },
  { id: "maalaea", name: "Māʻalaea", island: "Maui", region: "Maui", lat: 20.7900, lng: -156.5120, facing: 200, swellWindow: [160, 230], station: 1615680, level: "Expert" },

  // ---- Big Island ----
  { id: "honolii", name: "Honoliʻi", island: "Hawaiʻi", region: "Big Island", lat: 19.7600, lng: -155.0900, facing: 70, swellWindow: [20, 130], station: 1617760, level: "Intermediate" },
  { id: "banyans", name: "Banyans (Kona)", island: "Hawaiʻi", region: "Big Island", lat: 19.5860, lng: -155.9650, facing: 250, swellWindow: [200, 320], station: 1617433, level: "Intermediate" },
  { id: "pinetrees-kona", name: "Pine Trees (Kona)", island: "Hawaiʻi", region: "Big Island", lat: 19.6540, lng: -156.0250, facing: 270, swellWindow: [210, 330], station: 1617433, level: "Intermediate" },

  // ---- Kauai ----
  { id: "hanalei", name: "Hanalei Bay", island: "Kauaʻi", region: "Kauai", lat: 22.2050, lng: -159.5030, facing: 340, swellWindow: [300, 30], station: 1611400, tideNote: true, level: "Advanced" },
  { id: "poipu", name: "Poʻipū (PK's)", island: "Kauaʻi", region: "Kauai", lat: 21.8730, lng: -159.4580, facing: 190, swellWindow: [150, 230], station: 1611400, level: "Intermediate" },
];

/** Case-insensitive search over name / region / island. Returns all on empty. */
export function searchSpots(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return SPOTS.slice();
  return SPOTS.filter((s) =>
    `${s.name} ${s.region} ${s.island}`.toLowerCase().includes(q)
  );
}

export const getSpot = (id) => SPOTS.find((s) => s.id === id) || null;
