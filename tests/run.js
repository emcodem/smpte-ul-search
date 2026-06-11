'use strict';
/**
 * Corpus runner: searches each label from labels.json against the SMPTE register
 * using the real matcher (buildAllEntries + matchEntries — the same path the
 * browser and the Vercel API use; no private copy of the matching logic).
 *
 * As a library:  const { runCorpus } = require('./run.js')
 * As a CLI:      node tests/run.js [--out tests/results/snapshot.json]
 *                (writes a timestamped snapshot for ad-hoc diffing with diff.js)
 */

const fs   = require('fs');
const path = require('path');

const SMPTE_ENTRIES = require(path.resolve(__dirname, '..', 'data.js'));
const SYSTEM_ITEMS  = require(path.resolve(__dirname, '..', 'systemItems.js'));
const orgRegistry   = require(path.resolve(__dirname, '..', 'orgs.js'));

if (!SMPTE_ENTRIES || !SMPTE_ENTRIES.length) {
  console.error('ERROR: SMPTE_ENTRIES not found — run build-data.ps1 first');
  process.exit(1);
}

const ulMatch = require(path.resolve(__dirname, '..', 'ul-match.js'));
const { buildAllEntries } = require(path.resolve(__dirname, '..', 'src', 'entries.js'));
const { matchEntries }    = require(path.resolve(__dirname, '..', 'src', 'search-core.js'));

const built       = buildAllEntries(SMPTE_ENTRIES, SYSTEM_ITEMS, ulMatch.normalizeHex, orgRegistry);
const enabledRegs = new Set(built.registers);

// Search a single label via the real matcher, returns matching entries.
function searchLabel(dotLabel) {
  const matches = matchEntries({
    allEntries: built.allEntries,
    enabledRegs,
    hideDep: false,
    localTagsOnly: false,
    raw: dotLabel,
    ulMatch,
  });
  return matches.map(({ e }) => ({
    register: e.register, name: e.name, symbol: e.symbol, deprecated: e.isDeprecated,
  }));
}

// Run every label in labels.json and return a result object (the snapshot/baseline shape).
function runCorpus() {
  const labelsFile = path.resolve(__dirname, 'labels.json');
  const labelsData = JSON.parse(fs.readFileSync(labelsFile, 'utf8'));
  const labels     = labelsData.labels;

  const results = [];
  let withHits = 0;
  for (const label of labels) {
    const hits = searchLabel(label);
    if (hits.length > 0) withHits++;
    results.push({ label, hits: hits.length, entries: hits });
  }

  return {
    source:        labelsData.source,
    totalLabels:   labels.length,
    withResults:   withHits,
    noResults:     labels.length - withHits,
    entriesCount:  built.allEntries.length,
    results,
  };
}

module.exports = { runCorpus, searchLabel };

// ---------------------------------------------------------------------------
// CLI: write a timestamped snapshot (for diff.js). Not a pass/fail gate —
// regression.test.js is the gate wired into `npm test`.
// ---------------------------------------------------------------------------
if (require.main === module) {
  const run = runCorpus();
  console.log(`Loaded ${run.totalLabels} labels from labels.json`);
  console.log(`Searching against ${run.entriesCount.toLocaleString()} SMPTE entries…`);
  console.log(`Done — ${run.withResults} labels matched, ${run.noResults} unresolved`);

  const outArg = process.argv.indexOf('--out');
  const outFile = (outArg !== -1 && process.argv[outArg + 1])
    ? path.resolve(process.argv[outArg + 1])
    : path.resolve(__dirname, 'results', `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({ timestamp: new Date().toISOString(), ...run }, null, 2));
  console.log(`Results written to ${outFile}`);
}
