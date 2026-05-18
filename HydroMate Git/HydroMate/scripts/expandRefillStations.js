/**
 * expandRefillStations.js
 * ───────────────────────────────────────────────────────────────────────────
 * Expands data/refillStations.js with UCSD hydration locations from the
 * official UCSD mobile map (maps.ucsd.edu), which is powered by Concept3D.
 *
 * Unlike fetchRefillStations.js (which rebuilds the file from scratch and
 * reassigns IDs 1..N), this script *merges* — it is safe to re-run:
 *
 *   • Existing stations are kept verbatim — same id, name, coords, order.
 *   • New hydration locations are appended with fresh IDs (maxId + 1, +2, …).
 *   • New locations within ~30 m of an already-known station are skipped as
 *     duplicates, so re-running never creates duplicates.
 *   • Locations with no coordinates are listed, never guessed.
 *
 * Firebase RTDB reviews are keyed by station id, so preserving existing ids
 * is essential — that is why this script never touches them.
 *
 * Run:  node scripts/expandRefillStations.js
 * ───────────────────────────────────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

// ─── Source: UCSD mobile map (Concept3D) ──────────────────────────────────────
// maps.ucsd.edu embeds Concept3D map id 1005. Category 18003 is "Hydration".
// The public Concept3D browse key below is the same one the public map uses.
const MAP_ID      = 1005;
const HYDRATION_CATEGORY = 18003;
const C3D_KEY     = '0001085cc708b9cef47080f064612ca5';
const C3D_URL =
  `https://api.concept3d.com/categories/${HYDRATION_CATEGORY}` +
  `?map=${MAP_ID}&key=${C3D_KEY}&children`;

// Two locations are treated as the same physical station within this radius.
const DEDUPE_RADIUS_M = 30;

const DATA_FILE = path.join(__dirname, '..', 'data', 'refillStations.js');

// ─── Geo helper ───────────────────────────────────────────────────────────────
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

// ─── Name cleaning ────────────────────────────────────────────────────────────
// Strips the "Hydration Location - " / "Hydration Locations - " prefix
// (singular/plural, optional space around the dash, leading whitespace).
function cleanName(raw) {
  return String(raw || '')
    .replace(/^\s*hydration\s+locations?\s*[-–—:]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Load the existing dataset ────────────────────────────────────────────────
// data/refillStations.js is `export const refillStations = <JSON array>;` —
// the array body is plain JSON, so we slice off the wrapper and parse it.
function loadExisting() {
  const txt = fs.readFileSync(DATA_FILE, 'utf8');
  const json = txt
    .replace(/^\s*export\s+const\s+refillStations\s*=\s*/, '')
    .replace(/;\s*$/, '');
  return JSON.parse(json);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const existing = loadExisting();
  const maxId = existing.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0);
  console.log(`Loaded ${existing.length} existing stations (max id ${maxId}).`);

  console.log(`Fetching UCSD hydration locations from Concept3D map ${MAP_ID}…`);
  const res = await fetch(C3D_URL);
  const data = await res.json();
  const raw = data?.children?.locations || [];
  console.log(`Fetched ${raw.length} hydration locations.\n`);

  // `known` accumulates every station we will keep — existing first, then each
  // new one we accept — so incoming locations dedupe against both the original
  // dataset AND earlier accepted locations from this same run.
  const known = existing.map((s) => ({
    lat: s.latitude, lng: s.longitude, name: s.name, id: s.id,
  }));

  const added = [];
  const skipped = [];        // { name, matched, distance }
  const missingCoords = [];  // { name }
  let nextId = maxId + 1;

  for (const loc of raw) {
    const name = cleanName(loc.name);
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);

    // No usable coordinates — record the name, never invent a location.
    if (!lat || !lng || Number.isNaN(lat) || Number.isNaN(lng)) {
      missingCoords.push({ name });
      continue;
    }

    // Proximity dedupe against everything kept so far.
    let dup = null;
    let dupDist = Infinity;
    for (const k of known) {
      const d = haversineM(lat, lng, k.lat, k.lng);
      if (d < dupDist) { dupDist = d; dup = k; }
    }
    if (dup && dupDist <= DEDUPE_RADIUS_M) {
      skipped.push({ name, matched: dup.name, distance: dupDist });
      continue;
    }

    const station = {
      id: nextId++,
      name,
      latitude: lat,
      longitude: lng,
      description: 'Water refill station',
      source: 'ucsd_mobile_maps',
    };
    added.push(station);
    known.push({ lat, lng, name, id: station.id });
  }

  // Existing entries are preserved exactly; we only stamp a `source` if absent
  // (their origin is the ArcGIS survey layer). id / name / coords / order kept.
  const preserved = existing.map((s) => ({
    ...s,
    source: s.source || 'arcgis',
  }));

  const merged = [...preserved, ...added];
  const output = `export const refillStations = ${JSON.stringify(merged, null, 2)};\n`;
  fs.writeFileSync(DATA_FILE, output);

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('═══════════════════════ SUMMARY ═══════════════════════');
  console.log(`Existing stations preserved : ${preserved.length}`);
  console.log(`New stations added          : ${added.length}`);
  console.log(`Duplicates skipped          : ${skipped.length}`);
  console.log(`Locations missing coords    : ${missingCoords.length}`);
  console.log(`Final station count         : ${merged.length}`);
  console.log('════════════════════════════════════════════════════════\n');

  if (added.length) {
    console.log('NEW STATIONS ADDED');
    console.log('  id   latitude     longitude     name');
    for (const s of added) {
      console.log(
        `  ${String(s.id).padEnd(4)} ${s.latitude.toFixed(6)}  ` +
        `${s.longitude.toFixed(6)}  ${s.name}`
      );
    }
    console.log('');
  }

  if (skipped.length) {
    console.log('DUPLICATES SKIPPED (within ' + DEDUPE_RADIUS_M + ' m of a known station)');
    for (const s of skipped) {
      console.log(`  "${s.name}"  ≈  "${s.matched}"  (${s.distance.toFixed(1)} m)`);
    }
    console.log('');
  }

  if (missingCoords.length) {
    console.log('LOCATIONS MISSING COORDINATES (not added — listed for manual review)');
    for (const m of missingCoords) console.log(`  - ${m.name}`);
    console.log('');
  }

  console.log(`Saved ${merged.length} stations to ${path.relative(process.cwd(), DATA_FILE)}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
