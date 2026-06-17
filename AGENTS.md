# SMPTE Register Search — Project Guide

## Purpose

An unofficial, zero-dependency browser tool for searching the SMPTE public register XML files (Labels, Types, Elements, Groups, Essence) and locally-defined System Item keys. Users can look up ULs (Universal Labels) by hex bytes, symbol, name, or free text. The tool decodes each 16-byte UL structure into named fields with tooltips, resolves wildcard matches per SMPTE ST 336, and surfaces reverse references, org registrations, and known Class-14 private definitions.

There is no server, no build step for the UI, and no npm. Open `index.html` in a browser. Data must be regenerated with `build-data.ps1` when SMPTE register XMLs are updated.

---

## Top-level files

| File | Purpose |
|---|---|
| `index.html` | Shell page — `<head>` meta, CSS/script tags in dependency order, and the static HTML body (search input, filter checkboxes, result container). Contains no logic. |
| `ul-spec.js` | **Single source of truth for UL structure.** Classifies a normalised UL (`classifyUL` → essence-element / system-item / generic-smpte / non-smpte) and defines the per-byte match policy (`byteMatchRule`) and essence masked-byte set. Both the matcher (`ul-match.js`, `search-core.js`) and the renderers (`byte-info.js` via re-export) derive from it, so the SMPTE rules live in exactly one place. UMD: sets `window.UL_SPEC` in the browser (loaded before `ul-match.js`), `require()` in Node. See classifier definitions and standard references inline. |
| `ul-match.js` | UL matching utilities shared between the browser and Node test runner. Applies the policy from `ul-spec.js` — `matchBytes` reads `byteMatchRule`; it holds no classification logic of its own. Exports `normalizeHex`, `looksLikeHex`, `ulMatchesWithWildcard`, `ulPrefixMatchWithWildcard`, `ulMatchesEssenceWildcard`, and re-exports `classifyUL`/`KIND`. Loaded as a `<script>` in the browser (sets `window.UL_MATCH`) and via `require()` in Node. |
| `orgs.js` | SMPTE-RA Class 13/14 organisation registry. Maps bytes 8–9 of a normalised UL (e.g. `"0d01"`) to `{ name, cls }`. Sets `window.ORG_REGISTRY`. Source: smpte-ra.org/class-1314-registrations. |
| `private.js` | Manually curated Class-14 (Private Use) UL definitions reverse-engineered from vendor SDKs and public technical docs. Sets `window.PRIVATE_ULS` (keyed by 32-char normalised UL). Currently contains one entry (Sony S-Log3); the rest are documented placeholders for future population. |
| `systemItems.js` | Hard-coded SMPTE System Item UL definitions for keys defined only in SMPTE prose standards (326M, 385M) and absent from the public register XML. Sets `window.SMPTE_SYSTEM_ITEMS`. Also exports via `module.exports` for the Node test runner. |
| `smpte-docs.js` | **Generated — do not edit.** Exports `window.SMPTE.docCatalog.SLUGS` (a `Set` of 902 valid slug strings derived from `smpte_docs.json`). Used by `src/smpte-links.js` to validate slugs before linking, avoiding 404s. Regenerate with `node tools/gen-docs-catalog.js` when the catalog is refreshed. Also usable via `module.exports` in Node. |
| `data.js` | **Generated — do not edit.** ~7 MB minified JSON blob of all SMPTE register entries. Sets `window.SMPTE_ENTRIES`. Regenerate with `build-data.ps1`. |
| `build-data.ps1` | PowerShell script that parses the five XML files in `registers/`, wires cross-references and reverse-ref arrays, builds a full-text search field per entry, and writes the result to `data.js`. Run this whenever register XMLs are updated. |

---

## `assets/`

| File | Purpose |
|---|---|
| `assets/styles.css` | All CSS for the application — layout, card styling, UL byte colour coding, badge colours, detail tables, disclaimer block. Loaded via `<link>` in `index.html`. |

---

## `src/`

Browser-only application modules. Each file wraps its code in an IIFE and attaches its exports to `window.SMPTE.<key>`. They must be loaded in the order listed in `index.html` because later modules reference earlier ones through `window.SMPTE`.

