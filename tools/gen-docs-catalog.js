'use strict';
// Generates smpte-docs.js (browser UMD catalog) from smpte_docs.json.
// Run: node tools/gen-docs-catalog.js
const fs   = require('fs');
const path = require('path');

const root    = path.resolve(__dirname, '..');
const srcFile = path.join(root, 'smpte_docs.json');
const outFile = path.join(root, 'smpte-docs.js');

const docs  = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
const slugs = docs.map(d => {
  const m = d.url.match(/\/doc\/([^/]+)\/$/);
  return m ? m[1] : null;
}).filter(Boolean);

const lines = [
  '// AUTO-GENERATED from smpte_docs.json — do not edit by hand.',
  '// Regenerate: node tools/gen-docs-catalog.js',
  '(function (f) {',
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = f();',
  '  else { window.SMPTE = window.SMPTE || {}; window.SMPTE.docCatalog = f(); }',
  '})(function () {',
  '  \'use strict\';',
  `  const SLUGS = new Set(${JSON.stringify(slugs)});`,
  '  return { SLUGS };',
  '});',
];

fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(`Written ${slugs.length} slugs to smpte-docs.js`);
