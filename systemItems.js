/**
 * SMPTE System Item UL Definitions
 * Implements SMPTE 326M (System Metadata Pack) and SMPTE 385M (System Item Sets).
 *
 * These ULs represent structured data containers used in MXF files for system metadata.
 * They support multiple encoding variants (fixed-length packs, local sets with different
 * tag/length sizes) and multiple metadata element types (package, picture, sound, data, control).
 *
 * Bytes 1-5 + 8-12 are identical across all entries; we factor them into a shared base
 * and override only the bytes that vary (6, 7, 13-16).
 */

// Bytes 1-5 + 8-12 are identical across every System Item key. Byte 7 (Structure
// Designator) is also 01 across all entries; the description varies slightly between
// the Fixed-Length Pack and Local Set variants and is overridden in each entry.
const COMMON_BYTES = {
  1:  { name: 'Object Identifier',     value: '06', meaning: 'SMPTE UL identifier' },
  2:  { name: 'UL Size',               value: '0E', meaning: '16-octet (14 bytes remaining after OID and size)' },
  3:  { name: 'ISO/ORG Designator',    value: '2B', meaning: 'ISO member organization' },
  4:  { name: 'SMPTE Designator',      value: '34', meaning: 'SMPTE (Society of Motion Picture & Television Engineers)' },
  5:  { name: 'Registry Category',     value: '02', meaning: 'Sets & Packs' },
  8:  { name: 'Version Number',        value: '01', meaning: 'Sets & Packs Registry version 1' },
  9:  { name: 'Item Designator Byte 1', value: '0D', meaning: 'Organisationally Registered (Class 13 Public Use)' },
  10: { name: 'Item Designator Byte 2', value: '01', meaning: 'AAF Association' },
  11: { name: 'Item Designator Byte 3', value: '03', meaning: 'MXF Generic Container Keys' },
  12: { name: 'Item Designator Byte 4', value: '01', meaning: 'MXF-GC version 1' },
};

// Byte 7 description for the fixed-length pack variant (SMPTE 326M).
const FIXED_PACK_STRUCTURE = { name: 'Structure Designator', value: '01', meaning: 'Fixed-Length Pack structure version 1' };
// Byte 7 description for the local-set variants (SMPTE 385M).
const LOCAL_SET_STRUCTURE  = { name: 'Structure Designator', value: '01', meaning: 'Sets & Packs Registry structure version 1' };

// Byte 6 (Registry Designator) variants per SMPTE 336M.
const REG_FIXED_LENGTH_PACK = { name: 'Registry Designator', value: '05', meaning: 'Fixed-Length Pack (non-tagged, non-counted elements)' };
const REG_LOCAL_SET_2_1     = { name: 'Registry Designator', value: '43', meaning: 'Local Set: 2-octet tags, 1-octet length' };
const REG_LOCAL_SET_1_4     = { name: 'Registry Designator', value: '63', meaning: 'Local Set: 1-octet tags, 4-octet length' };

// Bytes 13-14 are identical for all SMPTE 385M Local Set variants.
const LOCAL_SET_TAIL_PREFIX = {
  13: { name: 'Item Type Identifier',      value: '04', meaning: 'CP-compatible System Item' },
  14: { name: 'System Scheme Identifier',  value: '01', meaning: 'SDTI-CP version 1' },
};

function makeLocalSet(regDesignator, metadataType, byte16) {
  return {
    ...COMMON_BYTES,
    6: regDesignator,
    7: LOCAL_SET_STRUCTURE,
    ...LOCAL_SET_TAIL_PREFIX,
    15: { name: 'Metadata Element Type', value: metadataType.value, meaning: metadataType.meaning },
    16: byte16,
  };
}

const BLOCK_COUNT_BYTE     = { name: 'Metadata Block Count', value: '00', meaning: 'Number of metadata blocks in element' };
const BLOCK_COUNT_CTRL     = { name: 'Metadata Block Count', value: '00', meaning: 'Number of metadata blocks in element (typically 0 for control)' };