| File | `window.SMPTE` key | Purpose |
|---|---|---|
| `src/dom-utils.js` | `dom` | HTML-safe string helpers: `escHtml`, `escRegex`, and `hl` (highlight query matches with `<mark>`). |
| `src/smpte-links.js` | `links` | `linkifyDoc(text, catalog)` — converts SMPTE document references in plain text into `<a>` hyperlinks pointing to `https://pub.smpte.org/doc/<slug>/`. Handles modern forms (`ST 377-1`, `RP 2057`), legacy M-suffix (`SMPTE 380M`), year suffixes (`SMPTE 352M-2001`), colon-year (`ST 379-2:2010`), dot notation (`SMPTE 429.6`), no-space (`SMPTE ST2067-2`), and bare numeric siblings after `&` (`296M` in `SMPTE 274M & 296M`). Non-SMPTE refs (EBU, ISO, AMWA) pass through unchanged. Slugs are validated against the catalog Set — unknown slugs fall back to `https://pub.smpte.org/doc/`. Internally HTML-escapes input before inserting `<a>` tags. UMD: also usable via `module.exports` in Node. `defDoc` values throughout the app now render as links produced by this function. |
| `src/byte-info.js` | `byteInfo` | Static UL byte metadata (`UL_BYTE_INFO` array, essence/system-item type maps), ST 366M validation (`validateULQueryBytes`, `genericByteInfo`), and per-byte description helpers (`essenceByteInfo`, `systemItemByteInfo`). Its `isEssenceElementKey`/`isSystemItemKey` delegate to `ul-spec.js` (the renderers import them from here). |
| `src/entries.js` | `entries` | `buildAllEntries(rawEntries, systemItems, normalizeHex, orgRegistry)` — merges and normalises both data sources, builds `ulIndex` (a `Map` keyed by UL for O(1) record-name lookup), and derives the essence element type lookup map (`essenceB15Names`, keyed by bytes 13–15). Returns a `ctx`-compatible object. |
| `src/render-ul.js` | `renderUL` | `renderUL(ul, normQuery, entry, ctx)` — renders a single UL as colour-coded, tooltip-annotated byte spans. Highlights matched bytes, marks wildcards, and enriches byte 9 tooltips with org data. |
| `src/render-details.js` | `renderDetails` | `renderDetails(e, normQuery, ctx)` — renders the expandable Details block for a registered entry. Internally uses `renderOrgSection`, `renderULByteTable`, `renderFieldsSection`, `renderRecordsSection`, `renderRefsSection`. Exports `renderOrgSection` for reuse by `render-unregistered.js`. |
| `src/render-unregistered.js` | `renderUnregistered` | `renderUnregisteredUL(normUL, ctx)` — renders the special amber card shown when a 32-hex query has no register match. Detects and decodes System Item keys (SMPTE 379-1-2009), Essence Element keys (ST 379-2), and known private definitions. Reuses `renderOrgSection` from `render-details.js`. |
| `src/render-card.js` | `renderCard` | `renderCard(e, rawQuery, normQuery, queryLower, …, ctx)` and `getMatchHints` — renders a single search result card with name, UL, badges (register, kind, deprecated, match type), match-context hints, definition snippet, and the Details block. |
| `src/search.js` | *(entry point)* | Boots the application: validates `window.SMPTE_ENTRIES`, calls `buildAllEntries`, assembles `ctx`, sets the idle status, and wires the search input (debounced), register-filter checkboxes, and hide-deprecated toggle. `runSearch()` orchestrates matching (direct UL, wildcard, essence wildcard, text) and renders results. Loaded last via `defer`. |

---

## `tools/`

Node scripts for generating committed source files from their source data.

| File | Purpose |
|---|---|
| `tools/gen-docs-catalog.js` | Reads `smpte_docs.json` (902 entries), extracts slugs from each `url` field, and writes `smpte-docs.js`. Run `node tools/gen-docs-catalog.js` whenever `smpte_docs.json` is refreshed. |

---

## `registers/`

Source SMPTE register XML files (read-only input to `build-data.ps1`). Do not edit manually.

| File | Content |
|---|---|
| `Labels.xml` | SMPTE Labels register (~2.2 MB) |
| `Types.xml` | SMPTE Types register (~445 KB) |
| `Elements.xml` | SMPTE Elements register (~2.2 MB) |
| `Groups.xml` | SMPTE Groups register (~679 KB) |
| `Essence.xml` | SMPTE Essence register (~48 KB) |

---

## `tests/`

