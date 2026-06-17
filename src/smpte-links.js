// Linkify SMPTE document references in user-visible HTML.
// UMD — works in the browser (window.SMPTE.links) and in Node tests (require).
(function (f) {
  if (typeof module !== 'undefined' && module.exports) module.exports = f();
  else { window.SMPTE = window.SMPTE || {}; window.SMPTE.links = f(); }
})(function () {
  'use strict';

  const ROOT = 'https://pub.smpte.org/doc/';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Normalize a type prefix + raw number body to a pub.smpte.org slug.
  // Returns null if the body can't be reduced to a valid slug.
  function toSlug(prefix, body) {
    var num = body.replace(/\s+/g, '').replace(/\./g, '-');
    num = num.replace(/M(-|$)/g, '$1');           // 380M→380, 352M-2001→352-2001, 429-6M→429-6
    num = num.replace(/:(19|20)\d{2}$/, '');      // 379-2:2010→379-2
    num = num.replace(/-(19|20)\d{2}$/, '');      // 379-1-2009→379-1, 352-2001→352
    if (!/^\d+(?:-\d+)*$/.test(num)) return null;
    return (prefix || 'ST').toLowerCase() + num;
  }

  // Resolve a slug to a full URL, falling back to ROOT if not in the catalog.
  function resolveHref(slug, slugs) {
    if (slug && slugs && slugs.has(slug)) return ROOT + slug + '/';
    return ROOT;
  }

  function makeLink(displayText, prefix, body, slugs) {
    var slug = toSlug(prefix, body);
    var href = resolveHref(slug, slugs);
    return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + displayText + '</a>';
  }

  // Body pattern: digit start, optional dot-parts, optional single uppercase M-suffix,
  // optional dash-separated sub-parts (digits or alphanum for e.g. AMND1), optional colon-year.
  var BODY = '\\d[\\d.]*[A-Z]?(?:-[\\d\\w]+)*(?::\\d+)?';

  // Pass-1 regex: two alternates.
  // Alt A: explicit type prefix (ST/RP/EG/RDD/OV), optionally preceded by "SMPTE"
  // Alt B: bare "SMPTE" prefix (no explicit type → default ST)
  var RE_MAIN = new RegExp(
    '(SMPTE\\s*)?(ST|RP|EG|RDD|OV)\\s*(' + BODY + ')' +
    '|(SMPTE\\s*)(' + BODY + ')',
    'g'
  );

  // Pass-2 regex: bare sibling reference right after "&amp;" following a closed link tag.
  // e.g. "SMPTE 274M &amp; 296M" → pass 1 links "SMPTE 274M"; pass 2 links "296M".
  var RE_SIBLING = new RegExp(
    '(</a>\\s*&amp;\\s*)((ST|RP|EG|RDD|OV)\\s*)?(' + BODY + ')',
    'g'
  );

  function linkifyDoc(text, catalog) {
    if (!text) return '';
    var slugs = catalog || (
      typeof window !== 'undefined' &&
      window.SMPTE && window.SMPTE.docCatalog && window.SMPTE.docCatalog.SLUGS
    );

    // Escape HTML first — the patterns we match contain no HTML-special chars.
    var escaped = esc(text);

    // Pass 1: link explicit SMPTE references.
    RE_MAIN.lastIndex = 0;
    var pass1 = escaped.replace(RE_MAIN, function (m, _s1, typeA, bodyA, _s2, bodyB) {
      var prefix = typeA || 'ST';
      var body   = bodyA !== undefined ? bodyA : bodyB;
      return makeLink(m, prefix, body, slugs);
    });

    // Pass 2: link bare numeric siblings after "&amp;" following a linked doc.
    RE_SIBLING.lastIndex = 0;
    return pass1.replace(RE_SIBLING, function (_m, before, typeWithSpace, typeOnly, body) {
      var linkText = (typeWithSpace || '') + body;
      return before + makeLink(linkText, typeOnly || 'ST', body, slugs);
    });
  }

  return { linkifyDoc: linkifyDoc, toSlug: toSlug };
});
