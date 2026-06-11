// UL matching utilities — shared between index.html (browser) and tests/run.js (Node.js).
// Loaded as a plain <script> tag in the browser (sets window.UL_MATCH) or via require() in Node.
//
// The structural rules (which bytes wildcard, which are ignored, what counts as an essence /
// system-item key) live in ul-spec.js — this module only applies them. ul-spec must be loaded
// first (window.UL_SPEC in the browser; require() in Node).
(function (exports) {
  'use strict';

  var spec = (typeof module !== 'undefined' && module.exports)
    ? require('./ul-spec.js')
    : window.UL_SPEC;
  var KIND                 = spec.KIND;
  var classifyUL           = spec.classifyUL;
  var byteMatchRule        = spec.byteMatchRule;
  var ESSENCE_MASKED_BYTES = spec.ESSENCE_MASKED_BYTES;

  function normalizeHex(s) {
    return s
      .replace(/^urn:smpte:ul:/i, '')
      .replace(/\\x/gi, '')
      .replace(/0x/gi, '')
      .replace(/[^0-9a-f]/gi, '')
      .toLowerCase();
  }

  function looksLikeHex(s) {
    const stripped = normalizeHex(s);
    return stripped.length >= 2 && /^[0-9a-f]+$/.test(stripped);
  }

  // Compare a query against an entry UL byte-by-byte, applying the per-byte match policy from
  // ul-spec (literal / 7f-wildcard zone / ignored version byte / ff-wildcard metadata count).
  // The query's classification (essence / system-item / generic) selects which policy applies.
  function matchBytes(searchHex, entryUL, byteCount) {
    const kind = classifyUL(searchHex);
    for (let bytePos = 0; bytePos < byteCount; bytePos++) {
      const i = bytePos * 2;
      const a = searchHex.substring(i, i + 2);
      const b = entryUL.substring(i, i + 2);
      switch (byteMatchRule(kind, bytePos)) {
        case 'ignore':     continue;
        case 'wildcard7f': if (a === '7f' || b === '7f') continue; break;
        case 'wildcardFF': if (a === 'ff' || b === 'ff') continue; break;
        // 'literal' falls through to the equality check
      }
      if (a !== b) return false;
    }
    return true;
  }

  function ulMatchesWithWildcard(searchUL, entryUL) {
    if (searchUL.length !== entryUL.length) return false;
    return matchBytes(searchUL, entryUL, 16);
  }

  // Prefix variant: searchHex may be shorter than a full 32-char UL.
  function ulPrefixMatchWithWildcard(searchHex, entryUL) {
    return matchBytes(searchHex, entryUL, Math.floor(searchHex.length / 2));
  }

  // Essence element wildcard (SMPTE ST 2088): 7f in any byte position after the fixed
  // 4-byte SMPTE prefix is a wildcard. Applies only when matching against Essence register
  // entries, since other registers treat 7f as a literal value in item-designator bytes.
  function ulMatchesEssenceWildcard(searchUL, entryUL) {
    if (searchUL.length !== 32 || entryUL.length !== 32) return false;
    for (let bytePos = 0; bytePos < 16; bytePos++) {
      const i = bytePos * 2;
      const a = searchUL.substring(i, i + 2);
      const b = entryUL.substring(i, i + 2);
      // Bytes 1-8 are literal — bytes 1-4 fixed SMPTE prefix, bytes 5-8 the essence element
      // structural identifier (Dictionaries / Essence dictionaries / structure / version).
      if (bytePos < 8) { if (a !== b) return false; continue; }
      // Essence Element Count (byte 14) and Number (byte 16) are per-track — always masked.
      if (ESSENCE_MASKED_BYTES.indexOf(bytePos) !== -1) continue;
      if (a === '7f' || b === '7f') continue;
      if (a !== b) return false;
    }
    return true;
  }

  exports.normalizeHex              = normalizeHex;
  exports.looksLikeHex              = looksLikeHex;
  exports.ulMatchesWithWildcard     = ulMatchesWithWildcard;
  exports.ulPrefixMatchWithWildcard = ulPrefixMatchWithWildcard;
  exports.ulMatchesEssenceWildcard  = ulMatchesEssenceWildcard;
  // Re-exported from ul-spec so consumers that already receive the UL_MATCH bundle
  // (search-core, the Vercel API) can classify ULs without a second dependency.
  exports.classifyUL                = classifyUL;
  exports.KIND                      = KIND;
})(typeof module !== 'undefined' ? module.exports : (window.UL_MATCH = {}));
