#!/usr/bin/env node
/**
 * nameStations.js
 *
 * Reads data/refillStations.js, matches each station to the nearest known
 * UCSD campus location via haversine distance, and writes meaningful names
 * back to the same file. IDs and coordinates are never changed.
 *
 * Run from repo root:
 *   node scripts/nameStations.js
 */

const fs = require('fs');
const path = require('path');

// ─── Curated UCSD campus locations ───────────────────────────────────────────
// Source: UCSD campus maps (maps.ucsd.edu) + ArcGIS public layers.
// Add or adjust entries here to improve future matching accuracy.
const UCSD_LOCATIONS = [
  // Dining & Cafes
  { name: 'OceanView Terrace',          lat: 32.8800, lng: -117.2426 },
  { name: 'Canyon Vista',               lat: 32.8751, lng: -117.2418 },
  { name: 'Cafe Ventanas',              lat: 32.8769, lng: -117.2387 },
  { name: '64 Degrees',                 lat: 32.8851, lng: -117.2419 },
  { name: 'Pines',                      lat: 32.8829, lng: -117.2388 },
  { name: 'Roots at Revelle',           lat: 32.8773, lng: -117.2469 },

  // Libraries
  { name: 'Geisel Library',             lat: 32.8812, lng: -117.2375 },
  { name: 'Biomedical Library',         lat: 32.8771, lng: -117.2397 },

  // Recreation
  { name: 'RIMAC Arena',                lat: 32.8731, lng: -117.2419 },
  { name: 'RIMAC Annex',                lat: 32.8745, lng: -117.2422 },
  { name: 'Main Gym',                   lat: 32.8757, lng: -117.2414 },
  { name: 'Canyonview Pool',            lat: 32.8749, lng: -117.2393 },

  // Student Centers & Services
  { name: 'Price Center',               lat: 32.8795, lng: -117.2369 },
  { name: 'Student Activities Center',  lat: 32.8784, lng: -117.2376 },
  { name: 'Student Services Center',    lat: 32.8757, lng: -117.2353 },

  // Residential Colleges
  { name: 'Revelle College',            lat: 32.8768, lng: -117.2463 },
  { name: 'Muir College',               lat: 32.8792, lng: -117.2428 },
  { name: 'Marshall College',           lat: 32.8848, lng: -117.2328 },
  { name: 'Warren College',             lat: 32.8749, lng: -117.2409 },
  { name: 'Eleanor Roosevelt College',  lat: 32.8858, lng: -117.2394 },
  { name: 'Sixth College',              lat: 32.8838, lng: -117.2403 },
  { name: 'Seventh College',            lat: 32.8868, lng: -117.2417 },

  // Academic & Research Buildings
  { name: 'Center Hall',                lat: 32.8803, lng: -117.2379 },
  { name: 'Cognitive Science Building', lat: 32.8824, lng: -117.2349 },
  { name: 'Social Sciences Building',   lat: 32.8805, lng: -117.2337 },
  { name: 'Humanities Building',        lat: 32.8795, lng: -117.2415 },
  { name: 'Literature Building',        lat: 32.8796, lng: -117.2419 },
  { name: 'Peterson Hall',              lat: 32.8775, lng: -117.2415 },
  { name: 'Pepper Canyon Hall',         lat: 32.8784, lng: -117.2416 },
  { name: 'Applied Physics & Math',     lat: 32.8793, lng: -117.2436 },
  { name: 'Mayer Hall',                 lat: 32.8818, lng: -117.2415 },
  { name: 'Urey Hall',                  lat: 32.8812, lng: -117.2406 },
  { name: 'York Hall',                  lat: 32.8808, lng: -117.2392 },
  { name: 'Galbraith Hall',             lat: 32.8803, lng: -117.2382 },
  { name: 'Mandeville Center',          lat: 32.8776, lng: -117.2301 },
  { name: 'Ledden Auditorium',          lat: 32.8822, lng: -117.2399 },
  { name: 'Powell-Focht Bioengineering',lat: 32.8822, lng: -117.2339 },
  { name: 'Jacobs School of Engineering',lat: 32.8820, lng: -117.2335 },
  { name: 'Rady School of Management', lat: 32.8886, lng: -117.2350 },
  { name: 'Skaggs School of Pharmacy', lat: 32.8852, lng: -117.2381 },
  { name: 'Faculty Club',               lat: 32.8829, lng: -117.2413 },
  { name: 'ERC Great Hall',             lat: 32.8856, lng: -117.2394 },
];

