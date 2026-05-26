// Render the expandable Details block for a registered entry.
// Exposes renderOrgSection for reuse by render-unregistered.js.
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
  const { renderUL } = window.SMPTE.renderUL;

  function renderOrgSection(org, normUL) {
    if (!org) return '';
    return `<div class="details-section">
      <h4>SMPTE-RA Registration (Class ${org.cls})</h4>
      <table class="details-table"><tbody>
        <tr><th>Organization</th><td>${escHtml(org.name)}</td></tr>
        <tr><th>Class</th><td>${org.cls === 13 ? '13 — Public Use' : '14 — Private Use'}</td></tr>
        <tr><th>Org bytes (8–9)</th><td class="mono">${escHtml(normUL.substring(16, 20))}</td></tr>
      </tbody></table>
    </div>`;
  }

  function renderULByteTable(normUL, normQuery, entry, ctx) {
    const isEssenceEl  = isEssenceElementKey(normUL);
    const isSystemItem = isSystemItemKey(normUL);
    const essenceB15Names = ctx.essenceB15Names;

    const rows = UL_BYTE_INFO.map((info, b) => {
      const val = normUL.substring(b * 2, b * 2 + 2);
      const eb  = isEssenceEl  ? essenceByteInfo(b, val, normUL, essenceB15Names)
                : isSystemItem ? systemItemByteInfo(b, val, entry)
                : null;
      const rowName = eb ? eb.name : info.name;
      const rowDesc = eb ? eb.desc : info.desc;
      // Wildcard only in bytes 9-16 (b >= 8) for essence elements; bytes 5-8 are fixed literals
      const isAnyEssenceWc = isEssenceEl && b >= 8 && !info.wildcard && val === '7f';
      const isActiveWildcard = (!isEssenceEl && info.wildcard && val === '7f') || isAnyEssenceWc;
      const rowCls = info.fixed ? 'byte-fixed'
                   : (info.wildcard && !isEssenceEl) ? (isActiveWildcard ? 'byte-wc-active' : 'byte-wc')
                   : isAnyEssenceWc ? 'byte-wc-active'
                   : 'byte-item';
      const note = (!eb && isAnyEssenceWc)
        ? ' <em>— wildcard, any value (ST 2088 essence element)</em>'
        : (!eb && !isEssenceEl && isActiveWildcard) ? ' <em>— wildcard, matches any value</em>' : '';
      let queryHint = '';
      // When the register entry has 7f here but the query had a specific byte, show what it means.
      if (isAnyEssenceWc && normQuery && normQuery.length === 32) {
        const qval = normQuery.substring(b * 2, b * 2 + 2);
        if (qval !== '7f') {
          const qeb = essenceByteInfo(b, qval, normQuery, essenceB15Names);
          if (qeb && qeb.desc && !qeb.desc.startsWith('any')) {
            queryHint = ` <em class="query-hint">(your query: 0x${qval} — ${escHtml(qeb.desc)})</em>`;
          }
        }
      }
      // System Item byte 16 (Metadata Block Count): ff in entry matches any count
      if (!queryHint && isSystemItem && b === 15 && val === 'ff' && normQuery && normQuery.length === 32) {
        const qval = normQuery.substring(30, 32);
        if (qval !== 'ff') {
          const blockCount = parseInt(qval, 16);
          queryHint = ` <em class="query-hint">(your query: 0x${qval} — ${blockCount} metadata block${blockCount !== 1 ? 's' : ''})</em>`;
        }
      }
      // Version byte: always ignored during matching — show if query differs from entry
      if (!queryHint && !isEssenceEl && b === 7 && normQuery && normQuery.length >= 16) {
        const qval = normQuery.substring(14, 16);
        if (qval !== val) {
          queryHint = ` <em class="query-hint-muted">(your query had version 0x${qval} — version byte is always ignored during matching)</em>`;
        }
      }
      return `<tr class="${rowCls}">
          <td class="mono">${b + 1}</td>
          <td class="mono">${escHtml(val)}</td>
          <td>${escHtml(rowName)}</td>
          <td>${escHtml(rowDesc)}${note}${queryHint}</td>
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

  function renderFieldsSection(e) {
    const fields = [
      ['Register',          e.register],
      ['Namespace',         e.namespaceName],
      ['Symbol',            e.symbol],
      ['Kind',              e.kind],
      ['Defining Document', e.defDoc],
      ['Definition',        e.definition],
      ['Deprecated',        e.isDeprecated ? 'Yes' : 'No'],
      e.isConcrete ? ['Concrete', e.isConcrete] : null,
      e.klvSyntax  ? ['KLV Syntax', `0x${e.klvSyntax}`] : null,
    ].filter(f => f && f[1]);
    const fieldRows = fields.map(([k, v]) =>
      `<tr><th>${escHtml(k)}</th><td>${escHtml(v)}</td></tr>`
    ).join('');
    return `<div class="details-section">
      <h4>Registry Fields</h4>
      <table class="details-table"><tbody>${fieldRows}</tbody></table>
    </div>`;
  }

  function renderRecordsSection(e, normQuery, ctx) {
    if (!e.records.length) return '';
    const recRows = e.records.map(r => {
      const resolvedName = ctx.ulIndex.get(r.ul)?.name || '';
      return `<tr>
          <td class="mono">${escHtml(r.localTag)}</td>
          <td class="card-ul ul-cell-sm">${renderUL(r.ul, normQuery, e, ctx)}</td>
          <td>${escHtml(resolvedName)}</td>
          <td>${r.isOptional ? 'optional' : 'required'}</td>
        </tr>`;
    }).join('');
    return `<div class="details-section">
      <h4>Contents (${e.records.length} records)</h4>
      <table class="details-table">
        <thead><tr><th>LocalTag</th><th>UL</th><th>Element Name</th><th>Optional</th></tr></thead>
        <tbody>${recRows}</tbody>
      </table>
    </div>`;
  }

  function renderRefsSection(e) {
    if (!e.reverseRefs.length) return '';
    const refRows = e.reverseRefs.map(r =>
      `<tr>
          <td class="mono">${escHtml(r.localTag)}</td>
          <td>${escHtml(r.parentName)}</td>
          <td><span class="badge b-reg ul-cell-sm">${escHtml(r.parentRegister)}</span></td>
        </tr>`
    ).join('');
    return `<div class="details-section">
      <h4>Referenced by (${e.reverseRefs.length} entries)</h4>
      <table class="details-table">
        <thead><tr><th>LocalTag</th><th>Parent Entry</th><th>Register</th></tr></thead>
        <tbody>${refRows}</tbody>
      </table>
    </div>`;
  }

  function renderDetails(e, normQuery, ctx) {
    const orgSection = renderOrgSection(e.org, e.normUL);

    const prefix = 'urn:smpte:ul:';
    const groups = e.ul.startsWith(prefix) ? e.ul.slice(prefix.length).split('.') : null;
    const normUL = (groups && groups.length === 4 && groups.every(g => g.length === 8))
      ? groups.join('') : null;
    const ulSection = normUL ? renderULByteTable(normUL, normQuery, e, ctx) : '';

    return `<details class="entry-details">
      <summary>Details</summary>
      <div class="details-content">
        ${orgSection}${ulSection}${renderFieldsSection(e)}${renderRecordsSection(e, normQuery, ctx)}${renderRefsSection(e)}
      </div>
    </details>`;
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.renderDetails = { renderDetails, renderOrgSection };
})();
