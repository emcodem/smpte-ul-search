'use strict';
/**
 * API handler unit tests — calls api/search.js directly without starting a server.
 *
 * Usage:
 *   node tests/test-api.js
 */

const path    = require('path');
const handler = require(path.resolve(__dirname, '..', 'api', 'search.js'));

let passed = 0;
let failed = 0;

function call(query) {
  const res = {
    _code: null, _data: null,
    status(c) { this._code = c; return this; },
    json(d)   { this._data = d; },
    setHeader() {},
    end()      {},
  };
  handler({ method: 'GET', query }, res);
  return { code: res._code, data: res._data };
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// localTag 3004 (hex) — localTagsOnly mode
// Expected: "Essence Container Format" (Elements) and "File Descriptor" (Groups)
// ---------------------------------------------------------------------------
console.log('\nTest: localTag 3004 search');
{
  const { code, data } = call({ q: '3004', localTagsOnly: 'true' });
  assert(code === 200, 'HTTP 200');
  assert(data.total === 2, `total === 2 (got ${data.total})`);
  assert(data.results.every(r => !r.isDeprecated), 'no deprecated entries');
  const names = data.results.map(r => r.name);
  assert(names.includes('Essence Container Format'), 'contains "Essence Container Format" (Elements)');
  assert(names.includes('File Descriptor'),          'contains "File Descriptor" (Groups)');
}

// ---------------------------------------------------------------------------
// Missing q parameter → 400
// ---------------------------------------------------------------------------
console.log('\nTest: missing q parameter');
{
  const { code, data } = call({});
  assert(code === 400, 'HTTP 400');
  assert(typeof data.error === 'string', 'error message present');
}

// ---------------------------------------------------------------------------
// Text search — basic sanity
// ---------------------------------------------------------------------------
console.log('\nTest: text search "FileDescriptor"');
{
  const { code, data } = call({ q: 'FileDescriptor' });
  assert(code === 200, 'HTTP 200');
  assert(data.total > 0, `has results (got ${data.total})`);
}

// ---------------------------------------------------------------------------
// UL hex search (SMPTE prefix)
// ---------------------------------------------------------------------------
console.log('\nTest: UL hex prefix search');
{
  const { code, data } = call({ q: '060e2b34' });
  assert(code === 200, 'HTTP 200');
  assert(data.total > 1000, `broad prefix returns many results (got ${data.total})`);
}

// ---------------------------------------------------------------------------
// Register filter
// ---------------------------------------------------------------------------
console.log('\nTest: register filter (Groups only)');
{
  const { code, data } = call({ q: 'timecode', registers: 'Groups' });
  assert(code === 200, 'HTTP 200');
  assert(data.results.every(r => r.register === 'Groups'), 'all results are Groups');
}

// ---------------------------------------------------------------------------
// hideDeprecated filter
// ---------------------------------------------------------------------------
console.log('\nTest: hideDeprecated filter');
{
  const all  = call({ q: 'picture' });
  const noD  = call({ q: 'picture', hideDeprecated: 'true' });
  assert(noD.data.total <= all.data.total, 'hideDeprecated reduces or equals result count');
  assert(noD.data.results.every(r => !r.isDeprecated), 'no deprecated entries in filtered response');
}

// ---------------------------------------------------------------------------
// normalizeHex — 0x syntax
// ---------------------------------------------------------------------------
console.log('\nTest: normalizeHex — 0x prefix syntax');
{
  const hex   = call({ q: '060e2b3402530101' });
  const ox    = call({ q: '0x06 0x0e 0x2b 0x34 0x02 0x53 0x01 0x01' });
  const dots  = call({ q: '06.0e.2b.34.02.53.01.01' });
  assert(hex.data.total === ox.data.total && ox.data.total === dots.data.total,
    `0x and dot syntax normalize to same results (${hex.data.total} hits)`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
