// UL matching utilities — shared between index.html (browser) and tests/run.js (Node.js).
// Loaded as a plain <script> tag in the browser (sets window.UL_MATCH) or via require() in Node.
(function (exports) {
  'use strict';

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

  // Per SMPTE ST 336: byte 5 (bytePos 4) is the Category Designator — wildcarded only on 7f.
  // Byte 6 (bytePos 5) is the Registry Designator — distinct values (05, 43, 53 …) identify
  // fundamentally different register types and must match exactly; wildcarded only on 7f.
  // Byte 7 (bytePos 6) is the Structure Designator — also matched exactly; wildcarded only on 7f.
  // Byte 8 (bytePos 7) is the Version Number — purely a registry revision counter, always skipped.
  // Essence element keys (category byte = 01) use bytes 5-8 as fixed structural identifiers
  // rather than registry designators, so they are excluded from this wildcard zone and matched
  // via ulMatchesEssenceWildcard instead.
  // Bytes 9-15 (bytePos 8-14) are Item Designators — exact match.
  // Byte 16 (bytePos 15) for System Item ULs (SMPTE 326M/385M) uses FF as wildcard for metadata block count.
  function matchBytes(searchHex, entryUL, byteCount) {
    const isEssenceEl = searchHex.substring(8, 10) === '01';
    const isSystemItem =
      searchHex.startsWith('060e2b3402') &&
      searchHex.length >= 28 &&
      searchHex.substring(16, 24) === '0d010301' &&
      searchHex.substring(24, 28) === '0401';
    for (let bytePos = 0; bytePos < byteCount; bytePos++) {
      const i = bytePos * 2;
      const a = searchHex.substring(i, i + 2);
      const b = entryUL.substring(i, i + 2);
      if (!isEssenceEl && bytePos === 7) continue;
      if (!isEssenceEl && (bytePos === 4 || bytePos === 5 || bytePos === 6) && (a === '7f' || b === '7f')) continue;
      if (isSystemItem && bytePos === 15 && (a === 'ff' || b === 'ff')) continue;
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
    for (let i = 0; i < 32; i += 2) {
      const a = searchUL.substring(i, i + 2);
      const b = entryUL.substring(i, i + 2);
      // Bytes 1-8 (i < 16) are literal — bytes 1-4 fixed SMPTE prefix,
      // bytes 5-8 are the fixed 01020101 essence element identifier.
      if (i < 16) { if (a !== b) return false; continue; }
      // Byte 14 (i=26, Essence Element Count) and byte 16 (i=30, Essence Element Number)
      // are per-track values that vary between files — always masked per ST 379-2:2010 §10.1.
      if (i === 26 || i === 30) continue;
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
})(typeof module !== 'undefined' ? module.exports : (window.UL_MATCH = {}));
