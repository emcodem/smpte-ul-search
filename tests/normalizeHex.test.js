'use strict';
/**
 * Unit tests for normalizeHex, looksLikeHex, and the local-tags search logic
 * that depends on them.
 *
 * Run:  node tests/normalizeHex.test.js
 */

const path = require('path');
const { normalizeHex, looksLikeHex } = require(path.resolve(__dirname, '..', 'ul-match.js'));

let passed = 0;
let failed = 0;

function assert(desc, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// normalizeHex — input format normalization
// ---------------------------------------------------------------------------
console.log('\nnormalizeHex():');

assert('compact hex unchanged',           normalizeHex('3004'),              '3004');
assert('uppercase hex lowercased',        normalizeHex('3A0F'),              '3a0f');
assert('dot-separated bytes',             normalizeHex('30.04'),             '3004');
assert('0x prefix on full value',         normalizeHex('0x3004'),            '3004');
assert('0x prefix, comma-space sep',      normalizeHex('0x30, 0x04'),        '3004');
assert('0x prefix, space-separated',      normalizeHex('0x30 0x04'),         '3004');
assert('space-separated bytes',           normalizeHex('30 04'),             '3004');
assert('\\x escape prefix',              normalizeHex('\\x30\\x04'),        '3004');
assert('mixed 0x and dots',              normalizeHex('0x30.0x04'),         '3004');
assert('full 4-byte dot-separated UL prefix', normalizeHex('06.0e.2b.34'), '060e2b34');
assert('urn:smpte:ul: prefix stripped',
  normalizeHex('urn:smpte:ul:060e2b34.027f0101.0d010101.01012500'),
  '060e2b34027f01010d01010101012500');
assert('URN prefix case-insensitive',
  normalizeHex('URN:SMPTE:UL:060E2B34.027F0101.0D010101.01012500'),
  '060e2b34027f01010d01010101012500');
assert('empty string',                    normalizeHex(''),                  '');
assert('only non-hex chars',             normalizeHex('...'),               '');
assert('16-byte dot-UL (urn-body format)',
  normalizeHex('060e2b34.027f0101.0d010101.01012500'),
  '060e2b34027f01010d01010101012500');

// ---------------------------------------------------------------------------
// looksLikeHex
// ---------------------------------------------------------------------------
console.log('\nlooksLikeHex():');

assert('compact hex is hex',              looksLikeHex('3004'),             true);
assert('dot-separated is hex',           looksLikeHex('30.04'),            true);
assert('0x-prefixed is hex',             looksLikeHex('0x3004'),           true);
assert('0x comma-sep is hex',            looksLikeHex('0x30, 0x04'),       true);
assert('full UL with dots is hex',       looksLikeHex('06.0e.2b.34.01.01.01.01.0d.01.01.01.01.01.25.00'), true);
assert('URN is hex',
  looksLikeHex('urn:smpte:ul:060e2b34.027f0101.0d010101.01012500'),        true);
assert('no hex chars → not hex',         looksLikeHex('xyz'),              false);
assert('single hex char not hex (< 2)', looksLikeHex('f'),                false);
assert('empty string is not hex',        looksLikeHex(''),                 false);
assert('only dots not hex',              looksLikeHex('...'),              false);
// note: strings containing a-f/0-9 (e.g. "hello" → "e") are treated as hex-like;
// looksLikeHex is a UL-format detector, not a generic text classifier
assert('"hello world" has hex chars (e,d) → treated as hex', looksLikeHex('hello world'), true);

// ---------------------------------------------------------------------------
// Local-tags search logic (simulated): same normalization applied to
// localTags and reverseRefs as in src/search.js
// ---------------------------------------------------------------------------
console.log('\nLocal-tags search matching:');

function localTagMatches(entry, rawQuery) {
  const queryLower       = rawQuery.toLowerCase();
  const normQueryForTags = normalizeHex(rawQuery);
  return (
    (entry.localTags  || []).some(t => normalizeHex(t).includes(normQueryForTags) || t.toLowerCase().includes(queryLower)) ||
    (entry.reverseRefs || []).some(r => normalizeHex(r.localTag).includes(normQueryForTags) || r.localTag.toLowerCase().includes(queryLower))
  );
}

const fileDescriptor = {
  name: 'File Descriptor',
  localTags: ['3001', '3002', '3004', '3005', '3006'],
  reverseRefs: [],
};

const essenceContainerFormat = {
  name: 'Essence Container Format',
  localTags: [],
  reverseRefs: [{ parentName: 'File Descriptor', parentRegister: 'Groups', localTag: '3004' }],
};

const unrelated = {
  name: 'Some Other Entry',
  localTags: ['4001', '4002'],
  reverseRefs: [],
};

// File Descriptor matched via localTags
assert('File Descriptor matches "3004" (compact)',           localTagMatches(fileDescriptor, '3004'),           true);
assert('File Descriptor matches "30.04" (dot-sep)',          localTagMatches(fileDescriptor, '30.04'),          true);
assert('File Descriptor matches "0x3004"',                   localTagMatches(fileDescriptor, '0x3004'),         true);
assert('File Descriptor matches "0x30, 0x04"',               localTagMatches(fileDescriptor, '0x30, 0x04'),     true);
assert('File Descriptor matches "0x30 0x04" (space-sep)',    localTagMatches(fileDescriptor, '0x30 0x04'),      true);
assert('File Descriptor matches "30 04" (space-sep)',        localTagMatches(fileDescriptor, '30 04'),          true);

// Essence Container Format matched via reverseRefs
assert('Essence Container Format matches "3004" via reverseRef',      localTagMatches(essenceContainerFormat, '3004'),       true);
assert('Essence Container Format matches "30.04" via reverseRef',     localTagMatches(essenceContainerFormat, '30.04'),      true);
assert('Essence Container Format matches "0x3004" via reverseRef',    localTagMatches(essenceContainerFormat, '0x3004'),     true);
assert('Essence Container Format matches "0x30, 0x04" via reverseRef', localTagMatches(essenceContainerFormat, '0x30, 0x04'), true);

// Non-matching
assert('File Descriptor does not match "4001"',         localTagMatches(fileDescriptor, '4001'),           false);
assert('Essence Container Format does not match "3001"', localTagMatches(essenceContainerFormat, '3001'),   false);
assert('Unrelated entry does not match "3004"',         localTagMatches(unrelated, '3004'),                false);

// Partial match (prefix search within tag)
assert('partial "30" matches "3004" in localTags',      localTagMatches(fileDescriptor, '30'),             true);
assert('partial "30" matches "3004" in reverseRefs',    localTagMatches(essenceContainerFormat, '30'),     true);

// ---------------------------------------------------------------------------
// Dynamic local tag detection (>= 0x8000, exactly 4 hex chars after normalize)
// ---------------------------------------------------------------------------
console.log('\nDynamic local tag detection:');

function isDynamicLocalTag(rawQuery) {
  const norm = normalizeHex(rawQuery);
  return norm.length === 4 && parseInt(norm, 16) >= 0x8000;
}

assert('"8000" is dynamic',              isDynamicLocalTag('8000'),         true);
assert('"8001" is dynamic',              isDynamicLocalTag('8001'),         true);
assert('"ffff" is dynamic',              isDynamicLocalTag('ffff'),         true);
assert('"FFFF" is dynamic',              isDynamicLocalTag('FFFF'),         true);
assert('"0x8000" is dynamic',            isDynamicLocalTag('0x8000'),       true);
assert('"0x80, 0x00" is dynamic',        isDynamicLocalTag('0x80, 0x00'),   true);
assert('"80.00" is dynamic',             isDynamicLocalTag('80.00'),        true);
assert('"7fff" is NOT dynamic',          isDynamicLocalTag('7fff'),         false);
assert('"3004" is NOT dynamic',          isDynamicLocalTag('3004'),         false);
assert('"0x3004" is NOT dynamic',        isDynamicLocalTag('0x3004'),       false);
assert('5-char hex is NOT dynamic (wrong length)', isDynamicLocalTag('80001'), false);
assert('3-char hex is NOT dynamic (wrong length)', isDynamicLocalTag('800'),   false);
assert('full UL is NOT dynamic',
  isDynamicLocalTag('060e2b34027f01010d01010101012500'),                   false);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
