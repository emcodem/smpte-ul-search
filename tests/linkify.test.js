'use strict';
/**
 * Unit tests for linkifyDoc() and toSlug() from src/smpte-links.js.
 *
 * Run:  node tests/linkify.test.js
 */
const path = require('path');
const { linkifyDoc, toSlug } = require(path.resolve(__dirname, '..', 'src', 'smpte-links.js'));

const ROOT = 'https://pub.smpte.org/doc/';

// Stub catalog containing slugs known to exist
const CATALOG = new Set([
  'st274', 'st296', 'st309', 'st326', 'st330', 'st331', 'st332', 'st336', 'st352',
  'st366', '377', 'st377-1', 'st377-4', 'st379-1', 'st379-2', 'st380', 'st381',
  'st381-2', 'st382', 'st394', 'st401', 'st422', 'st429-6', 'st430-6', 'st436',
  'st2037', 'st2045', 'st2067-2', 'st2067-8', 'st2088', 'rp2057', 'rp2089',
  'eg432-1', 'rdd18',
]);

let passed = 0;
let failed = 0;

function assert(desc, actual, expected) {
  if (actual === expected) {
    console.log('  ✓ ' + desc);
    passed++;
  } else {
    console.error('  ✗ ' + desc);
    console.error('    expected: ' + JSON.stringify(expected));
    console.error('    actual:   ' + JSON.stringify(actual));
    failed++;
  }
}

function link(slug, display) {
  var href = (slug && CATALOG.has(slug)) ? ROOT + slug + '/' : ROOT;
  return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + display + '</a>';
}

// ---------------------------------------------------------------------------
// toSlug()
// ---------------------------------------------------------------------------
console.log('\ntoSlug():');
assert('modern ST 377-1',          toSlug('ST',  '377-1'),       'st377-1');
assert('modern RP 2057',           toSlug('RP',  '2057'),        'rp2057');
assert('bare ST 2067-8',           toSlug('ST',  '2067-8'),      'st2067-8');
assert('legacy M suffix: 380M',    toSlug('ST',  '380M'),        'st380');
assert('legacy M mid:   377M-1',   toSlug('ST',  '377M-1'),      'st377-1');
assert('legacy M+year: 352M-2001', toSlug('ST',  '352M-2001'),   'st352');
assert('legacy year: 2037-2008',   toSlug('ST',  '2037-2008'),   'st2037');
assert('part+year: 379-1-2009',    toSlug('ST',  '379-1-2009'),  'st379-1');
assert('colon-year: 379-2:2010',   toSlug('ST',  '379-2:2010'),  'st379-2');
assert('dot form: 429.6',          toSlug('ST',  '429.6'),       'st429-6');
assert('trailing M on part: 429-6M', toSlug('ST','429-6M'),      'st429-6');
assert('no-space type: 2067-2',    toSlug('ST',  '2067-2'),      'st2067-2');
assert('RP no-space: 2089',        toSlug('RP',  '2089'),        'rp2089');
assert('bad body → null',          toSlug('ST',  'XYZ'),         null);
assert('ST 377 bare → deprecated slug redirect', toSlug('ST', '377'), '377');
assert('legacy M bare: 377M → deprecated slug redirect', toSlug('ST', '377M'), '377');
assert('ST 377-1 part unaffected', toSlug('ST', '377-1'), 'st377-1');

// ---------------------------------------------------------------------------
// linkifyDoc() — modern forms
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — modern forms:');
assert('SMPTE ST 377-1',
  linkifyDoc('SMPTE ST 377-1', CATALOG),
  link('st377-1', 'SMPTE ST 377-1'));

assert('RP 2057 (no SMPTE)',
  linkifyDoc('RP 2057', CATALOG),
  link('rp2057', 'RP 2057'));

assert('ST 2067-8 (bare, no SMPTE)',
  linkifyDoc('ST 2067-8', CATALOG),
  link('st2067-8', 'ST 2067-8'));

assert('SMPTE RP 2057',
  linkifyDoc('SMPTE RP 2057', CATALOG),
  link('rp2057', 'SMPTE RP 2057'));

assert('EG 432-1',
  linkifyDoc('EG 432-1', CATALOG),
  link('eg432-1', 'EG 432-1'));

assert('RDD 18',
  linkifyDoc('RDD 18', CATALOG),
  link('rdd18', 'RDD 18'));

assert('SMPTE ST 377 (bare) resolves to deprecated-free slug',
  linkifyDoc('SMPTE ST 377', CATALOG),
  link('377', 'SMPTE ST 377'));

assert('SMPTE 377M (bare, legacy M) resolves to deprecated-free slug',
  linkifyDoc('SMPTE 377M', CATALOG),
  link('377', 'SMPTE 377M'));

// ---------------------------------------------------------------------------
// linkifyDoc() — legacy M-suffix forms
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — legacy M-suffix:');
assert('SMPTE 380M',
  linkifyDoc('SMPTE 380M', CATALOG),
  link('st380', 'SMPTE 380M'));

assert('SMPTE 377M-1 (M then part)',
  linkifyDoc('SMPTE 377M-1', CATALOG),
  link('st377-1', 'SMPTE 377M-1'));

