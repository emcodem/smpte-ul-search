// Build the unified entry list from window.SMPTE_ENTRIES + window.SMPTE_SYSTEM_ITEMS.
// Also builds a UL→entry index (for fast record-name lookup) and essence wildcard maps.
(function () {
  'use strict';

  function normUlForLookup(ul) {
    // For System Items the source UL is dotted (e.g. "060e2b34.02050101...."); normalise.
    return (ul || '').replace(/\./g, '').toLowerCase();
  }

  function orgForNormUL(normUL, orgRegistry) {
    return normUL.length >= 20 ? (orgRegistry[normUL.substring(16, 20)] || null) : null;
  }

  function normalizeRegisterEntry(e, normalizeHex, orgRegistry) {
    const normUL = normalizeHex(e.ul || '');
    return {
      register:      e.register,
      symbol:        e.symbol        || '',
      ul:            e.ul            || '',
      kind:          e.kind          || '',
      name:          e.name          || '',
      definition:    e.definition    || '',
      defDoc:        e.defDoc        || '',
      namespaceName: e.namespaceName || '',
      isConcrete:    e.isConcrete    || '',
      klvSyntax:     e.klvSyntax     || '',
      isDeprecated:  !!e.deprecated,
      records:       e.records       || [],
      localTags:     e.localTags     || [],
      reverseRefs:   e.reverseRefs   || [],
      normUL,
      org:           orgForNormUL(normUL, orgRegistry),
      fullLower:     (e.text || '').toLowerCase(),
      nameLower:     (e.name       || '').toLowerCase(),
      symbolLower:   (e.symbol     || '').toLowerCase(),
      ulLower:       (e.ul         || '').toLowerCase(),
      defLower:      (e.definition || '').toLowerCase(),
    };
  }

  function normalizeSystemItem(e, orgRegistry) {
    const normUL = normUlForLookup(e.ul);
    const urnUL  = `urn:smpte:ul:${e.ul.slice(0, 8)}.${e.ul.slice(9, 17)}.${e.ul.slice(18, 26)}.${e.ul.slice(27)}`;
    return {
      register:      e.register,
      symbol:        e.symbol        || '',
      ul:            urnUL,
      kind:          'SystemItem',
      name:          e.name          || '',
      definition:    e.description   || '',
      defDoc:        e.standard      || '',
      namespaceName: '',
      isConcrete:    true,
      klvSyntax:     '',
      isDeprecated:  false,
      records:       [],
      localTags:     [],
      reverseRefs:   [],
      byteDescriptions: e.byteDescriptions || {},
      normUL,
      org:           orgForNormUL(normUL, orgRegistry),
      fullLower:     (e.description || '').toLowerCase(),
      nameLower:     (e.name       || '').toLowerCase(),
      symbolLower:   (e.symbol     || '').toLowerCase(),
      ulLower:       urnUL.toLowerCase(),
      defLower:      (e.description || '').toLowerCase(),
    };
  }

  function buildAllEntries(rawEntries, systemItems, normalizeHex, orgRegistry) {
    const allEntries = [
      ...rawEntries.map(e => normalizeRegisterEntry(e, normalizeHex, orgRegistry)),
      ...(systemItems || []).map(e => normalizeSystemItem(e, orgRegistry)),
    ];

    // UL → entry index (fast lookup for record-name resolution in renderDetails).
    const ulIndex = new Map();
    for (const e of allEntries) {
      if (e.ul) ulIndex.set(e.ul, e);
    }

    // Essence element lookup maps derived from LEAF register entries.
    // ESSENCE_B14_NAMES keyed by bytes 13–14 (4 hex chars): element type / codec description.
    // ESSENCE_B15_NAMES keyed by bytes 13–15 (6 hex chars): wrapping qualifier description.
    // First LEAF match wins; used by essenceByteInfo() at render time.
    const essenceB14Names = Object.create(null);
    const essenceB15Names = Object.create(null);
    for (const e of allEntries) {
      if (e.register !== 'Essence' || e.normUL.length !== 32 || e.kind !== 'LEAF') continue;
      const k14 = e.normUL.substring(24, 28);
      const k15 = e.normUL.substring(24, 30);
      if (!essenceB14Names[k14]) essenceB14Names[k14] = e.name;
      if (!essenceB15Names[k15]) essenceB15Names[k15] = e.name;
    }

    const registers = [...new Set(allEntries.map(e => e.register))];
    const idleStatus = `${allEntries.length.toLocaleString()} entries across ${registers.length} registers. Type to search.`;

    return { allEntries, ulIndex, essenceB14Names, essenceB15Names, registers, idleStatus };
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.entries = { buildAllEntries, orgForNormUL };
})();
