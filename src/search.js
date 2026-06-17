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
  const { allEntries, ulIndex, essenceB15Names, idleStatus } = built;

  const ctx = {
    allEntries,
    ulIndex,
    essenceB15Names,
    orgRegistry: window.ORG_REGISTRY,
    privateULs:  window.PRIVATE_ULS || {},
  };

  statusEl.textContent = idleStatus;

  const filterCheckboxes = [...document.querySelectorAll('#filters input[type=checkbox][value]')];
  const hideDepCb = document.getElementById('hide-deprecated');
  const localTagsOnlyCb = document.getElementById('local-tags-only');
  let enabledRegs = new Set(filterCheckboxes.filter(cb => cb.checked).map(cb => cb.value));
  let hideDep = hideDepCb.checked;
  let localTagsOnly = localTagsOnlyCb.checked;

  function runSearch() {
    const raw = queryEl.value.trim();

    if (!raw) {
      resultsEl.innerHTML = '';
      moreEl.style.display = 'none';
      statusEl.textContent = idleStatus;
      statusEl.className = '';
      return;
    }

    const normQueryForTags  = normalizeHex(raw);
    const normQuery         = looksLikeHex(raw) ? normQueryForTags : '';
    const queryLower        = raw.toLowerCase();

    const matches = window.SMPTE.searchCore.matchEntries({
      allEntries, enabledRegs, hideDep, localTagsOnly, raw, ulMatch: window.UL_MATCH,
    });

    statusEl.textContent = `${matches.length.toLocaleString()} result${matches.length !== 1 ? 's' : ''}`;
    statusEl.className = '';

    const unregisteredCard = (normQuery.length === 32 && matches.length === 0)
      ? renderUnregisteredUL(normQuery, ctx) : '';

    const isDynamicLocalTag = normQueryForTags.length === 4 && parseInt(normQueryForTags, 16) >= 0x8000;
    const dynamicTagWarning = isDynamicLocalTag
      ? `<div class="warn-banner"><strong>0x${normQueryForTags.toUpperCase()} looks like a dynamic local tag (&ge; 0x8000).</strong> ` +
        `Dynamic local tags are defined per-file in the Primer Pack — check the file&rsquo;s Primer Pack for the matching 16-byte UL.</div>`
      : '';

    const ulIssues = window.SMPTE.byteInfo.validateULQueryBytes(normQuery);
    const ulByteWarning = ulIssues.length
      ? `<div class="warn-banner"><strong>Query contains out-of-spec UL bytes per ${window.SMPTE.links.linkifyDoc('SMPTE ST 366M')}:</strong><ul class="warn-list">${
          ulIssues.map(i => `<li>${i}</li>`).join('')
        }</ul></div>`
      : '';

    const slice = matches.slice(0, MAX_DISPLAY);
    resultsEl.innerHTML = dynamicTagWarning + ulByteWarning + unregisteredCard + slice.map(({ e, directULMatch, wildcardMatch, essenceWildcardMatch }) =>
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
  localTagsOnlyCb.addEventListener('change', () => { localTagsOnly = localTagsOnlyCb.checked; runSearch(); });
})();
