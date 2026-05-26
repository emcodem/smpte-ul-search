// SMPTE UL byte semantics — constants and classifier helpers.
(function () {
  'use strict';

  // Per SMPTE ST 298 / ST 336 (1-indexed byte numbers matching SMPTE documentation)
  const UL_BYTE_INFO = [
    { name: 'Object Identifier',  desc: 'ASN.1 OID prefix (fixed: 06)',                    fixed: true  },
    { name: 'Label Size',         desc: 'Remaining label length (fixed: 0e = 14 bytes)',    fixed: true  },
    { name: 'ISO Prefix',         desc: 'ISO/IEC designation (fixed: 2b)',                  fixed: true  },
    { name: 'SMPTE Designation',  desc: 'SMPTE organization code (fixed: 34)',              fixed: true  },
    { name: 'Category',           desc: 'Registry category designator — 01 = Essence Elements, 02 = Sets/Packs, 04 = Dictionary Items, 7f = any (wildcard)', wildcard: true },
    { name: 'Registry',           desc: 'Registry designator — identifies register type (05, 43, 53 …); must match exactly, 7f = any (wildcard)', wildcard: true },
    { name: 'Structure',          desc: 'Structure designator — must match exactly, 7f = any (wildcard)', wildcard: true },
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

  function isEssenceElementKey(normUL) {
    return normUL.length === 32 &&
      normUL.startsWith('060e2b34') &&
      normUL.substring(8, 10) === '01';
  }

  function isSystemItemKey(normUL) {
    return normUL.length === 32 &&
      normUL.startsWith('060e2b34') &&
      normUL.substring(8, 10) === '02' &&
      normUL.substring(12, 14) === '01' &&
      normUL.substring(16, 24) === '0d010301' &&
      (normUL.substring(24, 26) === '04' || normUL.substring(24, 26) === '14');
  }

  function essenceByteInfo(b, val, normUL, essenceB15Names) {
    const b15Names = essenceB15Names || {};
    switch (b) {
      // Bytes 5-8 (1-indexed): literal fixed identifiers for essence element keys
      case 4: return { name: 'Essence Category',  desc: 'Essence element key identifier — fixed: 01' };
      case 5: return { name: 'Essence Registry',  desc: 'Essence element key register — fixed: 02' };
      case 6: return { name: 'Essence Structure', desc: 'Essence element key structure — fixed: 01' };
      case 7: return { name: 'Essence Version',   desc: 'Essence element key version — fixed: 01' };
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
      case 4:  return { name: 'Registry Category',    desc: 'Sets and Packs (fixed: 02)' };
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
      case 14: return {
        name: 'Metadata/Control Element Identifier',
        desc: val === '01'
          ? 'First metadata element — marks start of content package (SMPTE 379-1-2009 §6.2.1)'
          : `element identifier 0x${val}`,
      };
      case 15: return { name: 'Reserved', desc: 'Reserved for use by Metadata Element' };
      default: return null;
    }
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.byteInfo = {
    UL_BYTE_INFO,
    ESSENCE_ITEM_TYPES,
    SYSTEM_ITEM_TYPES,
    SYSTEM_SCHEME_NAMES,
    isEssenceElementKey,
    isSystemItemKey,
    essenceByteInfo,
    systemItemByteInfo,
  };
})();
