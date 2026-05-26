// Render the special card for ULs that aren't in the SMPTE registers.
// Decodes System Item keys, Essence Element keys, and known Class-14 private definitions.
(function () {
  'use strict';

  const { escHtml } = window.SMPTE.dom;
  const {
    UL_BYTE_INFO,
    SYSTEM_ITEM_TYPES,
    SYSTEM_SCHEME_NAMES,
    isEssenceElementKey,
    isSystemItemKey,
    essenceByteInfo,
    systemItemByteInfo,
  } = window.SMPTE.byteInfo;
  const { renderUL } = window.SMPTE.renderUL;
  const { renderOrgSection } = window.SMPTE.renderDetails;

  function renderPrivateSection(privateEntry) {
    if (!privateEntry) return '';
    return `<div class="details-section">
      <h4>Known Private UL Definition</h4>
      <table class="details-table"><tbody>
        <tr><th>Name</th><td><strong>${escHtml(privateEntry.name)}</strong></td></tr>
        <tr><th>Category</th><td>${escHtml(privateEntry.category)}</td></tr>
        ${privateEntry.sources ? `<tr><th>Sources</th><td><ul class="private-sources">${privateEntry.sources.map(s => `<li>${escHtml(s)}</li>`).join('')}</ul></td></tr>` : ''}
      </tbody></table>
    </div>`;
  }

  function renderSystemItemSection(normUL) {
    if (!isSystemItemKey(normUL)) return '';
    const itemTypeByte = normUL.substring(24, 26);
    const schemeByte   = normUL.substring(26, 28);
    const elemByte     = normUL.substring(28, 30);
    const resvByte     = normUL.substring(30, 32);
    const itemTypeName = SYSTEM_ITEM_TYPES[itemTypeByte] || `unknown (0x${itemTypeByte})`;
    const schemeName   = SYSTEM_SCHEME_NAMES[schemeByte]  || `unknown scheme (0x${schemeByte}) — see associated SMPTE document`;
    const elemDesc     = elemByte === '01'
      ? 'First metadata element — marks start of content package (SMPTE 379-1-2009 §6.2.1)'
      : `element identifier 0x${elemByte}`;
    return `<div class="details-section">
      <h4>System Item Metadata Element Key — SMPTE 379-1-2009</h4>
      <p class="section-prose">Defined in SMPTE 379-1-2009 §6.2.1 Table 1. Bytes 6 and 8 (Registry Designator / Version Number) are variable per SMPTE 336M — register entries use 7f as a wildcard in those positions, so these keys are not present verbatim in the public register XML.</p>
      <table class="details-table"><tbody>
        <tr><th>Item Type (byte 13)</th><td class="mono">${escHtml(itemTypeByte)}</td><td>${escHtml(itemTypeName)}</td></tr>
        <tr><th>System Scheme (byte 14)</th><td class="mono">${escHtml(schemeByte)}</td><td>${escHtml(schemeName)}</td></tr>
        <tr><th>Element Identifier (byte 15)</th><td class="mono">${escHtml(elemByte)}</td><td>${escHtml(elemDesc)}</td></tr>
        <tr><th>Reserved (byte 16)</th><td class="mono">${escHtml(resvByte)}</td><td>Reserved for use by Metadata Element</td></tr>
      </tbody></table>
    </div>`;
  }

  function renderEssenceElementSection(normUL, ctx) {
    if (!isEssenceElementKey(normUL)) return '';
    const { allEntries, essenceB15Names } = ctx;
    const { ulMatchesEssenceWildcard } = window.UL_MATCH;

    // Look up the item-type NODE: bytes 1–13 match, bytes 14–16 are zeroed in NODE entries.
    const itemTypeKey = normUL.substring(0, 26) + '000000';
    const itemTypeEntry = allEntries.find(e => e.register === 'Essence' && e.normUL === itemTypeKey);

    // Find LEAF entries that match with 7f-wildcard in item-designator bytes.
    const leafMatches = allEntries.filter(e =>
      e.register === 'Essence' && e.kind === 'LEAF' &&
      ulMatchesEssenceWildcard(normUL, e.normUL)
    );

    const itemTypeName  = itemTypeEntry ? itemTypeEntry.name : `unknown (0x${normUL.substring(24, 26)})`;
    const elemCountByte = normUL.substring(26, 28);  // byte 14: Essence Element Count
    const elemTypeByte  = normUL.substring(28, 30);  // byte 15: Essence Element Type
    const elemNumByte   = normUL.substring(30, 32);  // byte 16: Essence Element Number

    // Codec/format name: look up by (item_type, wildcard_count, elem_type) — byte 14 is count, not type.
    const elemTypeKey   = normUL.substring(24, 26) + '7f' + elemTypeByte;
    const elemTypeName  = essenceB15Names[elemTypeKey] ||
                          essenceB15Names[normUL.substring(24, 30)] ||
                          `codec/format identifier 0x${elemTypeByte} — defined in SMPTE 331M or GC mapping document`;

    const elemCountDesc = elemCountByte === '7f'
      ? 'any (wildcard)'
      : `${parseInt(elemCountByte, 16)} element(s) of this type in the Content Package Item — constant for this track`;
    const elemNumDesc   = elemNumByte === '7f'
      ? 'any (wildcard)'
      : `element number ${parseInt(elemNumByte, 16)} within this Item — unique, set by encoder`;

    // MXF Track Number: bytes 13–16 as UInt32 A.B.C.D (ST 379-2:2010 §10.3)
    const trackNum = [normUL.substring(24,26), normUL.substring(26,28), normUL.substring(28,30), normUL.substring(30,32)]
      .map(h => parseInt(h, 16)).join('.');

    const leafRows = leafMatches.map(e => `<tr>
      <td>${escHtml(e.name)}</td>
      <td class="mono">${escHtml(e.normUL.substring(24))}</td>
      <td>${escHtml(e.symbol)}</td>
      <td>${escHtml(e.defDoc)}</td>
    </tr>`).join('');

    const matchTable = leafMatches.length
      ? `<table class="details-table match-table-heading">
          <thead><tr><th>Name</th><th>Registered bytes 13–16</th><th>Symbol</th><th>Document</th></tr></thead>
          <tbody>${leafRows}</tbody>
        </table>`
      : `<p class="no-match-note">No entries found in the Essence register for element type <code>${normUL.substring(24, 26)}xx${elemTypeByte}xx</code>.</p>`;

    return `<div class="details-section">
      <h4>Essence Element Key — SMPTE ST 379-2:2010</h4>
      <p class="section-prose">Defined in SMPTE ST 379-2:2010 §10.1 Table 3. Byte 13 identifies the Content Package Item this element belongs to; byte 14 is the element count (constant per track); byte 15 is the element type (codec/format identifier); byte 16 is the element number (unique within item). Bytes 13–16 together form the MXF track number linking to Header Metadata (§10.3).</p>
      <table class="details-table"><tbody>
        <tr><th>Item Type Identifier (byte 13)</th><td class="mono">${escHtml(normUL.substring(24, 26))}</td><td>This element belongs to the ${escHtml(itemTypeName)}</td></tr>
        <tr><th>Essence Element Count (byte 14)</th><td class="mono">${escHtml(elemCountByte)}</td><td>${escHtml(elemCountDesc)}</td></tr>
        <tr><th>Essence Element Type (byte 15)</th><td class="mono">${escHtml(elemTypeByte)}</td><td>${escHtml(elemTypeName)}</td></tr>
        <tr><th>Essence Element Number (byte 16)</th><td class="mono">${escHtml(elemNumByte)}</td><td>${escHtml(elemNumDesc)}</td></tr>
        <tr><th>MXF Track Number (A.B.C.D)</th><td class="mono">${escHtml(trackNum)}</td><td>UInt32 big-endian — links this Essence Element to its Header Metadata track (ST 379-2:2010 §10.3)</td></tr>
      </tbody></table>
      <h4 class="match-table-heading">Matching Register Entries (Essence Element Count and Number as wildcards)</h4>
      ${matchTable}
    </div>`;
  }

  function renderUnregisteredULByteTable(normUL, isEssenceElement, isSystemItemUL, ctx) {
    const essenceB15Names = ctx.essenceB15Names;
    const rows = UL_BYTE_INFO.map((info, b) => {
      const val = normUL.substring(b * 2, b * 2 + 2);
      const eb  = isEssenceElement ? essenceByteInfo(b, val, normUL, essenceB15Names)
                : isSystemItemUL   ? systemItemByteInfo(b, val)
                : null;
      const rowName = eb ? eb.name : info.name;
      const rowDesc = eb ? eb.desc : info.desc;
      const isAnyEssenceWc = isEssenceElement && b >= 8 && !info.wildcard && val === '7f';
      const isActiveWildcard = (!isEssenceElement && info.wildcard && val === '7f') || isAnyEssenceWc;
      const rowCls = info.fixed ? 'byte-fixed'
                   : (info.wildcard && !isEssenceElement) ? (isActiveWildcard ? 'byte-wc-active' : 'byte-wc')
                   : isAnyEssenceWc ? 'byte-wc-active'
                   : 'byte-item';
      const note = (!eb && isAnyEssenceWc)
        ? ' <em>— wildcard, any value (ST 2088 essence element)</em>'
        : (!eb && !isEssenceElement && isActiveWildcard) ? ' <em>— wildcard, matches any value</em>' : '';
      return `<tr class="${rowCls}">
          <td class="mono">${b + 1}</td>
          <td class="mono">${escHtml(val)}</td>
          <td>${escHtml(rowName)}</td>
          <td>${escHtml(rowDesc)}${note}</td>
        </tr>`;
    }).join('');
    return `<div class="details-section">
      <h4>UL Structure — SMPTE ST 336 (bytes 1–16)</h4>
      <table class="details-table">
        <thead><tr><th>#</th><th>Value</th><th>Field</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  function renderUnregisteredUL(normUL, ctx) {
    const ulStr = `urn:smpte:ul:${normUL.slice(0,8)}.${normUL.slice(8,16)}.${normUL.slice(16,24)}.${normUL.slice(24,32)}`;
    const org = ctx.orgRegistry[normUL.substring(16, 20)] || null;
    const privateEntry = (ctx.privateULs && ctx.privateULs[normUL]) || null;

    const orgSection      = renderOrgSection(org, normUL);
    const privateSection  = renderPrivateSection(privateEntry);
    const systemItemSection = renderSystemItemSection(normUL);
    const essenceSection  = renderEssenceElementSection(normUL, ctx);

    const isEssenceElement = essenceSection !== '';
    const isSystemItemUL   = systemItemSection !== '';
    const ulSection        = renderUnregisteredULByteTable(normUL, isEssenceElement, isSystemItemUL, ctx);

    const orgNote = org
      ? ` It belongs to the Class ${org.cls} (${org.cls === 13 ? 'Public Use' : 'Private Use'}) space registered to <strong>${escHtml(org.name)}</strong>.`
      : '';
    const desc = privateEntry
      ? `This UL is a known Class ${org?.cls} private definition: <strong>${escHtml(privateEntry.name)}</strong>.`
      : isSystemItemUL
        ? `This UL is a System Item Metadata Element key defined in SMPTE 379-1-2009 §6.2.1. It is not present verbatim in the SMPTE public register XML because bytes 6 and 8 (Registry Designator / Version Number) vary by document version. The structure is decoded below.`
        : isEssenceElement
          ? `This UL is an MXF essence element key not present verbatim in the register. The element type is resolved below using bytes 13–14; bytes 15–16 are per-track and differ between instances.`
          : `This UL is not present in the SMPTE public register XML files.${orgNote}`;

    const cardTitle = privateEntry
      ? escHtml(privateEntry.name)
      : isSystemItemUL
        ? 'System Item Metadata Element Key (SMPTE 379-1-2009)'
        : isEssenceElement
          ? 'Essence Element Key (unregistered track number)'
          : `Unregistered UL${org ? ` — ${escHtml(org.name)}` : ''}`;

    return `<div class="result-card unregistered">
  <div class="card-top">
    <span class="card-name">${cardTitle}</span>
    <span class="card-ul">${renderUL(ulStr, '', null, ctx)}</span>
  </div>
  <div class="card-meta">
    ${privateEntry ? `<span class="badge b-private">Private Definition Found</span>` : isSystemItemUL ? `<span class="badge b-reg">System Item (SMPTE 379-1-2009)</span>` : isEssenceElement ? `<span class="badge b-reg">Essence Element</span>` : `<span class="badge b-dep">Not in public registers</span>`}
    ${org ? `<span class="badge b-reg">Class ${org.cls} — ${escHtml(org.name)}</span>` : ''}
  </div>
  <div class="card-def">${desc}</div>
  <details class="entry-details">
    <summary>Details</summary>
    <div class="details-content">${systemItemSection}${essenceSection}${privateSection}${orgSection}${ulSection}</div>
  </details>
</div>`;
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.renderUnregistered = { renderUnregisteredUL };
})();