const SYSTEM_ITEMS = [
  // ========================================================================
  // SMPTE 326M: System Metadata Pack (Fixed-Length Pack encoding)
  // ========================================================================
  {
    ul: '060e2b34.02050101.0d010301.04010100',
    register: 'System Items',
    standard: 'SMPTE 326M-2005',
    name: 'System Metadata Pack',
    symbol: 'SystemMetadataPack',
    description: 'Core system metadata container for MXF files. Fixed-length pack with essential structural metadata (timecode, creation date, package layout).',
    byteDescriptions: {
      ...COMMON_BYTES,
      6: REG_FIXED_LENGTH_PACK,
      7: FIXED_PACK_STRUCTURE,
      13: { name: 'Item Designator Byte 5',  value: '04', meaning: 'CP-compatible System Item (SDTI-CP or equivalent)' },
      14: { name: 'Item Designator Byte 6',  value: '01', meaning: 'SDTI-CP version 1' },
      15: { name: 'Metadata Element Type',   value: '01', meaning: 'System Metadata Pack (core system metadata)' },
      16: { name: 'Reserved',                value: '00', meaning: 'Reserved — must be zero' },
    },
  },

  // ========================================================================
  // SMPTE 385M: System Item Sets (Local Set encodings with metadata variants)
  // ========================================================================
  {
    ul: '060e2b34.02430101.0d010301.040102ff',
    register: 'System Items',
    standard: 'SMPTE 385M-2004',
    name: 'Package Metadata Set',
    symbol: 'PackageMetadataSet',
    description: 'Package-level metadata in local set format (2-octet tags, 1-octet length fields). Contains metadata describing the overall package structure.',
    byteDescriptions: makeLocalSet(REG_LOCAL_SET_2_1, { value: '02', meaning: 'Package Metadata Set' }, BLOCK_COUNT_BYTE),
  },
  {
    ul: '060e2b34.02430101.0d010301.040103ff',
    register: 'System Items',
    standard: 'SMPTE 385M-2004',
    name: 'Picture Metadata Set',
    symbol: 'PictureMetadataSet',
    description: 'Picture/video track metadata in local set format (2-octet tags, 1-octet length fields). Contains video-specific metadata.',
    byteDescriptions: makeLocalSet(REG_LOCAL_SET_2_1, { value: '03', meaning: 'Picture Metadata Set' }, BLOCK_COUNT_BYTE),
  },
  {
    ul: '060e2b34.02430101.0d010301.040104ff',
    register: 'System Items',
    standard: 'SMPTE 385M-2004',
    name: 'Sound Metadata Set',
    symbol: 'SoundMetadataSet',
    description: 'Sound/audio track metadata in local set format (2-octet tags, 1-octet length fields). Contains audio-specific metadata.',
    byteDescriptions: makeLocalSet(REG_LOCAL_SET_2_1, { value: '04', meaning: 'Sound Metadata Set' }, BLOCK_COUNT_BYTE),
  },
  {
    ul: '060e2b34.02430101.0d010301.040105ff',
    register: 'System Items',
    standard: 'SMPTE 385M-2004',
    name: 'Data Metadata Set',
    symbol: 'DataMetadataSet',
    description: 'Data track metadata in local set format (2-octet tags, 1-octet length fields). Contains metadata for data essence tracks.',
    byteDescriptions: makeLocalSet(REG_LOCAL_SET_2_1, { value: '05', meaning: 'Data Metadata Set' }, BLOCK_COUNT_BYTE),
  },
  {
    ul: '060e2b34.02630101.0d010301.040106ff',
    register: 'System Items',
    standard: 'SMPTE 385M-2004',
    name: 'Control Data Set',
    symbol: 'ControlDataSet',
    description: 'Control data container in local set format (1-octet tags, 4-octet length fields). Higher capacity variant for control metadata.',
    byteDescriptions: makeLocalSet(REG_LOCAL_SET_1_4, { value: '06', meaning: 'Control Data Set' }, BLOCK_COUNT_CTRL),
  },
];

// Export for Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SYSTEM_ITEMS;
}

// Export for browser (attach to window if available)
if (typeof window !== 'undefined') {
  window.SMPTE_SYSTEM_ITEMS = SYSTEM_ITEMS;
}
