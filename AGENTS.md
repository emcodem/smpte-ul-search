# SMPTE Register Search — Project Guide

## Purpose

An unofficial, zero-dependency browser tool for searching the SMPTE public register XML files (Labels, Types, Elements, Groups, Essence) and locally-defined System Item keys. Users can look up ULs (Universal Labels) by hex bytes, symbol, name, or free text. The tool decodes each 16-byte UL structure into named fields with tooltips, resolves wildcard matches per SMPTE ST 336, and surfaces reverse references, org registrations, and known Class-14 private definitions.

There is no server, no build step for the UI, and no npm. Open `index.html` in a browser. Data must be regenerated with `build-data.ps1` when SMPTE register XMLs are updated.

---

## Top-level files

| File | Purpose |
|---|---|
| `index.html` | Shell page — `<head>` meta, CSS/script tags in dependency order, and the static HTML body (search input, filter checkboxes, result container). Contains no logic. |
| `ul-match.js` | UL matching utilities shared between the browser and Node test runner. Exports `normalizeHex`, `looksLikeHex`, `ulMatchesWithWildcard`, `ulPrefixMatchWithWildcard`, `ulMatchesEssenceWildcard`. Loaded as a `<script>` in the browser (sets `window.UL_MATCH`) and via `require()` in Node. |
| `orgs.js` | SMPTE-RA Class 13/14 organisation registry. Maps bytes 8–9 of a normalised UL (e.g. `"0d01"`) to `{ name, cls }`. Sets `window.ORG_REGISTRY`. Source: smpte-ra.org/class-1314-registrations. |
| `private.js` | Manually curated Class-14 (Private Use) UL definitions reverse-engineered from vendor SDKs and public technical docs. Sets `window.PRIVATE_ULS` (keyed by 32-char normalised UL). Currently contains one entry (Sony S-Log3); the rest are documented placeholders for future population. |
| `systemItems.js` | Hard-coded SMPTE System Item UL definitions for keys defined only in SMPTE prose standards (326M, 385M) and absent from the public register XML. Sets `window.SMPTE_SYSTEM_ITEMS`. Also exports via `module.exports` for the Node test runner. |
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
| `src/byte-info.js` | `byteInfo` | Static UL byte metadata (`UL_BYTE_INFO` array, essence/system-item type maps) and classifier functions: `isEssenceElementKey`, `isSystemItemKey`, `essenceByteInfo`, `systemItemByteInfo`. |
| `src/entries.js` | `entries` | `buildAllEntries(rawEntries, systemItems, normalizeHex, orgRegistry)` — merges and normalises both data sources, builds `ulIndex` (a `Map` keyed by UL for O(1) record-name lookup), and derives essence element lookup maps (`essenceB14Names`, `essenceB15Names`). Returns a `ctx`-compatible object. |
| `src/render-ul.js` | `renderUL` | `renderUL(ul, normQuery, entry, ctx)` — renders a single UL as colour-coded, tooltip-annotated byte spans. Highlights matched bytes, marks wildcards, and enriches byte 9 tooltips with org data. |
| `src/render-details.js` | `renderDetails` | `renderDetails(e, normQuery, ctx)` — renders the expandable Details block for a registered entry. Internally uses `renderOrgSection`, `renderULByteTable`, `renderFieldsSection`, `renderRecordsSection`, `renderRefsSection`. Exports `renderOrgSection` for reuse by `render-unregistered.js`. |
| `src/render-unregistered.js` | `renderUnregistered` | `renderUnregisteredUL(normUL, ctx)` — renders the special amber card shown when a 32-hex query has no register match. Detects and decodes System Item keys (SMPTE 379-1-2009), Essence Element keys (ST 379-2), and known private definitions. Reuses `renderOrgSection` from `render-details.js`. |
| `src/render-card.js` | `renderCard` | `renderCard(e, rawQuery, normQuery, queryLower, …, ctx)` and `getMatchHints` — renders a single search result card with name, UL, badges (register, kind, deprecated, match type), match-context hints, definition snippet, and the Details block. |
| `src/search.js` | *(entry point)* | Boots the application: validates `window.SMPTE_ENTRIES`, calls `buildAllEntries`, assembles `ctx`, sets the idle status, and wires the search input (debounced), register-filter checkboxes, and hide-deprecated toggle. `runSearch()` orchestrates matching (direct UL, wildcard, essence wildcard, text) and renders results. Loaded last via `defer`. |

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

Manual regression tests for the UL matching logic (Node.js, no test framework).

| File | Purpose |
|---|---|
| `tests/run.js` | Loads `data.js` + `systemItems.js` via a `window` shim, then searches each UL in `labels.json` using the same matching logic as the browser. Writes timestamped JSON result files to `tests/results/`. Run with `node tests/run.js`. Pass `--out tests/results/baseline.json` to update the baseline. |
| `tests/diff.js` | Compares two result files and reports gains (new matches) and regressions (lost matches). Exit code 0 = no regressions. Run with `node tests/diff.js <before.json> <after.json>`. |
| `tests/labels.json` | 138 UL labels extracted from a real MXF file dump, used as the test corpus. |
| `tests/results/baseline.json` | Current expected result set (gitignored directory, baseline committed separately). Compare new runs against this to detect regressions. |

---

## Workflow

### Search the registers
Open `index.html` in any modern browser. No server required.

### Regenerate `data.js` after XML updates
```powershell
.\build-data.ps1
```

### Run the regression test
```powershell
node tests/run.js --out tests/results/run-$(Get-Date -Format 'yyyy-MM-ddTHH-mm-ss').json
node tests/diff.js tests/results/baseline.json tests/results/run-<timestamp>.json
```

### Update the baseline (when improvements are intentional)
```powershell
node tests/run.js --out tests/results/baseline.json
```

---

## UL matching rules (SMPTE ST 336)

- **Byte 8 (Version Number)** is always ignored during matching.
- **Bytes 5–7 (Category / Registry / Structure)** with value `7f` match any value (wildcard zone).
- **Essence element keys** (byte 5 = `01`) are matched via `ulMatchesEssenceWildcard` instead — `7f` is a wildcard in bytes 9–16, and bytes 14 + 16 (Element Count / Element Number) are always masked.
- **System Item keys** (SMPTE 326M/385M): byte 16 (Metadata Block Count) with value `ff` matches any count.
- Prefix queries (fewer than 16 bytes) use `ulPrefixMatchWithWildcard`.
