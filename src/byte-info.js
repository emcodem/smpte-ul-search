// SMPTE UL byte semantics — constants and classifier helpers.
(function () {
  'use strict';

  // Per SMPTE ST 298 / ST 336 (1-indexed byte numbers matching SMPTE documentation)
  const UL_BYTE_INFO = [
    { name: 'Object Identifier',  desc: 'ASN.1 OID prefix (fixed: 06)',                    fixed: true  },
    { name: 'Label Size',         desc: 'Remaining label length (fixed: 0e = 14 bytes)',    fixed: true  },
    { name: 'ISO Prefix',         desc: 'ISO/IEC designation (fixed: 2b)',                  fixed: true  },
    { name: 'SMPTE Designation',  desc: 'SMPTE organization code (fixed: 34)',              fixed: true  },
    { name: 'Registry Category Designator', desc: 'Identifies the broad category — 01 Dictionaries, 02 Groups, 03 Wrappers, 04 Labels (SMPTE ST 366M §4)', wildcard: true },
    { name: 'Registry Designator', desc: 'Identifies the register sub-type within the category (SMPTE ST 366M)', wildcard: true },
    { name: 'Structure Designator', desc: 'Identifies the structure variant within the register — valid range: 01–7F (SMPTE ST 366M)', wildcard: true },
    { name: 'Version',            desc: 'Registry version number — always ignored during matching (version-variable)', wildcard: true },
    { name: 'Org Class',          desc: '0d = Class 13 Public Use, 0e = Class 14 Private Use, other = SMPTE standard' },
    { name: 'Org ID',             desc: 'Organization identifier — see SMPTE-RA Class 13/14 registrations' },
    { name: 'Item [11]',          desc: 'Item-specific designator byte 11 — literal'        },
    { name: 'Item [12]',          desc: 'Item-specific designator byte 12 — literal'        },
    { name: 'Item [13]',          desc: 'Item-specific designator byte 13 — literal'        },
    { name: 'Item [14]',          desc: 'Item-specific designator byte 14 — literal'        },
    { name: 'Item [15]',          desc: 'Item-specific designator byte 15 — literal'        },
    { name: 'Item [16]',          desc: 'Item-specific designator byte 16 — literal'        },
  ];


  // SMPTE ST 366M §4: Registry Category Designator values (byte 5)
  const REGISTRY_CATEGORIES = {
    '01': 'Dictionaries',
    '02': 'Groups (sets and packs)',
    '03': 'Wrappers and containers',
    '04': 'Labels',
  };

  // SMPTE ST 366M: Registry Designator sub-types (byte 6) for the categories that enumerate
  // byte 6 as a plain sequential sub-type number. The Groups category (02) is NOT here — its
  // byte 6 is a bit-coded structure descriptor handled by groupsByte6Info() below.
  const REGISTRY_SUBCATEGORIES = {
    '01': { '01': 'Metadata dictionaries', '02': 'Essence dictionaries', '03': 'Control dictionaries', '04': 'Types dictionaries' },
    '03': { '01': 'Simple wrappers', '02': 'Complex wrappers' },
    '04': { '01': 'Labels dictionary' },
  };

  // Maximum valid byte 6 integer value per byte 5 category (ST 366M). Groups (02) is excluded —
  // its byte 6 is not a range but a structure code (see groupsByte6Info).
  const BYTE6_MAX_VALID = { '01': 0x04, '03': 0x02, '04': 0x01 };

  // Byte 6 for the Groups / "Sets and Packs" category (byte 5 = 02) is a SMPTE ST 336 bit-coded
  // STRUCTURE descriptor, not a sequential sub-type. The low nibble selects the group kind; for
  // local sets the high nibble selects the tag/length encoding. These codes are carried in real
  // MXF files — the public register wildcards byte 6 with 7f, so they never appear in the XML.
  // The encoding directly drives a KLV parser's inner read loop (tag/length field widths).
  const GROUP_KINDS = { 1: 'Universal Set', 2: 'Global Set', 3: 'Local Set', 5: 'Fixed-Length Pack', 6: 'Variable-Length Pack' };
  const GROUPS_REGISTRY_DESIGNATORS = {
    '05': 'Fixed-Length Pack (non-tagged, non-counted elements)',
    '06': 'Variable-Length Pack',
    '13': 'Local Set — 2-byte tag, BER long-form length (a property may exceed 65,535 bytes)',
    '43': 'Local Set — 2-byte tag, 1-byte length',
    '53': 'Local Set — 2-byte tag, 2-byte length (standard MXF local set; every property ≤ 65,535 bytes)',
    '63': 'Local Set — 1-byte tag, 4-byte length',
  };
  // Decode a Groups byte-6 structure code. Returns { desc, warning? }. Known codes are described
  // precisely; otherwise the low nibble is read as the group kind; only a low nibble that names
  // no group kind is flagged. Never applies a numeric range check (53h, 13h, etc. are all valid).
  function groupsByte6Info(val) {
    const known = GROUPS_REGISTRY_DESIGNATORS[val];
    if (known) return { desc: known };
    const kind = GROUP_KINDS[parseInt(val.charAt(1), 16)];
    if (kind) return { desc: `${kind} — structure code 0x${val} (SMPTE ST 336)` };
    return { desc: `unrecognized Sets & Packs structure code 0x${val}`, warning: true };
  }

  // Essence element byte semantics — SMPTE ST 379-2:2010 §10.1 Table 3
  // Byte 13 (0-indexed 12): Item Type Identifier
  // Byte 14 (0-indexed 13): Essence Element Count — constant per track, often 7f in register
  // Byte 15 (0-indexed 14): Essence Element Type — codec/format identifier, meaningful
  // Byte 16 (0-indexed 15): Essence Element Number — unique per element within item, often 7f in register
  const ESSENCE_ITEM_TYPES = {
    '05': 'SDTI-CP Picture Item (SMPTE 326M)',
    '06': 'SDTI-CP Sound Item (SMPTE 326M)',
    '07': 'SDTI-CP Data Item (SMPTE 326M)',
    '15': 'GC Picture Item',
    '16': 'GC Sound Item',
    '17': 'GC Data Item',
    '18': 'GC Compound Item',
  };

  // System Item Metadata Element Keys — SMPTE 379-1-2009 §6.2.1 Table 1
  // Byte 5 = 02 (Sets and Packs), bytes 9-12 = 0d010301, byte 13 = 04 (CP) or 14 (GC).
  const SYSTEM_ITEM_TYPES = {
    '04': 'CP-Compatible System Item (SMPTE 326M)',
    '14': 'GC-Compatible System Item',
  };
  const SYSTEM_SCHEME_NAMES = {
    '01': 'CP System Scheme 1 (SMPTE 326M)',
  };
  // System Item byte 15 — Metadata Element Type: which metadata set/pack the key carries
  // (SMPTE 326M System Metadata Pack + SMPTE 385M System Item Sets).
  const METADATA_ELEMENT_TYPES = {
    '01': 'System Metadata Pack (core system metadata)',
    '02': 'Package Metadata Set',
    '03': 'Picture Metadata Set',
    '04': 'Sound Metadata Set',
    '05': 'Data Metadata Set',
    '06': 'Control Data Set',
  };

  // Validate bytes 5, 6, 7 of a SMPTE UL hex string (32 chars, no separators).
  // Returns an array of human-readable issue strings (empty = all valid).
  function validateULQueryBytes(normQ) {
    if (!normQ || !normQ.startsWith('060e2b34') || normQ.length < 10) return [];
    const issues = [];
    const b5 = normQ.substring(8, 10);
    if (b5 !== '7f') {
      const catName = REGISTRY_CATEGORIES[b5];
      if (!catName) {
        issues.push(`Byte 5 (0x${b5.toUpperCase()}) is not a valid Registry Category — must be 01 (Dictionaries), 02 (Groups), 03 (Wrappers), or 04 (Labels) per SMPTE ST 366M.`);
      } else if (normQ.length >= 12) {
        const b6 = normQ.substring(10, 12);
        if (b6 !== '7f') {
          if (b5 === '02') {
            // Groups: byte 6 is a bit-coded structure descriptor (local-set tag/length sizes or
            // pack type), so 53h, 13h, 43h, 63h, 05h, 06h … are all valid. Flag only a low nibble
            // that names no group kind.
            if (groupsByte6Info(b6).warning) {
              issues.push(`Byte 6 (0x${b6.toUpperCase()}) is not a recognized Sets & Packs structure designator per SMPTE ST 336 — the low nibble must select a group kind: 1 Universal Set, 2 Global Set, 3 Local Set, 5 Fixed-Length Pack, 6 Variable-Length Pack.`);
            }
          } else {
            const b6int = parseInt(b6, 16);
            const maxValid = BYTE6_MAX_VALID[b5];
            if (b6int < 0x01 || b6int > maxValid) {
              const maxHex = maxValid.toString(16).padStart(2, '0').toUpperCase();
              issues.push(`Byte 6 (0x${b6.toUpperCase()}) is not a valid Registry Designator for ${catName} — must be 01–${maxHex} per SMPTE ST 366M.`);
            }
          }
        }
      }
    }
    if (normQ.length >= 14) {
      const b7 = normQ.substring(12, 14);
      if (b7 !== '7f') {
        const b7int = parseInt(b7, 16);
        if (b7int < 0x01 || b7int > 0x7f) {
          issues.push(`Byte 7 (0x${b7.toUpperCase()}) is not a valid Structure Designator — must be 01–7F per SMPTE ST 366M.`);
        }
      }
    }
    return issues;
  }

  // Context-aware descriptions for bytes 5, 6, 7 in generic (non-essence, non-system-item) ULs.
  // Returns null for 7f (wildcard — handled by the standard wildcard path) and for other bytes.
  function genericByteInfo(b, val, normUL) {
    switch (b) {
      case 4: { // Byte 5: Registry Category Designator
        if (val === '7f') return null;
        const catName = REGISTRY_CATEGORIES[val];
        if (catName) return { name: 'Registry Category Designator', desc: `${catName} (SMPTE ST 366M §4)` };
        return {
          name: 'Registry Category Designator',
          desc: `Unknown category 0x${val} — valid values per ST 366M: 01 Dictionaries, 02 Groups, 03 Wrappers, 04 Labels`,
          warning: true,
        };
      }
      case 5: { // Byte 6: Registry Designator
        if (val === '7f') return null;
        const b5 = normUL ? normUL.substring(8, 10) : null;
        if (!b5 || !REGISTRY_CATEGORIES[b5]) return { name: 'Registry Designator', desc: `0x${val} — registry sub-type` };
        if (b5 === '02') { // Groups: bit-coded structure descriptor, not a sequential sub-type
          const g = groupsByte6Info(val);
          return { name: 'Registry Designator', desc: g.desc, warning: g.warning };
        }
        const subName = REGISTRY_SUBCATEGORIES[b5] && REGISTRY_SUBCATEGORIES[b5][val];
        const maxValid = BYTE6_MAX_VALID[b5];
        const isOutOfSpec = parseInt(val, 16) < 0x01 || parseInt(val, 16) > maxValid;
        if (subName) return { name: 'Registry Designator', desc: subName };
        return {
          name: 'Registry Designator',
          desc: `0x${val} — unrecognized sub-type for ${REGISTRY_CATEGORIES[b5]} (valid: 01–${maxValid.toString(16).padStart(2, '0').toUpperCase()})`,
          warning: isOutOfSpec,
        };
      }
      case 6: { // Byte 7: Structure Designator — valid range 01–7F per ST 366M
        if (val === '7f') return null;
        const v = parseInt(val, 16);
        const isOutOfSpec = v < 0x01 || v > 0x7f;
        return {
          name: 'Structure Designator',
          desc: `0x${val} — structure designator (valid range per ST 366M: 01–7F)`,
          warning: isOutOfSpec,
        };
      }
      default: return null;
    }
  }

  // UL classification lives in ul-spec.js (the single structural authority, loaded first).
  // These wrappers keep the byteInfo surface stable for the render-* modules; the renderers
  // only decode full 32-char ULs, so we keep the length===32 guard here.
  const isEssenceElementKey = (normUL) => normUL.length === 32 && window.UL_SPEC.isEssenceElementKey(normUL);
  const isSystemItemKey     = (normUL) => normUL.length === 32 && window.UL_SPEC.isSystemItemKey(normUL);

  function essenceByteInfo(b, val, normUL, essenceB15Names) {
    const b15Names = essenceB15Names || {};
    switch (b) {
      // Bytes 5-8 (1-indexed): literal fixed identifiers for essence element keys
      case 4: return { name: 'Registry Category Designator', desc: 'Dictionaries (fixed: 01)' };
      case 5: return { name: 'Registry Designator',          desc: 'Essence element key register (fixed: 02)' };
      case 6: return { name: 'Structure Designator',         desc: 'Essence element key structure (fixed: 01)' };
      case 7: return { name: 'Version Number',               desc: 'Essence element key version (fixed: 01)' };
      // Bytes 13-16 (1-indexed) per ST 379-2:2010 §10.1 Table 3
      case 12: {
        const t = ESSENCE_ITEM_TYPES[val];
        return { name: 'Item Type Identifier', desc: t ? `This element belongs to the ${t} (0x${val})` : `unknown item type (0x${val}) — identifies the Content Package Item this element belongs to` };
      }
      case 13:
        return {
          name: 'Essence Element Count',
          desc: val === '7f'
            ? 'any (wildcard)'
            : `${parseInt(val, 16)} element(s) of this type in the Content Package Item — constant for this track`,
        };
      case 14: {
        if (val === '7f') return { name: 'Essence Element Type', desc: 'any (wildcard)' };
        const k15wc = normUL ? normUL.substring(24, 26) + '7f' + val : null;
        const k15   = normUL ? normUL.substring(24, 30) : null;
        const n = k15wc && (b15Names[k15wc] || (k15 && b15Names[k15]));
        return { name: 'Essence Element Type', desc: n || `codec/format identifier 0x${val} — defined in SMPTE 331M or GC mapping document` };
      }
      case 15:
        return {
          name: 'Essence Element Number',
          desc: val === '7f'
            ? 'any (wildcard)'
            : `element number ${parseInt(val, 16)} within this Item — unique, set by encoder (ST 379-2:2010 §10.3)`,
        };
      default: return null;
    }
  }

  function systemItemByteInfo(b, val, entry) {
    // If entry has detailed byteDescriptions from SMPTE 326M/385M, use those
    if (entry && entry.byteDescriptions && entry.byteDescriptions[b + 1]) {
      const bd = entry.byteDescriptions[b + 1];
      return { name: bd.name, desc: `${bd.value.toUpperCase()} — ${bd.meaning}` };
    }
    // Fall back to generic System Item descriptions
    switch (b) {
      case 4:  return { name: 'Registry Category Designator', desc: 'Groups (fixed: 02)' };
      case 5:  return { name: 'Registry Designator',  desc: 'Per SMPTE 336M — variable; register entries use 7f to match any version' };
      case 6:  return { name: 'Structure Designator', desc: 'Fixed-length Pack, Variable-length Pack or Local Set (fixed: 01)' };
      case 7:  return { name: 'Version Number',       desc: 'Registry version at point of registration — variable' };
      case 8:  return { name: 'Registry',             desc: 'Sets and Packs Registry — Class 13 Public Use (0d)' };
      case 9:  return { name: 'Organization',         desc: 'AAF Association (01)' };
      case 10: return { name: 'Application',          desc: 'AAF Association Application (03)' };
      case 11: return { name: 'Structure Version',    desc: 'MXF Generic Container Keys structure version (01)' };
      case 12: {
        const t = SYSTEM_ITEM_TYPES[val];
        return { name: 'Item Type', desc: t || `unknown item type (0x${val})` };
      }
      case 13: {
        const s = SYSTEM_SCHEME_NAMES[val];
        return { name: 'System Scheme Identifier', desc: s || `scheme 0x${val} — see associated SMPTE document` };
      }
      case 14: {
        const t = METADATA_ELEMENT_TYPES[val];
        return { name: 'Metadata Element Type', desc: t ? `${t} (0x${val})` : `metadata element type 0x${val} — see SMPTE 326M / 385M` };
      }
      case 15: return {
        name: 'Metadata Block Count',
        desc: val === 'ff'
          ? 'any (wildcard) — ff matches any block count'
          : `${parseInt(val, 16)} metadata block(s) in this element`,
      };
      default: return null;
    }
  }

  window.SMPTE = window.SMPTE || {};
  // Public surface consumed by the render-* modules. The per-byte value maps
  // (ESSENCE_ITEM_TYPES, SYSTEM_ITEM_TYPES, SYSTEM_SCHEME_NAMES, METADATA_ELEMENT_TYPES)
  // are intentionally NOT exported — callers go through the *ByteInfo helpers so byte
  // semantics live in exactly one place.
  window.SMPTE.byteInfo = {
    UL_BYTE_INFO,
    isEssenceElementKey,
    isSystemItemKey,
    essenceByteInfo,
    systemItemByteInfo,
    genericByteInfo,
    validateULQueryBytes,
  };
})();
