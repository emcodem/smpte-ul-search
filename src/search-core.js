// Pure entry-matching logic — no DOM access.
// Used by both the browser (window.SMPTE.searchCore) and the Vercel API (require).
(function (f) {
  if (typeof module !== 'undefined' && module.exports) module.exports = f();
  else { window.SMPTE = window.SMPTE || {}; window.SMPTE.searchCore = f(); }
})(function () {
  'use strict';

  /**
   * Match allEntries against a raw query string.
   *
   * @param {object} p
   * @param {Array}   p.allEntries    - from buildAllEntries()
   * @param {Set}     p.enabledRegs   - Set of register name strings
   * @param {boolean} p.hideDep       - skip deprecated entries
   * @param {boolean} p.localTagsOnly - restrict to localTag / reverseRef matches
   * @param {string}  p.raw           - raw query (as typed)
   * @param {object}  p.ulMatch       - { normalizeHex, looksLikeHex,
   *                                     ulMatchesWithWildcard,
   *                                     ulPrefixMatchWithWildcard,
   *                                     ulMatchesEssenceWildcard }
   * @returns {Array<{e, directULMatch, wildcardMatch, essenceWildcardMatch}>}
   */
  function matchEntries(p) {
    var allEntries    = p.allEntries;
    var enabledRegs   = p.enabledRegs;
    var hideDep       = p.hideDep;
    var localTagsOnly = p.localTagsOnly;
    var raw           = p.raw;
    var normalizeHex              = p.ulMatch.normalizeHex;
    var looksLikeHex              = p.ulMatch.looksLikeHex;
    var ulMatchesWithWildcard     = p.ulMatch.ulMatchesWithWildcard;
    var ulPrefixMatchWithWildcard = p.ulMatch.ulPrefixMatchWithWildcard;
    var ulMatchesEssenceWildcard  = p.ulMatch.ulMatchesEssenceWildcard;
    var classifyUL                = p.ulMatch.classifyUL;
    var KIND                      = p.ulMatch.KIND;

    var queryLower       = raw.toLowerCase();
    var normQueryForTags = normalizeHex(raw);
    var normQuery        = looksLikeHex(raw) ? normQueryForTags : '';
    var doWildcard       = normQuery.startsWith('060e2b34');

    var matches = [];
    for (var i = 0; i < allEntries.length; i++) {
      var e = allEntries[i];
      if (!enabledRegs.has(e.register)) continue;
      if (hideDep && e.isDeprecated)    continue;

      var directULMatch        = false;
      var wildcardMatch        = false;
      var essenceWildcardMatch = false;

      if (normQuery) {
        directULMatch = e.normUL.includes(normQuery);
        if (!directULMatch && doWildcard) {
          var matchFn = normQuery.length < 32 ? ulPrefixMatchWithWildcard : ulMatchesWithWildcard;
          wildcardMatch = matchFn(normQuery, e.normUL);
          if (!wildcardMatch && normQuery.length === 32
              && classifyUL(normQuery) === KIND.ESSENCE && e.register === 'Essence') {
            essenceWildcardMatch = ulMatchesEssenceWildcard(normQuery, e.normUL);
          }
        }
      }

      var isMatch = localTagsOnly
        ? e.localTags.some(function (t) {
            return normalizeHex(t).includes(normQueryForTags) || t.toLowerCase().includes(queryLower);
          }) ||
          e.reverseRefs.some(function (r) {
            return normalizeHex(r.localTag).includes(normQueryForTags) || r.localTag.toLowerCase().includes(queryLower);
          })
        : (directULMatch || wildcardMatch || essenceWildcardMatch ||
           (e.org && e.org.name.toLowerCase().includes(queryLower)) ||
           e.fullLower.includes(queryLower));

      if (isMatch) matches.push({ e: e, directULMatch: directULMatch, wildcardMatch: wildcardMatch, essenceWildcardMatch: essenceWildcardMatch });
    }
    return matches;
  }

  return { matchEntries: matchEntries };
});
