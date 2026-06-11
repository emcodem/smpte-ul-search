'use strict';

const {
  normalizeHex, looksLikeHex,
  ulMatchesWithWildcard, ulPrefixMatchWithWildcard, ulMatchesEssenceWildcard,
  classifyUL, KIND,
} = require('../ul-match.js');
const { matchEntries }    = require('../src/search-core.js');

const VALID_REGISTERS = new Set(['Labels', 'Types', 'Elements', 'Groups', 'Essence', 'System Items']);
const DEFAULT_LIMIT   = 250;
const MAX_LIMIT       = 1000;

// Module-level warm cache — persists across warm container invocations.
let _cache = null;

function getCache() {
  if (_cache) return _cache;
  const rawEntries  = require('../data.js');
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new Error('data.js must be regenerated with build-data.ps1 (UMD format required)');
  }
  const systemItems = require('../systemItems.js');
  const orgRegistry = require('../orgs.js');
  const { buildAllEntries } = require('../src/entries.js');
  _cache = buildAllEntries(rawEntries, systemItems, normalizeHex, orgRegistry);
  return _cache;
}

const ulMatch = {
  normalizeHex, looksLikeHex,
  ulMatchesWithWildcard, ulPrefixMatchWithWildcard, ulMatchesEssenceWildcard,
  classifyUL, KIND,
};

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const q              = (req.query.q || '').trim();
  const registersParam = req.query.registers;
  const hideDeprecated = req.query.hideDeprecated === 'true' || req.query.hideDeprecated === '1';
  const localTagsOnly  = req.query.localTagsOnly  === 'true' || req.query.localTagsOnly  === '1';
  const limitParam     = parseInt(req.query.limit, 10);
  const limit          = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);

  if (!q) { res.status(400).json({ error: 'Query parameter "q" is required' }); return; }

  const requestedRegs = registersParam
    ? registersParam.split(',').map(r => r.trim()).filter(r => VALID_REGISTERS.has(r))
    : null;
  const enabledRegs = new Set(requestedRegs && requestedRegs.length ? requestedRegs : VALID_REGISTERS);

  let cache;
  try {
    cache = getCache();
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const matches = matchEntries({
    allEntries: cache.allEntries,
    enabledRegs,
    hideDep: hideDeprecated,
    localTagsOnly,
    raw: q,
    ulMatch,
  });

  const results = matches.slice(0, limit).map(({ e, directULMatch, wildcardMatch, essenceWildcardMatch }) => ({
    register:      e.register,
    symbol:        e.symbol        || null,
    ul:            e.ul            || null,
    kind:          e.kind          || null,
    name:          e.name          || null,
    definition:    e.definition    || null,
    defDoc:        e.defDoc        || null,
    namespaceName: e.namespaceName || null,
    isDeprecated:  e.isDeprecated,
    org:           e.org           || null,
    matchType: {
      direct:          directULMatch,
      wildcard:        wildcardMatch,
      essenceWildcard: essenceWildcardMatch,
      text:            !directULMatch && !wildcardMatch && !essenceWildcardMatch,
    },
  }));

  res.status(200).json({ query: q, total: matches.length, showing: results.length, results });
};
