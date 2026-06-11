// SMPTE UL structural authority — classification + per-byte match policy.
//
// This is the SINGLE source of truth for "what kind of UL is this?" and "how does
// each byte participate in matching?". Both the matcher (ul-match.js, search-core.js)
// and the renderers (byte-info.js and the render-* modules) derive from it, so the
// rules live in exactly one place as more combined checking is added.
//
// UMD: loaded as a <script> in the browser (sets window.UL_SPEC) and via require() in
// Node (tests, Vercel API). Must load BEFORE ul-match.js and src/byte-info.js.
(function (exports) {
  'use strict';

  // Bytes 1-4 of every SMPTE UL: ASN.1 OID prefix / label size / ISO / SMPTE designation.
  var SMPTE_PREFIX = '060e2b34';

  var KIND = {
    ESSENCE:     'essence-element', // MXF Generic Container essence element key (ST 379-1/2)
    SYSTEM_ITEM: 'system-item',     // System Item metadata element key (SMPTE 379-1 §6.2.1)
    GENERIC:     'generic-smpte',   // any other SMPTE-registered UL
    NON_SMPTE:   'non-smpte',       // does not carry the 06 0e 2b 34 prefix
  };

  function isSmptePrefix(ul) {
    return typeof ul === 'string' && ul.length >= 8 && ul.substring(0, 8) === SMPTE_PREFIX;
  }

  // Essence element key — SMPTE ST 379-1 (Generic Container) / ST 379-2:2010 §10.1:
  //   bytes 1-4  06 0e 2b 34   SMPTE prefix
  //   bytes 5-7  01 02 01      Dictionaries / Essence dictionaries / structure (ST 366M)
  //   byte 8     version       IGNORED — varies by registry revision (both 01 and 05 exist)
  //   bytes 9-12 0d 01 03 01   Generic Container item designator
  //   bytes 13-16              track-number tuple (item type / count / element type / number)
  //
  // The 0d010301 requirement distinguishes a real element key (whose bytes 13-16 form a track
  // number) from other byte-6=02 "Essence dictionaries" labels — e.g. the class-14 0e09… entries,
  // which share 0102 but are NOT element keys. Using bytes 5-7 (not the full 01020101) keeps the
  // version byte out of the test, since version is never part of UL identity.
  function isEssenceElementKey(normUL) {
    return isSmptePrefix(normUL) &&
      normUL.substring(8, 14) === '010201' &&
      (normUL.length < 24 || normUL.substring(16, 24) === '0d010301');
  }

  // System Item metadata element key — SMPTE 379-1 §6.2.1 (also 326M / 385M):
  //   byte 5      02            Groups (sets and packs)
  //   byte 6      registry      variable per ST 336M — NOT pinned (05, 43 … all occur)
  //   byte 7      01            fixed-length pack / set structure
  //   byte 8      version       IGNORED
  //   bytes 9-12  0d 01 03 01
  //   byte 13     04 (CP) | 14 (GC)   item type
  function isSystemItemKey(normUL) {
    return isSmptePrefix(normUL) &&
      normUL.length >= 26 &&
      normUL.substring(8, 10)  === '02' &&
      normUL.substring(12, 14) === '01' &&
      normUL.substring(16, 24) === '0d010301' &&
      (normUL.substring(24, 26) === '04' || normUL.substring(24, 26) === '14');
  }

  function classifyUL(normUL) {
    if (!isSmptePrefix(normUL))       return KIND.NON_SMPTE;
    if (isEssenceElementKey(normUL))  return KIND.ESSENCE;
    if (isSystemItemKey(normUL))      return KIND.SYSTEM_ITEM;
    return KIND.GENERIC;
  }

  // Per-byte match policy for matchBytes() (0-indexed byte position):
  //   'literal'    bytes must be equal
  //   'wildcard7f' 7f on either side matches any value (ST 366M Category/Registry/Structure zone)
  //   'ignore'     never compared (byte 8 Version Number — always ignored per ST 336)
  //   'wildcardFF' ff on either side matches any value (System Item metadata block count, byte 16)
  //
  // Essence element keys treat bytes 5-8 as fixed structural literals; their 7f wildcards in the
  // track-tuple bytes (13-16) are handled separately by ulMatchesEssenceWildcard, not matchBytes.
  function byteMatchRule(kind, bytePos) {
    if (bytePos < 4) return 'literal';                                  // SMPTE prefix
    if (kind === KIND.ESSENCE) return 'literal';                        // structural + literal track bytes
    if (bytePos === 4 || bytePos === 5 || bytePos === 6) return 'wildcard7f';
    if (bytePos === 7) return 'ignore';                                 // Version Number
    if (kind === KIND.SYSTEM_ITEM && bytePos === 15) return 'wildcardFF';
    return 'literal';
  }

  // Essence element key byte positions (0-indexed) ALWAYS masked during wildcard matching:
  // byte 14 (Essence Element Count) and byte 16 (Essence Element Number) are per-track values
  // that vary between files (ST 379-2:2010 §10.1 Table 3).
  var ESSENCE_MASKED_BYTES = [13, 15];

  exports.KIND                 = KIND;
  exports.SMPTE_PREFIX         = SMPTE_PREFIX;
  exports.classifyUL           = classifyUL;
  exports.isEssenceElementKey  = isEssenceElementKey;
  exports.isSystemItemKey      = isSystemItemKey;
  exports.byteMatchRule        = byteMatchRule;
  exports.ESSENCE_MASKED_BYTES = ESSENCE_MASKED_BYTES;
})(typeof module !== 'undefined' ? module.exports : (window.UL_SPEC = {}));