// Stations further than this from every known location get a fallback name
const THRESHOLD_M = 250;

// Manual overrides — take precedence over nearest-match results.
// Keys are station IDs. Update here when correcting script-assigned names.
const MANUAL_OVERRIDES = {
  1:  'Warren - Warren Lecture Hall',
  2:  'Pepper Canyon East Apartments',
  3:  'Pepper Canyon Hall',
  5:  'Revelle - Blake Hall',
  6:  'Revelle - Argo Hall',
  7:  "Roger's Market",
  8:  'Humanities and Social Sciences Building',
  9:  'Pines',
  10: 'ERC - Great Hall',
  11: 'Seventh - Wells Fargo Hall',
  12: 'Cafe Ventanas',
  13: 'Marshall - Brian C. Malk Hall',
  14: 'OceanView Terrace',
  15: 'Sixth - Catalyst',
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function toRad(deg) { return (deg * Math.PI) / 180; }

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stripPrefixes(raw) {
  return raw
    .replace(/^hydration\s+location\s*[-–—:]\s*/i, '')
    .replace(/^water\s+refill\s+station\s*[-–—:]\s*/i, '')
    .trim();
}

function findNearest(station) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const loc of UCSD_LOCATIONS) {
    const d = haversineM(station.latitude, station.longitude, loc.lat, loc.lng);
    if (d < nearestDist) { nearestDist = d; nearest = loc; }
  }
  return { nearest, distM: nearestDist };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const dataPath = path.resolve(__dirname, '../data/refillStations.js');
  const raw = fs.readFileSync(dataPath, 'utf8');

  const arrayMatch = raw.match(/export\s+const\s+refillStations\s*=\s*(\[[\s\S]*?\]);/);
  if (!arrayMatch) throw new Error('Could not parse refillStations from data/refillStations.js');
  const stations = JSON.parse(arrayMatch[1]);

  console.log(`\nLoaded ${stations.length} stations. Matching against ${UCSD_LOCATIONS.length} known locations (threshold: ${THRESHOLD_M}m)\n`);
  console.log('═'.repeat(70));

  let accepted = 0;
  let rejected = 0;

  const updated = stations.map((station) => {
    const { nearest, distM } = findNearest(station);
    const ok = distM <= THRESHOLD_M;

    const matchedName = ok
      ? stripPrefixes(nearest.name)
      : `Water Refill Station near ${nearest.name}`;

    const finalName = MANUAL_OVERRIDES[station.id] ?? matchedName;
    const overridden = finalName !== matchedName;

    console.log(`\nStation ${String(station.id).padStart(2)}`);
    console.log(`  Original : "${station.name}"`);
    console.log(`  Coords   : (${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)})`);
    console.log(`  Nearest  : "${nearest?.name}" @ ${distM.toFixed(1)}m`);
    console.log(`  Result   : ${ok ? '✓ ACCEPTED' : '✗ REJECTED'} → "${matchedName}"${overridden ? ` (overridden → "${finalName}")` : ''}`);

    if (ok) accepted++; else rejected++;
    return { ...station, name: finalName };
  });

  console.log('\n' + '═'.repeat(70));
  console.log(`\nSummary: ${accepted} named, ${rejected} used fallback (nearest-building label)\n`);

  const output = `export const refillStations = ${JSON.stringify(updated, null, 2)};\n`;
  fs.writeFileSync(dataPath, output);
  console.log(`Saved → data/refillStations.js`);
}

main();
