// spots.js — curated surf-break database for the forecast page (Hawaii +
// Southern California). Each spot carries a `tz` (IANA timezone) and `state`
// so times and NWS alerts resolve correctly across regions.
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
  // Southern California (NOAA CO-OPS)
  9410840: "Santa Monica",
  9410660: "Los Angeles",
  9410583: "Newport (Balboa Pier)",
  9410396: "Oceanside Harbor",
  9410230: "La Jolla (Scripps)",
  9410170: "San Diego",
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

  // ================= Southern California =================
  // Pacific Time (America/Los_Angeles, with DST). SoCal beaches generally face
  // W→S and are shadowed from NW swell by Point Conception / the Channel
  // Islands, so their windows favour S/SW (summer) and W (winter).
  // ---- Los Angeles County (Malibu → South Bay) ----
  { id: "leo-carrillo", name: "Leo Carrillo (Malibu)", island: "California", region: "Los Angeles", lat: 34.0459, lng: -118.9370, facing: 210, swellWindow: [160, 260], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "zuma", name: "Zuma Beach (Malibu)", island: "California", region: "Los Angeles", lat: 34.0169, lng: -118.8207, facing: 205, swellWindow: [150, 250], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "malibu", name: "Malibu (First Point)", island: "California", region: "Los Angeles", lat: 34.0367, lng: -118.6779, facing: 190, swellWindow: [140, 235], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "topanga", name: "Topanga (Malibu)", island: "California", region: "Los Angeles", lat: 34.0388, lng: -118.5822, facing: 205, swellWindow: [165, 245], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "santa-monica", name: "Santa Monica", island: "California", region: "Los Angeles", lat: 34.0089, lng: -118.4973, facing: 215, swellWindow: [180, 260], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "venice", name: "Venice Beach", island: "California", region: "Los Angeles", lat: 33.9850, lng: -118.4695, facing: 235, swellWindow: [190, 280], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "playa-del-rey", name: "Playa del Rey", island: "California", region: "Los Angeles", lat: 33.9564, lng: -118.4483, facing: 250, swellWindow: [190, 300], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "el-porto", name: "El Porto (Manhattan Beach)", island: "California", region: "Los Angeles", lat: 33.9008, lng: -118.4210, facing: 250, swellWindow: [190, 300], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "manhattan-beach", name: "Manhattan Beach (Pier)", island: "California", region: "Los Angeles", lat: 33.8847, lng: -118.4109, facing: 250, swellWindow: [190, 300], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "hermosa-beach", name: "Hermosa Beach (Pier)", island: "California", region: "Los Angeles", lat: 33.8622, lng: -118.4012, facing: 250, swellWindow: [190, 295], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "redondo-beach", name: "Redondo Beach (Breakwall)", island: "California", region: "Los Angeles", lat: 33.8410, lng: -118.3920, facing: 250, swellWindow: [195, 295], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "torrance-beach", name: "Torrance Beach (RAT Beach)", island: "California", region: "Los Angeles", lat: 33.8080, lng: -118.3915, facing: 250, swellWindow: [195, 295], station: 9410840, buoy: "028", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },

  // ---- Orange County (Seal Beach → San Clemente) ----
  { id: "seal-beach", name: "Seal Beach", island: "California", region: "Orange County", lat: 33.7414, lng: -118.1048, facing: 210, swellWindow: [175, 260], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "bolsa-chica", name: "Bolsa Chica (Huntington)", island: "California", region: "Orange County", lat: 33.6900, lng: -118.0470, facing: 225, swellWindow: [180, 285], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "huntington", name: "Huntington Beach (Pier)", island: "California", region: "Orange County", lat: 33.6553, lng: -118.0035, facing: 220, swellWindow: [175, 280], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "newport-56", name: "Newport Beach (Blackies)", island: "California", region: "Orange County", lat: 33.6189, lng: -117.9298, facing: 215, swellWindow: [175, 265], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "the-wedge", name: "The Wedge (Newport)", island: "California", region: "Orange County", lat: 33.5933, lng: -117.8817, facing: 200, swellWindow: [165, 235], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Expert" },
  { id: "corona-del-mar", name: "Corona del Mar", island: "California", region: "Orange County", lat: 33.5928, lng: -117.8730, facing: 205, swellWindow: [170, 245], station: 9410583, buoy: "092", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "crystal-cove", name: "Crystal Cove (Newport Coast)", island: "California", region: "Orange County", lat: 33.5720, lng: -117.8340, facing: 220, swellWindow: [180, 275], station: 9410583, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "laguna-beach", name: "Laguna Beach (Main Beach)", island: "California", region: "Orange County", lat: 33.5427, lng: -117.7854, facing: 215, swellWindow: [180, 270], station: 9410583, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "aliso-beach", name: "Aliso Beach (Laguna Niguel)", island: "California", region: "Orange County", lat: 33.5099, lng: -117.7517, facing: 215, swellWindow: [180, 270], station: 9410583, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "salt-creek", name: "Salt Creek (Dana Point)", island: "California", region: "Orange County", lat: 33.4783, lng: -117.7281, facing: 215, swellWindow: [175, 270], station: 9410583, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "doheny", name: "Doheny (Dana Point)", island: "California", region: "Orange County", lat: 33.4614, lng: -117.6861, facing: 220, swellWindow: [190, 255], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "t-street", name: "T-Street (San Clemente)", island: "California", region: "Orange County", lat: 33.4183, lng: -117.6169, facing: 220, swellWindow: [175, 275], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "trestles", name: "Lower Trestles (San Clemente)", island: "California", region: "Orange County", lat: 33.3856, lng: -117.5931, facing: 225, swellWindow: [175, 285], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "san-onofre", name: "San Onofre (San Clemente)", island: "California", region: "Orange County", lat: 33.3700, lng: -117.5650, facing: 225, swellWindow: [180, 285], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },

  // ---- San Diego County ----
  { id: "oceanside", name: "Oceanside (Pier)", island: "California", region: "San Diego", lat: 33.1930, lng: -117.3860, facing: 250, swellWindow: [195, 300], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "swamis", name: "Swamis (Encinitas)", island: "California", region: "San Diego", lat: 33.0345, lng: -117.2925, facing: 250, swellWindow: [195, 300], station: 9410396, buoy: "045", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "blacks", name: "Blacks Beach (Torrey Pines)", island: "California", region: "San Diego", lat: 32.8890, lng: -117.2520, facing: 265, swellWindow: [200, 310], station: 9410230, buoy: "100", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "scripps", name: "Scripps Pier (La Jolla)", island: "California", region: "San Diego", lat: 32.8670, lng: -117.2540, facing: 255, swellWindow: [200, 300], station: 9410230, buoy: "100", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "la-jolla-shores", name: "La Jolla Shores", island: "California", region: "San Diego", lat: 32.8570, lng: -117.2560, facing: 250, swellWindow: [200, 295], station: 9410230, buoy: "100", tz: "America/Los_Angeles", state: "CA", level: "Beginner" },
  { id: "windansea", name: "Windansea (La Jolla)", island: "California", region: "San Diego", lat: 32.8330, lng: -117.2790, facing: 250, swellWindow: [195, 300], station: 9410230, buoy: "100", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "pacific-beach", name: "Pacific Beach (Tourmaline)", island: "California", region: "San Diego", lat: 32.8020, lng: -117.2650, facing: 260, swellWindow: [200, 305], station: 9410170, buoy: "093", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "ocean-beach", name: "Ocean Beach", island: "California", region: "San Diego", lat: 32.7490, lng: -117.2530, facing: 260, swellWindow: [200, 305], station: 9410170, buoy: "093", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
  { id: "sunset-cliffs", name: "Sunset Cliffs (Point Loma)", island: "California", region: "San Diego", lat: 32.7160, lng: -117.2540, facing: 250, swellWindow: [195, 300], station: 9410170, buoy: "191", tz: "America/Los_Angeles", state: "CA", level: "Advanced" },
  { id: "imperial-beach", name: "Imperial Beach", island: "California", region: "San Diego", lat: 32.5790, lng: -117.1350, facing: 250, swellWindow: [200, 295], station: 9410170, buoy: "155", tz: "America/Los_Angeles", state: "CA", level: "Intermediate" },
];

// Nearest real-time wave buoy (CDIP station_id) per region — see buoy.js.
// Oʻahu is well covered; neighbour islands have no assigned buoy (panel hides).
const REGION_BUOY = {
  Waikiki: "233", // Pearl Harbor / Māmala Bay (south shore)
  "South Shore": "233",
  "North Shore": "106", // Waimea Bay
  "East Side": "098", // Mokapu Point
  "West Side": "106", // catches the same NW swells
};
for (const s of SPOTS) {
  s.buoy = s.buoy || REGION_BUOY[s.region] || null; // explicit per-spot buoy wins
  s.tz = s.tz || "Pacific/Honolulu";
  s.state = s.state || "HI";
}

/** Case-insensitive search over name / region / island. Returns all on empty. */
export function searchSpots(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return SPOTS.slice();
  return SPOTS.filter((s) =>
    `${s.name} ${s.region} ${s.island}`.toLowerCase().includes(q)
  );
}

export const getSpot = (id) => SPOTS.find((s) => s.id === id) || null;
