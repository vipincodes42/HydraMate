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
// overrides are keyed by the lowercased station name and FULLY REPLACE the
// name-derived tags — so re-running this script preserves the corrections.
// Station names never change, so keying by name is stable.
const TAG_OVERRIDES = {
  'tata hall':           ['Revelle'],
  'york hall':           ['Revelle'],
  'galbraith hall (gh)': ['Eighth'],
  'the strand':          ['Seventh'],
  'the soap bar':        ['Seventh'],
  'the zone':            ['Price Center'],
  'burger king':         ['Price Center'],
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

// Final tags for a station: a manual override wins outright; otherwise the
// name-matching rules apply.
function tagsForStation(name) {
  const override = TAG_OVERRIDES[String(name || '').trim().toLowerCase()];
  return override ? [...override] : tagsForName(name);
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
    ...s,                          // preserve id, name, coords, description, source…
    tags: tagsForStation(s.name),  // overwrite tags only (overrides win)
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
