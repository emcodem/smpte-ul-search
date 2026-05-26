// Render a UL as colour-coded, tooltip-bearing byte spans.
(function () {
  'use strict';

  const { escHtml } = window.SMPTE.dom;
  const {
    UL_BYTE_INFO,
    isEssenceElementKey,
    isSystemItemKey,
    essenceByteInfo,
    systemItemByteInfo,
  } = window.SMPTE.byteInfo;

  function renderUL(ul, normQuery, entry, ctx) {
    const prefix = 'urn:smpte:ul:';
    if (!ul.startsWith(prefix)) return escHtml(ul);
    const groups = ul.slice(prefix.length).split('.');
    if (groups.length !== 4 || groups.some(g => g.length !== 8)) return escHtml(ul);

    const normUL = groups.join(''); // 32 hex chars, no separators
    // Essence element keys (ST 2088): byte 5 = 01. In these ULs, 7f is a wildcard in
    // every byte position after the fixed 4-byte SMPTE prefix, not just bytes 5-8.
    const isEssenceEl  = isEssenceElementKey(normUL);
    const isSystemItem = isSystemItemKey(normUL);

    // Find which byte indices the normQuery matches (for bold highlight).
    // For SMPTE prefix queries (starting 060e2b34) mark all bytes the query covers,
    // since wildcard bytes in positions 4-7 mean the substring won't appear literally.
    // For other hex queries fall back to substring search.
    const highlightedBytes = new Set();
    if (normQuery && normQuery.length >= 2) {
      if (normQuery.startsWith('060e2b34')) {
        const byteCount = Math.floor(normQuery.length / 2);
        for (let b = 0; b < byteCount; b++) highlightedBytes.add(b);
      } else {
        let pos = 0;
        while (pos <= normUL.length - normQuery.length) {
          const idx = normUL.indexOf(normQuery, pos);
          if (idx === -1) break;
          const start = Math.floor(idx / 2);
          const end   = Math.ceil((idx + normQuery.length) / 2);
          for (let b = start; b < end; b++) highlightedBytes.add(b);
          pos = idx + 2;
        }
      }
    }

    const org = ctx.orgRegistry[normUL.substring(16, 20)] || null;
    const essenceB15Names = ctx.essenceB15Names;

    let html = `<span class="ul-pfx">${escHtml(prefix)}</span>`;
    for (let b = 0; b < 16; b++) {
      if (b > 0 && b % 4 === 0) html += '<span class="ul-dot">.</span>';
      const byteHex = normUL.substring(b * 2, b * 2 + 2);
      const info    = UL_BYTE_INFO[b];

      // Tooltip: essence elements override bytes 5-8 and 13-16; bytes 9-10 get org enrichment.
      let name = info.name;
      let desc = info.desc;
      const eb = isEssenceEl  ? essenceByteInfo(b, byteHex, normUL, essenceB15Names)
               : isSystemItem ? systemItemByteInfo(b, byteHex, entry)
               : null;
      if (eb) {
        name = eb.name; desc = eb.desc;
      } else if (b === 8) {
        if      (byteHex === '0d') desc = 'Class 13 — Public Use registrations';
        else if (byteHex === '0e') desc = 'Class 14 — Private Use registrations';
      } else if (b === 9 && org) {
        desc = `${org.name} (Class ${org.cls})`;
      }
      // For essence elements, 7f is a wildcard only in bytes 9-16 (not 5-8 which are fixed literals)
      const isAnyEssenceWc = isEssenceEl && b >= 8 && !info.wildcard && byteHex === '7f';
      if (isAnyEssenceWc && b < 12) desc = 'wildcard — any value (ST 2088 essence element)';
      const tooltip = `Byte ${b + 1}: ${name} — ${desc}`;

      // Bytes 5-8 are the standard wildcard zone for non-essence ULs only
      const isActiveWildcard = (!isEssenceEl && info.wildcard && byteHex === '7f') || isAnyEssenceWc;
      const isMatched = highlightedBytes.has(b);
      const isDimmed  = highlightedBytes.size > 0 && !isMatched && !isActiveWildcard;

      let cls;
      if (info.fixed) {
        cls = 'ul-fixed';
      } else if (info.wildcard && !isEssenceEl) {
        cls = isActiveWildcard ? 'ul-wc-active' : 'ul-wc-range';
      } else if (isAnyEssenceWc) {
        cls = 'ul-wc-active';
      } else {
        cls = 'ul-item';
      }
      if (isDimmed) cls += ' ul-dim';

      const content = (isMatched && !isActiveWildcard)
        ? `<strong>${escHtml(byteHex)}</strong>`
        : escHtml(byteHex);

      html += `<span class="${cls}" title="${escHtml(tooltip)}">${content}</span>`;
    }
    return html;
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.renderUL = { renderUL };
})();
