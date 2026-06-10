# SMPTE Register Search

An unofficial, zero-dependency browser-based search tool for the SMPTE register data (Labels, Types, Elements, Groups, Essence). Search by UL, Symbol, Name, Definition, or any other field. Also available as a JSON API via Vercel.

**Search UI:** https://emcodem.github.io/smpte-ul-search/

**JSON API:** https://smpte-ul-search.vercel.app/api/search

> **Disclaimer:** Not affiliated with or endorsed by SMPTE. For authoritative information visit [smpte-ra.org](https://www.smpte-ra.org/).

## Using the search UI

Open https://emcodem.github.io/smpte-ul-search/ in a browser, or clone the repo and open `index.html` directly — no build step, no server required.

**Supported query formats:**

| Format | Example |
|---|---|
| Plain hex | `060e2b34` |
| Dotted hex | `06.0e.2b.34.02.53.01.01` |
| 0x-prefixed bytes | `0x06 0x0e 0x2b 0x34` |
| URN | `urn:smpte:ul:060e2b34.027f0101.0d010101.01010000` |
| Symbol / Name / Definition | `FileDescriptor`, `timecode` |
| Local tag (hex) | `3004` (use "LocalTags only" checkbox) |

SMPTE ST 336 wildcard rules apply: byte 8 (version) is always ignored, bytes 5–7 with value `7f` are wildcards, and essence element keys follow ST 2088 wildcard semantics.

## JSON API (Vercel)

The same search logic is available as a REST endpoint when deployed to Vercel.

### Endpoint

```
GET /api/search
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Search query (any format from the table above) |
| `registers` | string | all | Comma-separated list: `Labels`, `Types`, `Elements`, `Groups`, `Essence`, `System Items` |
| `hideDeprecated` | `true`/`1` | false | Exclude deprecated entries |
| `localTagsOnly` | `true`/`1` | false | Match only against localTag and reverse reference fields |
| `limit` | number | 250 | Max results to return (hard cap: 1000) |

### Response

```json
{
  "query": "3004",
  "total": 2,
  "showing": 2,
  "results": [
    {
      "register": "Elements",
      "symbol": "EssenceContainerFormat",
      "ul": "urn:smpte:ul:060e2b34.01010102.06010104.01020000",
      "kind": "LEAF",
      "name": "Essence Container Format",
      "definition": "...",
      "defDoc": "SMPTE ST 377-1",
      "namespaceName": null,
      "isDeprecated": false,
      "org": { "name": "AAF Association", "cls": 13 },
      "matchType": {
        "direct": false,
        "wildcard": false,
        "essenceWildcard": false,
        "text": true
      }
    }
  ]
}
```

### Examples

```bash
# Text search
curl "https://<your-deployment>.vercel.app/api/search?q=FileDescriptor"

# UL prefix search
curl "https://<your-deployment>.vercel.app/api/search?q=060e2b34"

# Local tag lookup
curl "https://<your-deployment>.vercel.app/api/search?q=3004&localTagsOnly=true"

# Filter to Groups register, hide deprecated
curl "https://<your-deployment>.vercel.app/api/search?q=timecode&registers=Groups&hideDeprecated=true"
```

## Local development

### Prerequisites

```bash
npm install
```

### Run the dev server (static UI + API)

```bash
npm run dev
# → vercel dev starts at http://localhost:3000
# → static index.html served at /
# → API available at /api/search
```

The first run will prompt you to log in and link the project to a Vercel account.

### Run tests

```bash
npm test
# → node tests/run.js   (138-label UL regression suite)
# → node tests/test-api.js (API handler unit tests)
```

## Deploying to Vercel

Connect the GitHub repository in the Vercel dashboard. Every push to `main` deploys automatically. No build command or output directory configuration is needed — Vercel auto-detects the `api/` directory and serves the static files from the root.

## Updating register data

When SMPTE publishes updated XML files:

1. Replace the files in `registers/`
2. Regenerate `data.js`:
   ```powershell
   .\build-data.ps1
   ```
3. Run the regression tests and update the baseline if the changes are intentional:
   ```powershell
   npm test
   node tests/run.js --out tests/results/baseline.json
   ```
4. Commit `data.js` and the updated baseline.
