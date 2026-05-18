/**
 * tagRefillStations.js
 * ───────────────────────────────────────────────────────────────────────────
 * Adds a `tags` array to every station in data/refillStations.js, derived from
 * the station NAME only. Tags drive the area filter on the Map/Stations screen.
 *
 * Safe to re-run: it reloads the current file, recomputes `tags` from each
 * name, and preserves every other field (id, name, latitude, longitude,
 * description, source, …). It never changes ids, names, coordinates, or order,
 * so Firebase review mappings (keyed by station id) stay intact.
 *
 * Run:  node scripts/tagRefillStations.js
 * ───────────────────────────────────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'refillStations.js');

// ─── Tag rules — order here is the order tags appear on a station ─────────────
// A station gets every tag whose keyword list matches (case-insensitive
// substring of the name). If nothing matches, it falls back to "Other".
const TAG_RULES = [
  { tag: 'Seventh',      keywords: ['Seventh'] },
  { tag: 'Marshall',     keywords: ['Marshall'] },
  { tag: 'ERC',          keywords: ['ERC', 'Eleanor Roosevelt'] },
  { tag: 'Warren',       keywords: ['Warren'] },
  { tag: 'Sixth',        keywords: ['Sixth', 'Catalyst'] },
  { tag: 'Revelle',      keywords: ['Revelle', 'Blake', 'Argo'] },
  { tag: 'Eighth',       keywords: ['Eighth'] },
  { tag: 'Dining Hall',  keywords: ['Dining', 'Cafe', 'Market', 'Pines', 'Ventanas',
                                    '64 Degrees', 'Great Hall', 'Bistro', 'Foodworx',
                                    'OceanView Terrace'] },
  { tag: 'Scripps',      keywords: ['Scripps', 'SIO', 'Eckart', 'Deep Sea', 'Mesom',
                                    'Hubbs', 'Munk'] },
  { tag: 'Med Campus',   keywords: ['Medical', 'Moores', 'Jacobs Medical', 'Thornton',
                                    'Altman', 'Shiley'] },
  { tag: 'Price Center', keywords: ['Price Center'] },
  { tag: 'Athletics',    keywords: ['RIMAC', 'Main Gym', 'Canyonview', 'Athletic', 'Rec'] },
];

// ─── Manual tag corrections ───────────────────────────────────────────────────
// Some stations cannot be tagged correctly from their name alone (e.g. "Tata
// Hall" carries no college keyword, "The Zone" is inside Price Center). These
// overrides FULLY REPLACE the name-derived tags, so re-running this script
// preserves the corrections.
//
// Keyed by station ID (stable and unique) — names are NOT unique: there are two
// "Student Services Center" entries, so a name key could not target just one.
const TAG_OVERRIDES = {
  2:  ['Pepper Canyon'],   // Pepper Canyon East Apartments
  3:  ['Pepper Canyon'],   // Pepper Canyon Hall
  4:  ['Med Campus'],      // Student Services Center (southern one)
  8:  ['Muir'],            // Humanities and Social Sciences Building
  11: ['Seventh'],         // Seventh - Wells Fargo Hall
  17: ['Price Center'],    // Burger King
  18: ['Dining Hall'],     // Canyon Vista
  19: ['Warren'],          // Computer Science and Engineering Building Basement
  20: ['Warren'],          // Engineering Building Unit II (EBU2)
  22: ['Eighth'],          // Galbraith Hall (GH)
  25: ['Muir'],            // Blue Pepper
  26: ['Warren'],          // Jacobs Hall / Engineering Building Unit I (EBU1)
  28: ['Sixth'],           // Peterson Hall (PETER)
  29: ['Muir'],            // Campus Pub
  34: ['ERC'],             // Student Activities Center
  35: ['Seventh'],         // The Soap Bar
  36: ['Price Center'],    // The Zone
  44: ['Muir'],            // AP&M 2nd Floor Lobby
  45: ['Muir'],            // Tamarack Apartments
  46: ['Revelle'],         // Keeling Apartment Building 2
  47: ['Eighth'],          // Dance Studio Facility
  49: ['Med Campus'],      // Telemed 3rd Floor
  50: ['Pepper Canyon'],   // Matthews Building B
  51: ['Pepper Canyon'],   // Pepper Canyon Apartments Laundry Room
  54: ['Warren'],          // Black Apartments Laundry Room
  55: ['Warren'],          // Goldberg Apartments Laundry Room
  59: ['Athletics'],       // 4th Floor Gym
  68: ['Seventh'],         // The Strand
  69: ['Marshall'],        // Social Sciences Building
  70: ['Marshall'],        // Communications Building
  71: ['Sixth'],           // Social Sciences Research Building
  72: ['Muir'],            // Mandeville Auditorium
  75: ['Revelle'],         // Natural Sciences Building
  76: ['Revelle'],         // York Hall
  80: ['Revelle'],         // Tata Hall
  81: ['Eighth'],          // Mandell Weiss Forum
  83: ['ERC'],             // Robinson Building 1
  84: ['ERC'],             // Robinson Auditorium
  85: ['ERC'],             // Robinson Library
  86: ['Eighth'],          // Mandell Weiss Theater
  88: ['Med Campus'],      // Pharmaceutical Sciences Building
  90: ['Price Center'],    // SERF
  91: ['Warren'],          // Atkinson Hall
  92: ['Warren'],          // Structural Materials & Engineering
  94: ['Muir'],            // Student Services A
  95: ['Revelle'],         // Bonner Hall
};

function tagsForName(name) {
  const lower = String(name || '').toLowerCase();
  const tags = [];
  for (const rule of TAG_RULES) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      tags.push(rule.tag);
    }
  }
  return tags.length ? tags : ['Other'];
}

// Final tags for a station: a manual override (by ID) wins outright; otherwise
// the name-matching rules apply.
function tagsForStation(station) {
  const override = TAG_OVERRIDES[station.id];
  return override ? [...override] : tagsForName(station.name);
}

// data/refillStations.js is `export const refillStations = <JSON array>;`
function loadStations() {
  const txt = fs.readFileSync(DATA_FILE, 'utf8');
  const json = txt
    .replace(/^\s*export\s+const\s+refillStations\s*=\s*/, '')
    .replace(/;\s*$/, '');
  return JSON.parse(json);
}

function main() {
  const stations = loadStations();
  console.log(`Loaded ${stations.length} stations.\n`);

  const tagged = stations.map((s) => ({
    ...s,                      // preserve id, name, coords, description, source…
    tags: tagsForStation(s),   // overwrite tags only (overrides win)
  }));

  const output = `export const refillStations = ${JSON.stringify(tagged, null, 2)};\n`;
  fs.writeFileSync(DATA_FILE, output);

  // ─── Summary ────────────────────────────────────────────────────────────────
  const counts = {};
  for (const s of tagged) for (const t of s.tags) counts[t] = (counts[t] || 0) + 1;

  console.log('TAG DISTRIBUTION');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, n]) => console.log(`  ${tag.padEnd(14)} ${n}`));

  console.log('\nSAMPLE');
  tagged.slice(0, 8).forEach((s) =>
    console.log(`  #${String(s.id).padEnd(3)} ${s.name}  →  [${s.tags.join(', ')}]`));

  console.log(`\nSaved ${tagged.length} stations to ${path.relative(process.cwd(), DATA_FILE)}`);
}

main();
