'use strict';
/**
 * Test runner: searches each label from labels.json against the SMPTE register
 * and writes a timestamped result file to results/.
 *
 * Usage:
 *   node tests/run.js
 *   node tests/run.js --out tests/results/baseline.json
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Load data.js with a window shim (data.js does: window.SMPTE_ENTRIES = [...])
// ---------------------------------------------------------------------------
const global_window = {};
global.window = global_window;
require(path.resolve(__dirname, '..', 'data.js'));
const SMPTE_ENTRIES = global_window.SMPTE_ENTRIES;
const SYSTEM_ITEMS = require(path.resolve(__dirname, '..', 'systemItems.js'));

if (!SMPTE_ENTRIES || !SMPTE_ENTRIES.length) {
  console.error('ERROR: SMPTE_ENTRIES not found — run build-data.ps1 first');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// UL matching functions — shared module (single source of truth)
// ---------------------------------------------------------------------------
const { normalizeHex, ulMatchesWithWildcard, ulPrefixMatchWithWildcard, ulMatchesEssenceWildcard } =
  require(path.resolve(__dirname, '..', 'ul-match.js'));

// ---------------------------------------------------------------------------
// Build entry list (mirrors allEntries in index.html)
// Merge SMPTE_ENTRIES with System Items from 326M/385M
// ---------------------------------------------------------------------------
const allEntries = [
  ...SMPTE_ENTRIES.map(e => ({
    register:   e.register,
    symbol:     e.symbol   || '',
    name:       e.name     || '',
    normUL:     normalizeHex(e.ul || ''),
    isDeprecated: !!e.deprecated,
  })),
  ...SYSTEM_ITEMS.map(e => ({
    register:   e.register,
    symbol:     e.symbol   || '',
    name:       e.name     || '',
    normUL:     e.ul.replace(/\./g, '').toLowerCase(),
    isDeprecated: false,
  })),
];

// ---------------------------------------------------------------------------
// Search a single label, returns array of matching entry names
// ---------------------------------------------------------------------------
function searchLabel(dotLabel) {
  const normQuery = normalizeHex(dotLabel);
  if (!normQuery) return [];

  const doWildcard = normQuery.startsWith('060e2b34');
  const hits = [];

  for (const e of allEntries) {
    let match = e.normUL.includes(normQuery);
    if (!match && doWildcard) {
      const matchFn = normQuery.length < 32 ? ulPrefixMatchWithWildcard : ulMatchesWithWildcard;
      match = matchFn(normQuery, e.normUL);
      if (!match && normQuery.length === 32 && normQuery.substring(8, 10) === '01' && e.register === 'Essence') {
        match = ulMatchesEssenceWildcard(normQuery, e.normUL);
      }
    }
    if (match) hits.push({ register: e.register, name: e.name, symbol: e.symbol, deprecated: e.isDeprecated });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const labelsFile = path.resolve(__dirname, 'labels.json');
const labelsData = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
const labels = labelsData.labels;

console.log(`Loaded ${labels.length} labels from ${path.basename(labelsFile)}`);
console.log(`Searching against ${allEntries.length.toLocaleString()} SMPTE entries…`);

const results = [];
let withHits = 0;

for (const label of labels) {
  const hits = searchLabel(label);
  if (hits.length > 0) withHits++;
  results.push({ label, hits: hits.length, entries: hits });
}

const noHits = labels.length - withHits;
console.log(`Done — ${withHits} labels matched, ${noHits} unresolved`);

// Determine output path
const outArg = process.argv.indexOf('--out');
let outFile;
if (outArg !== -1 && process.argv[outArg + 1]) {
  outFile = path.resolve(process.argv[outArg + 1]);
} else {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  outFile = path.resolve(__dirname, 'results', `run-${ts}.json`);
}

const output = {
  timestamp:    new Date().toISOString(),
  source:       labelsData.source,
  totalLabels:  labels.length,
  withResults:  withHits,
  noResults:    noHits,
  results,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
console.log(`Results written to ${outFile}`);
