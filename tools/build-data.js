#!/usr/bin/env node
/**
 * Download SMPTE register XMLs and convert to data.js (UMD-wrapped JSON)
 * Automatically fetches registers if remote versions are newer.
 *
 * Run: node tools/build-data.js
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const REGISTERS_DIR = path.resolve(__dirname, '..', 'registers');

// Draft registers contain more up-to-date entries than published versions.
// Essence.xml is only available in the published registry.
const REGISTER_SOURCES = [
  { file: 'Labels.xml', url: 'https://registry.smpte-ra.org/view/draft/Labels.xml' },
  { file: 'Types.xml', url: 'https://registry.smpte-ra.org/view/draft/Types.xml' },
  { file: 'Elements.xml', url: 'https://registry.smpte-ra.org/view/draft/Elements.xml' },
  { file: 'Groups.xml', url: 'https://registry.smpte-ra.org/view/draft/Groups.xml' },
  { file: 'Essence.xml', url: 'https://registry.smpte-ra.org/view/published/Essence.xml' }
];

const parser = new xml2js.Parser({ mergeAttrs: false, explicitArray: true });

async function fetchRegisterIfNewer(file, url) {
  const localPath = path.join(REGISTERS_DIR, file);
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      console.log(`  ${file}: remote fetch failed (${response.status}), using local if available`);
      return;
    }

    const remoteTime = response.headers.get('last-modified');
    if (!remoteTime) {
      console.log(`  ${file}: no last-modified header, skipping update check`);
      return;
    }

    const remoteDate = new Date(remoteTime);
    const localExists = fs.existsSync(localPath);

    if (!localExists) {
      console.log(`  ${file}: not found locally, downloading...`);
    } else {
      const localStats = fs.statSync(localPath);
      const localDate = new Date(localStats.mtime);
      if (remoteDate <= localDate) {
        console.log(`  ${file}: local is current`);
        return;
      }
      console.log(`  ${file}: remote is newer, downloading...`);
    }

    // Download the file
    const dataResponse = await fetch(url);
    if (!dataResponse.ok) throw new Error(`HTTP ${dataResponse.status}`);
    const content = await dataResponse.text();
    fs.writeFileSync(localPath, content, 'utf8');
    console.log(`  ${file}: updated`);
  } catch (err) {
    const localExists = fs.existsSync(localPath);
    if (localExists) {
      console.log(`  ${file}: fetch error (${err.message}), using local`);
    } else {
      throw new Error(`Cannot fetch ${file} and no local copy exists: ${err.message}`);
    }
  }
}

function getChildText(node, tag) {
  if (!node) return '';
  const child = node[tag];
  if (!child || !Array.isArray(child) || !child[0]) return '';
  const val = child[0];
  return typeof val === 'string' ? val.trim() : (val._ ? String(val._).trim() : '');
}

async function main() {
  const entries = [];
  const ulToEntry = new Map();

  // Download registers if needed
  console.log('Checking for register updates...');
  for (const { file, url } of REGISTER_SOURCES) {
    await fetchRegisterIfNewer(file, url);
  }

  // Pass 1: parse all XMLs and collect entries
  const xmlFiles = fs.readdirSync(REGISTERS_DIR).filter(f => f.endsWith('.xml'));

  for (const file of xmlFiles) {
    console.log(`Pass 1: Parsing ${file}...`);
    const xmlPath = path.join(REGISTERS_DIR, file);
    const xmlText = fs.readFileSync(xmlPath, 'utf8');
    const doc = await parser.parseStringPromise(xmlText);

    // Root element varies (ElementsRegister, EssenceRegister, etc.); find it dynamically
    const root = Object.values(doc)[0] || {};
    const xmlEntries = (root.Entries && root.Entries[0]?.Entry) || [];

    for (const entry of xmlEntries) {
      const ul = getChildText(entry, 'UL');
      const name = getChildText(entry, 'Name');

      const records = [];
      const localTags = [];
      const refULs = [];

      // Records are nested under Contents > Record
      let recs = [];
      if (entry.Contents && Array.isArray(entry.Contents) && entry.Contents[0] && entry.Contents[0].Record) {
        recs = entry.Contents[0].Record;
      } else if (entry.Record) {
        recs = Array.isArray(entry.Record) ? entry.Record : [entry.Record];
      }
      for (const rec of recs) {
        const rUL = getChildText(rec, 'UL');
        const tag = getChildText(rec, 'LocalTag');
        records.push({
          ul: rUL,
          localTag: tag,
          isOptional: getChildText(rec, 'IsOptional') === 'true',
          isUniqueID: getChildText(rec, 'IsUniqueID') === 'true'
        });
        if (tag) localTags.push(tag);
        if (rUL) refULs.push(rUL);
      }

      // Match PowerShell property order (for consistent JSON output)
      const entryData = {};
      entryData.name = name;
      entryData.localTags = localTags;
      entryData.namespaceName = getChildText(entry, 'NamespaceName');
      entryData.definition = getChildText(entry, 'Definition');
      entryData.isConcrete = getChildText(entry, 'IsConcrete');
      entryData.symbol = getChildText(entry, 'Symbol');
      entryData.text = '';  // filled in pass 2
      entryData.register = getChildText(entry, 'Register');
      entryData.klvSyntax = getChildText(entry, 'KLVSyntax');
      entryData.kind = getChildText(entry, 'Kind');
      entryData.records = records;
      entryData.ul = ul;
      entryData.deprecated = getChildText(entry, 'IsDeprecated') === 'true';
      entryData.defDoc = getChildText(entry, 'DefiningDocument');
      entryData.reverseRefs = [];

      entries.push(entryData);
      if (ul && name) {
        ulToEntry.set(ul, entryData);
      }
    }
  }

  console.log(`Pass 1 complete: ${entries.length} entries, ${ulToEntry.size} ULs mapped`);

  // Pass 2: wire reverse references and build full-text search field
  console.log('Pass 2: Wiring reverse references and building text...');

  for (const entry of entries) {
    for (const rec of entry.records) {
      const refUL = rec.ul;
      if (!refUL) continue;
      const refEntry = ulToEntry.get(refUL);
      if (!refEntry) continue;
      if (rec.localTag) {
        refEntry.reverseRefs.push({
          localTag: rec.localTag,
          parentName: entry.name,
          parentRegister: entry.register
        });
      }
    }
  }

  for (const entry of entries) {
    const parts = [];

    // Full text of the entry (all descendants concatenated, whitespace normalized)
    // We can't easily reconstruct this from parsed XML, so we'll use what we have
    const textParts = [
      entry.register, entry.symbol, entry.ul, entry.kind, entry.name,
      entry.definition, entry.defDoc, entry.namespaceName, entry.isConcrete,
      entry.klvSyntax, entry.deprecated ? 'true' : 'false'
    ].filter(Boolean).join(' ');
    parts.push(textParts);

    // Forward: names of referenced elements
    for (const rec of entry.records) {
      const refUL = rec.ul;
      if (!refUL) continue;
      const refEntry = ulToEntry.get(refUL);
      if (refEntry && refEntry.name) {
        parts.push(refEntry.name);
      }
    }

    // Reverse: localTags and parent names
    for (const ref of entry.reverseRefs) {
      if (ref.localTag) parts.push(ref.localTag);
      if (ref.parentName) parts.push(ref.parentName);
    }

    entry.text = parts.join(' ');
  }

  // Output as UMD-wrapped JSON
  const json = JSON.stringify(entries);
  const header = "(function(f){if(typeof module!=='undefined'&&module.exports)module.exports=f();else window.SMPTE_ENTRIES=f();})(function(){return ";
  const footer = ";});";
  const output = header + json + footer;

  const outPath = path.resolve(__dirname, '..', 'data.js');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`Wrote data.js with ${entries.length} entries.`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
