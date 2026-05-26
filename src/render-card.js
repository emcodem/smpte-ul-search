// Render a single search result card (title, badges, hints, definition, details).
(function () {
  'use strict';

  const { escHtml, hl } = window.SMPTE.dom;
  const { renderUL } = window.SMPTE.renderUL;
  const { renderDetails } = window.SMPTE.renderDetails;

  function getMatchHints(e, queryLower) {
    const hints = [];
    if (e.nameLower.includes(queryLower))   hints.push('name');
    if (e.symbolLower.includes(queryLower)) hints.push('symbol');
    if (e.defLower.includes(queryLower))    hints.push('definition');
    if (e.org && e.org.name.toLowerCase().includes(queryLower)) hints.push(`Organization: ${e.org.name}`);

    const matchingTags = e.localTags.filter(t => t.toLowerCase().includes(queryLower));
    if (matchingTags.length) hints.push(`LocalTag: ${matchingTags.join(', ')}`);

    const matchingRefs = e.reverseRefs.filter(r =>
      r.localTag.toLowerCase().includes(queryLower) ||
      r.parentName.toLowerCase().includes(queryLower)
    );
    if (matchingRefs.length) {
      hints.push(`Referenced by: ${matchingRefs.map(r => `${r.localTag} in ${r.parentName}`).join('; ')}`);
    }
    return hints;
  }

  function renderCard(e, rawQuery, normQuery, queryLower, directULMatch, wildcardMatch, essenceWildcardMatch, ctx) {
    const dep = e.isDeprecated ? ' deprecated' : '';
    const isPrefixMatch = (directULMatch || wildcardMatch) && normQuery.length > 0 && normQuery.length < 32;
    const hints = getMatchHints(e, queryLower);
    const hintsHtml = hints.length
      ? `<div class="card-hints">${hints.map(h => `<span class="hint">${escHtml(h)}</span>`).join('')}</div>`
      : '';
    return `<div class="result-card${dep}">
  <div class="card-top">
    <span class="card-name">${hl(e.name, rawQuery)}</span>
    <span class="card-ul">${renderUL(e.ul, normQuery, e, ctx)}</span>
  </div>
  <div class="card-meta">
    <span class="badge b-reg">${escHtml(e.register)}</span>
    ${e.register === 'System Items' ? `<span class="badge b-src-app" title="Not in the SMPTE XML registers — this entry is defined by this application based on SMPTE prose standards (SMPTE 326M / SMPTE 385M). The official SMPTE online registers do not publish these system item keys.">App-defined</span>` : ''}
    ${e.kind ? `<span class="badge b-kind">${escHtml(e.kind)}</span>` : ''}
    ${e.isDeprecated ? '<span class="badge b-dep">Deprecated</span>' : ''}
    ${directULMatch ? `<span class="badge b-ul-direct" title="The query bytes match this UL exactly (literal substring match).">UL direct</span>` : ''}
    ${wildcardMatch ? `<span class="badge b-ul-wc" title="Matched via wildcard/version-insensitive logic — byte 8 (Version Number) is always ignored; bytes 5–7 (Category/Registry/Structure) with value 7f match any value; for System Item keys, byte 16 (Metadata Block Count) with value ff matches any count.">UL wildcard</span>` : ''}
    ${essenceWildcardMatch ? `<span class="badge b-ul-ewc" title="Matched via ST 379-2:2010 essence element key — byte 13 (Item Type) and byte 15 (Essence Element Type) must agree; byte 14 (Essence Element Count) and byte 16 (Essence Element Number) are per-track values and always masked.">Essence wildcard</span>` : ''}
    ${isPrefixMatch ? `<span class="badge b-ul-prefix" title="Your query is ${normQuery.length / 2} of 16 bytes — this entry matched on the leading bytes only. Remaining bytes (shown greyed in the UL above) were not part of the query. Add more bytes to narrow to a unique entry.">UL prefix</span>` : ''}
    ${e.symbol ? `<span class="card-symbol">${hl(e.symbol, rawQuery)}</span>` : ''}
    ${e.defDoc  ? `<span class="card-doc">${hl(e.defDoc, rawQuery)}</span>` : ''}
  </div>
  ${hintsHtml}
  ${e.definition ? `<div class="card-def">${hl(e.definition, rawQuery)}</div>` : ''}
  ${renderDetails(e, normQuery, ctx)}
</div>`;
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.renderCard = { renderCard, getMatchHints };
})();
