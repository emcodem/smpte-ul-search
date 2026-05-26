// DOM/HTML utility helpers shared across the rendering modules.
(function () {
  'use strict';

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Highlight literal query matches in text, correctly handling HTML-special characters.
  function hl(text, q) {
    if (!q || !text) return escHtml(text);
    const re = new RegExp(escRegex(q), 'gi');
    let result = '';
    let last = 0;
    let m;
    while ((m = re.exec(String(text))) !== null) {
      result += escHtml(text.slice(last, m.index));
      result += `<mark>${escHtml(m[0])}</mark>`;
      last = m.index + m[0].length;
    }
    return result + escHtml(text.slice(last));
  }

  window.SMPTE = window.SMPTE || {};
  window.SMPTE.dom = { escHtml, escRegex, hl };
})();
