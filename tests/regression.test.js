'use strict';
/**
 * Matching regression gate — the pass/fail check wired into `npm test`.
 *
 * Runs every UL in labels.json through the real matcher and asserts, for each label,
 * that BOTH match exactly the committed baseline (tests/baseline.json):
 *   - the hit count, and
 *   - the set of card-names (the entry names shown in the search result).
 *
 * Any difference — count change, a name added/removed/swapped, a label that gains or
 * loses matches — fails the run (exit 1). Unlike diff.js (lenient, count-only, snapshot
 * tooling), this is strict and version-controlled.
 *
 * Usage:
 *   node tests/regression.test.js            run the gate
 *   node tests/regression.test.js --update   regenerate baseline after an intended change
 */

const fs   = require('fs');
const path = require('path');
const { runCorpus } = require('./run.js');

const BASELINE = path.resolve(__dirname, 'baseline.json');

// Reduce a corpus run to the comparable shape: label -> { hits, names (sorted) }.
function toExpected(run) {
  const labels = {};
  for (const r of run.results) {
    labels[r.label] = { hits: r.hits, names: r.entries.map(e => e.name).sort() };
  }
  return { generated: new Date().toISOString(), source: run.source, totalLabels: run.totalLabels, labels };
}

const run = runCorpus();

// --update: (re)write the committed baseline and exit.
if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(toExpected(run), null, 2));
  console.log(`Baseline updated: ${run.totalLabels} labels written to ${path.relative(process.cwd(), BASELINE)}`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error(`ERROR: ${path.relative(process.cwd(), BASELINE)} missing. Generate it with:\n  node tests/regression.test.js --update`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const current  = toExpected(run).labels;
const allLabels = [...new Set([...Object.keys(baseline.labels), ...Object.keys(current)])].sort();

const eqNames = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

let failures = 0;
console.log(`\nMatching regression: ${allLabels.length} labels (hit count + card-names)`);

for (const label of allLabels) {
  const want = baseline.labels[label];
  const got  = current[label];

  if (!want) { console.error(`  ✗ ${label} — not in baseline (run --update if intended)`); failures++; continue; }
  if (!got)  { console.error(`  ✗ ${label} — missing from current run (label removed from corpus?)`); failures++; continue; }

  if (want.hits !== got.hits) {
    console.error(`  ✗ ${label} — hit count ${want.hits} → ${got.hits}`);
    console.error(`      expected: [${want.names.join(', ')}]`);
    console.error(`      actual:   [${got.names.join(', ')}]`);
    failures++;
  } else if (!eqNames(want.names, got.names)) {
    console.error(`  ✗ ${label} — same count (${want.hits}) but card-names differ`);
    console.error(`      expected: [${want.names.join(', ')}]`);
    console.error(`      actual:   [${got.names.join(', ')}]`);
    failures++;
  }
}

if (failures === 0) {
  console.log(`  ✓ all ${allLabels.length} labels match baseline (count + names)`);
  console.log(`\n${allLabels.length} labels: all passed`);
} else {
  console.error(`\n${allLabels.length} labels: ${failures} failed`);
  console.error('If these changes are intentional, refresh the baseline:\n  node tests/regression.test.js --update');
  process.exit(1);
}
