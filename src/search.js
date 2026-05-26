// Search orchestration: builds the entry list, wires DOM events, renders results.
// Entry point — loaded last in index.html.
(function () {
  'use strict';

  const MAX_DISPLAY = 250;

  const statusEl  = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const moreEl    = document.getElementById('more-note');
  const queryEl   = document.getElementById('query');

  if (!window.SMPTE_ENTRIES) {
    statusEl.className = 'error';
    statusEl.textContent = 'data.js not found. Run build-data.ps1 first to generate it.';
    throw new Error('SMPTE_ENTRIES not defined');
  }

  if (typeof window.SMPTE_SYSTEM_ITEMS === 'undefined') {
    console.warn('systemItems.js not loaded; System Items will not be available');
    window.SMPTE_SYSTEM_ITEMS = [];
  } else {
    console.log('✓ System Items loaded:', window.SMPTE_SYSTEM_ITEMS.length, 'entries');
  }

  const { normalizeHex, looksLikeHex, ulMatchesWithWildcard, ulPrefixMatchWithWildcard, ulMatchesEssenceWildcard } = window.UL_MATCH;
  const { buildAllEntries } = window.SMPTE.entries;
  const { renderCard } = window.SMPTE.renderCard;
  const { renderUnregisteredUL } = window.SMPTE.renderUnregistered;

  const built = buildAllEntries(window.SMPTE_ENTRIES, window.SMPTE_SYSTEM_ITEMS, normalizeHex, window.ORG_REGISTRY);
  const { allEntries, ulIndex, essenceB14Names, essenceB15Names, idleStatus } = built;

  const ctx = {
    allEntries,
    ulIndex,
    essenceB14Names,
    essenceB15Names,
    orgRegistry: window.ORG_REGISTRY,
    privateULs:  window.PRIVATE_ULS || {},
  };

  statusEl.textContent = idleStatus;

  const filterCheckboxes = [...document.querySelectorAll('#filters input[type=checkbox][value]')];
  const hideDepCb = document.getElementById('hide-deprecated');
  let enabledRegs = new Set(filterCheckboxes.filter(cb => cb.checked).map(cb => cb.value));
  let hideDep = hideDepCb.checked;

  function runSearch() {
    const raw = queryEl.value.trim();

    if (!raw) {
      resultsEl.innerHTML = '';
      moreEl.style.display = 'none';
      statusEl.textContent = idleStatus;
      statusEl.className = '';
      return;
    }

    const queryLower = raw.toLowerCase();
    const normQuery  = looksLikeHex(raw) ? normalizeHex(raw) : '';
    // Apply wildcard matching for any query that begins with the SMPTE OID prefix,
    // since bytes 5-8 (registry designators) may be 7f in stored entries.
    const doWildcard = normQuery.startsWith('060e2b34');

    const matches = [];
    for (const e of allEntries) {
      if (!enabledRegs.has(e.register)) continue;
      if (hideDep && e.isDeprecated)    continue;

      let directULMatch = false;
      let wildcardMatch = false;
      let essenceWildcardMatch = false;
      if (normQuery) {
        directULMatch = e.normUL.includes(normQuery);
        if (!directULMatch && doWildcard) {
          const matchFn = normQuery.length < 32 ? ulPrefixMatchWithWildcard : ulMatchesWithWildcard;
          wildcardMatch = matchFn(normQuery, e.normUL);
          // For full essence element keys, 7f in item-designator bytes is also a wildcard (ST 2088)
          if (!wildcardMatch && normQuery.length === 32 && normQuery.substring(8, 10) === '01' &&
              e.register === 'Essence') {
            essenceWildcardMatch = ulMatchesEssenceWildcard(normQuery, e.normUL);
          }
        }
      }
      const orgMatch = e.org && e.org.name.toLowerCase().includes(queryLower);
      if (directULMatch || wildcardMatch || essenceWildcardMatch || orgMatch || e.fullLower.includes(queryLower)) {
        matches.push({ e, directULMatch, wildcardMatch, essenceWildcardMatch });
      }
    }

    statusEl.textContent = `${matches.length.toLocaleString()} result${matches.length !== 1 ? 's' : ''}`;
    statusEl.className = '';

    const unregisteredCard = (normQuery.length === 32 && matches.length === 0)
      ? renderUnregisteredUL(normQuery, ctx) : '';

    const slice = matches.slice(0, MAX_DISPLAY);
    resultsEl.innerHTML = unregisteredCard + slice.map(({ e, directULMatch, wildcardMatch, essenceWildcardMatch }) =>
      renderCard(e, raw, normQuery, queryLower, directULMatch, wildcardMatch, essenceWildcardMatch, ctx)
    ).join('\n');

    moreEl.style.display = matches.length > MAX_DISPLAY ? '' : 'none';
    if (matches.length > MAX_DISPLAY) {
      moreEl.textContent = `Showing first ${MAX_DISPLAY} of ${matches.length.toLocaleString()} results — refine your query to narrow down.`;
    }
  }

  let debounce;
  queryEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(runSearch, 180);
  });
  filterCheckboxes.forEach(el => el.addEventListener('change', () => {
    enabledRegs = new Set(filterCheckboxes.filter(cb => cb.checked).map(cb => cb.value));
    runSearch();
  }));
  hideDepCb.addEventListener('change', () => { hideDep = hideDepCb.checked; runSearch(); });
})();