Regression tests for the UL matching logic (Node.js, no test framework). `npm test` runs the
matching gate, the hex-normalization suite, and the API contract tests — all exit non-zero on failure.

| File | Purpose |
|---|---|
| `tests/regression.test.js` | **The matching gate (in `npm test`).** Runs every UL in `labels.json` through the real matcher (`runCorpus` from `run.js`) and asserts, per label, the **same hit count AND the same set of card-names** as the committed `tests/baseline.json`. Any count change, name swap, or gained/lost match fails (exit 1). Pass `--update` to regenerate the baseline after an intended change. |
| `tests/baseline.json` | **Committed** expected output: `label → { hits, names[] }`. The source of truth the gate checks against. Refresh only with `node tests/regression.test.js --update` once a change is confirmed correct. |
| `tests/run.js` | Searches each UL in `labels.json` via the shared matcher. Exports `runCorpus()` (used by the gate). As a CLI it writes a timestamped snapshot to `tests/results/` (`node tests/run.js [--out …]`) for ad-hoc investigation — it is **not** itself a pass/fail gate. |
| `tests/diff.js` | Lenient, count-only comparison of two snapshot files — reports gains/losses for investigating an intended change. Exit 1 only when a label drops to zero hits. Use the gate, not this, for pass/fail. |
| `tests/normalizeHex.test.js` | Hex-normalization + dynamic-local-tag assertions (in `npm test`). |
| `tests/linkify.test.js` | 45 unit tests for `src/smpte-links.js` — covers `toSlug()` normalization and `linkifyDoc()` for all form variants, catalog fallback, bare-sibling pass, non-SMPTE plain text, and XSS escaping (in `npm test`). |
| `tests/test-api.js` | Vercel API handler contract tests — filters, input syntaxes, error handling (in `npm test`). |
| `tests/labels.json` | 138 UL labels extracted from a real MXF file dump — the test corpus. |

---

## Workflow

### Search the registers
Open `index.html` in any modern browser. No server required.

### Regenerate `data.js` after XML updates
```powershell
.\build-data.ps1
```

### Regenerate `smpte-docs.js` after refreshing the doc catalog
```powershell
node tools/gen-docs-catalog.js   # reads smpte_docs.json, writes smpte-docs.js (902 slugs)
```

### Run the tests
```powershell
npm test     # matching gate (138 ULs: count + card-names) + normalizeHex + API contract
```

### Update the baseline (when a matching change is intentional)
```powershell
node tests/regression.test.js --update   # then review the tests/baseline.json diff before committing
```

### Investigate what a change altered (ad-hoc, lenient)
```powershell
node tests/run.js --out tests/results/run-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss').json
node tests/diff.js tests/results/<before>.json tests/results/run-<timestamp>.json
```

---

## UL matching rules (SMPTE ST 336 / 366M)

These rules are encoded once in `ul-spec.js` (`classifyUL` + `byteMatchRule`); the matcher and
renderers both read from there. The kind of a UL selects which rules apply:

- **Generic SMPTE UL** — byte 8 (Version Number) is always ignored; bytes 5–7 (Category / Registry /
  Structure) with value `7f` match any value (the ST 366M wildcard zone); all other bytes literal.
- **Essence element key** — `06 0e 2b 34` + bytes 5–7 = `010201` + bytes 9–12 = `0d010301` (the
  version byte is excluded from *classification*; the `0d010301` requirement separates real element
  keys from other `0102…` essence dictionary labels). Matched via `ulMatchesEssenceWildcard`: bytes
  1–8 are literal (every register essence element key uses version `01`), `7f` is a wildcard in
  bytes 9–16, and bytes 14 + 16 (Element Count / Element Number) are always masked (ST 379-2 §10.1).
- **System Item key** (SMPTE 379-1 §6.2.1 / 326M / 385M) — byte 5 = `02`, byte 7 = `01`,
  bytes 9–12 = `0d010301`, byte 13 ∈ {`04` CP, `14` GC}. Byte 16 (Metadata Block Count) with value
  `ff` matches any count.
- Prefix queries (fewer than 16 bytes) use `ulPrefixMatchWithWildcard`.

> Historical note: the matcher used to classify essence keys by byte 5 = `01` alone, which swept in
> every Dictionaries-category UL (Metadata/Types dictionaries) and suppressed the version-ignore rule
> for them. The `010201` + `0d010301` definition above fixes that.