assert('SMPTE331M (no space)',
  linkifyDoc('SMPTE331M', CATALOG),
  link('st331', 'SMPTE331M'));

assert('SMPTE381M (no space)',
  linkifyDoc('SMPTE381M', CATALOG),
  link('st381', 'SMPTE381M'));

// ---------------------------------------------------------------------------
// linkifyDoc() — year suffix / colon-year forms
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — year / colon-year:');
assert('SMPTE 352M-2001',
  linkifyDoc('SMPTE 352M-2001', CATALOG),
  link('st352', 'SMPTE 352M-2001'));

assert('SMPTE 379-1-2009',
  linkifyDoc('SMPTE 379-1-2009', CATALOG),
  link('st379-1', 'SMPTE 379-1-2009'));

assert('SMPTE ST 379-2:2010',
  linkifyDoc('SMPTE ST 379-2:2010', CATALOG),
  link('st379-2', 'SMPTE ST 379-2:2010'));

assert('SMPTE 2037-2008',
  linkifyDoc('SMPTE 2037-2008', CATALOG),
  link('st2037', 'SMPTE 2037-2008'));

// ---------------------------------------------------------------------------
// linkifyDoc() — no-space forms
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — no-space forms:');
assert('SMPTE ST2067-2 (no space between type and num)',
  linkifyDoc('SMPTE ST2067-2', CATALOG),
  link('st2067-2', 'SMPTE ST2067-2'));

assert('SMPTE RP2089 (no space between RP and num)',
  linkifyDoc('SMPTE RP2089', CATALOG),
  link('rp2089', 'SMPTE RP2089'));

// ---------------------------------------------------------------------------
// linkifyDoc() — dot form
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — dot form:');
assert('SMPTE 429.6',
  linkifyDoc('SMPTE 429.6', CATALOG),
  link('st429-6', 'SMPTE 429.6'));

// ---------------------------------------------------------------------------
// linkifyDoc() — multi-doc strings (pass 1 catches both)
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — multi-doc strings:');

// st12 is NOT in catalog → falls back to ROOT
var multiResult1 = linkifyDoc('SMPTE 12M & SMPTE 331M', CATALOG);
assert('SMPTE 12M & SMPTE 331M — 12M falls back to ROOT',
  multiResult1.includes('href="' + ROOT + '"'),
  true);
assert('SMPTE 12M & SMPTE 331M — 331M resolves',
  multiResult1.includes('href="' + ROOT + 'st331/"'),
  true);

// st309 is NOT in catalog → falls back to ROOT
assert('SMPTE 309M & SMPTE 331M — both get links',
  linkifyDoc('SMPTE 309M &amp; SMPTE 331M', CATALOG).split('<a ').length - 1,
  2);

// ---------------------------------------------------------------------------
// linkifyDoc() — bare sibling after & (pass 2)
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — bare sibling (pass 2):');
var sibling = linkifyDoc('SMPTE 274M & 296M', CATALOG);
assert('SMPTE 274M & 296M — 274M linked',
  sibling.includes('href="' + ROOT + 'st274/"'),
  true);
assert('SMPTE 274M & 296M — 296M linked (sibling)',
  sibling.includes('href="' + ROOT + 'st296/"'),
  true);
assert('SMPTE 274M & 296M — exactly 2 links',
  sibling.split('<a ').length - 1,
  2);

// ---------------------------------------------------------------------------
// linkifyDoc() — fallback to ROOT when slug not in catalog
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — catalog fallback:');
// st12 is not in catalog
assert('SMPTE 12M (not in catalog) → fallback to ROOT',
  linkifyDoc('SMPTE 12M', CATALOG),
  link(null, 'SMPTE 12M'));

// ---------------------------------------------------------------------------
// linkifyDoc() — non-SMPTE values stay plain text
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — non-SMPTE plain text:');
assert('EBU Tech 3293 → no links',
  linkifyDoc('EBU Tech 3293', CATALOG),
  'EBU Tech 3293');

assert('ISO/IEC 15444-1:2004 AMD8 → no links',
  linkifyDoc('ISO/IEC 15444-1:2004 AMD8', CATALOG),
  'ISO/IEC 15444-1:2004 AMD8');

assert('AMWA Application Specification AS-11 → no links',
  linkifyDoc('AMWA Application Specification AS-11 MXF Program Contribution', CATALOG),
  'AMWA Application Specification AS-11 MXF Program Contribution');

assert('empty string → empty string', linkifyDoc('', CATALOG), '');
assert('null → empty string', linkifyDoc(null, CATALOG), '');

// ---------------------------------------------------------------------------
// linkifyDoc() — XSS safety
// ---------------------------------------------------------------------------
console.log('\nlinkifyDoc() — XSS:');
assert('<script> in defDoc is escaped',
  linkifyDoc('<script>alert(1)</script>', CATALOG),
  '&lt;script&gt;alert(1)&lt;/script&gt;');

assert('quotes escaped',
  linkifyDoc('say "hello" & ST 336', CATALOG).includes('&amp;'),
  true);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
