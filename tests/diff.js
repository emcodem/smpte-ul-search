'use strict';
/**
 * Diff two test-run result files and report what changed.
 *
 * Usage:
 *   node tests/diff.js <before.json> <after.json>
 *
 * Exit code: 0 = no regressions, 1 = regressions detected.
 */

const fs   = require('fs');
const path = require('path');

const [,, fileA, fileB] = process.argv;
if (!fileA || !fileB) {
  console.error('Usage: node tests/diff.js <before.json> <after.json>');
  process.exit(2);
}

const a = JSON.parse(fs.readFileSync(path.resolve(fileA), 'utf8'));
const b = JSON.parse(fs.readFileSync(path.resolve(fileB), 'utf8'));

// Index results by label
const mapA = Object.fromEntries(a.results.map(r => [r.label, r]));
const mapB = Object.fromEntries(b.results.map(r => [r.label, r]));

const allLabels = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort();

const gained    = [];  // 0 hits → >0 hits  (improved)
const lost      = [];  // >0 hits → 0 hits  (regression)
const moreHits  = [];  // hit count increased
const fewerHits = [];  // hit count decreased (possible regression)
const unchanged = [];

for (const label of allLabels) {
  const ra = mapA[label];
  const rb = mapB[label];

  if (!ra) { gained.push({ label, before: 0, after: rb.hits }); continue; }
  if (!rb) { lost.push({ label, before: ra.hits, after: 0 });   continue; }

  if (ra.hits === 0 && rb.hits > 0) {
    gained.push({ label, before: 0, after: rb.hits });
  } else if (ra.hits > 0 && rb.hits === 0) {
    lost.push({ label, before: ra.hits, after: 0 });
  } else if (rb.hits > ra.hits) {
    moreHits.push({ label, before: ra.hits, after: rb.hits });
  } else if (rb.hits < ra.hits) {
    fewerHits.push({ label, before: ra.hits, after: rb.hits });
  } else {
    unchanged.push(label);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\nComparing:`);
console.log(`  BEFORE: ${path.basename(fileA)}  (${a.timestamp})`);
console.log(`  AFTER:  ${path.basename(fileB)}  (${b.timestamp})`);
console.log(`\nSummary: ${allLabels.length} labels total`);
console.log(`  Before: ${a.withResults}/${a.totalLabels} resolved`);
console.log(`  After:  ${b.withResults}/${b.totalLabels} resolved`);

if (gained.length) {
  console.log(`\n[+] ${gained.length} labels now resolve (newly matched):`);
  for (const r of gained) console.log(`    ${r.label}  (${r.before} → ${r.after} hit${r.after !== 1 ? 's' : ''})`);
}

if (moreHits.length) {
  console.log(`\n[↑] ${moreHits.length} labels with more hits:`);
  for (const r of moreHits) console.log(`    ${r.label}  (${r.before} → ${r.after})`);
}

if (fewerHits.length) {
  console.log(`\n[↓] ${fewerHits.length} labels with fewer hits:`);
  for (const r of fewerHits) console.log(`    ${r.label}  (${r.before} → ${r.after})`);
}

if (lost.length) {
  console.log(`\n[-] ${lost.length} REGRESSIONS — labels that no longer resolve:`);
  for (const r of lost) console.log(`    ${r.label}  (${r.before} → 0)`);
}

if (!gained.length && !moreHits.length && !fewerHits.length && !lost.length) {
  console.log('\nNo changes — results are identical.');
}

if (lost.length > 0) {
  console.error(`\nFAIL: ${lost.length} regression(s) detected`);
  process.exit(1);
}
console.log('\nOK: no regressions');
