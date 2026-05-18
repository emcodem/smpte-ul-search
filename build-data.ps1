# Reads all registers/*.xml and writes data.js for use by index.html
# Run: .\build-data.ps1

$ErrorActionPreference = 'Stop'

function Get-ChildText($node, $tag) {
    $child = $node.SelectSingleNode("*[local-name()='$tag']")
    if ($child) { $child.InnerText.Trim() } else { '' }
}

# First pass: collect all entries and build a UL -> entry index
$entries   = [System.Collections.Generic.List[hashtable]]::new()
$ulToEntry = @{}  # UL -> entry hashtable (for reverse-ref wiring)

foreach ($file in Get-ChildItem "registers\*.xml") {
    Write-Host "Pass 1: Parsing $($file.Name)..."
    [xml]$xml = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)

    foreach ($entry in $xml.SelectNodes("//*[local-name()='Entry']")) {
        $ul   = Get-ChildText $entry 'UL'
        $name = Get-ChildText $entry 'Name'

        # Structured records for display and search
        $records   = [System.Collections.Generic.List[hashtable]]::new()
        $localTags = [System.Collections.Generic.List[string]]::new()
        $refULs    = [System.Collections.Generic.List[string]]::new()
        foreach ($rec in $entry.SelectNodes("*//*[local-name()='Record']")) {
            $rUL = Get-ChildText $rec 'UL'
            $tag = Get-ChildText $rec 'LocalTag'
            $records.Add(@{
                ul         = $rUL
                localTag   = $tag
                isOptional = (Get-ChildText $rec 'IsOptional') -eq 'true'
                isUniqueID = (Get-ChildText $rec 'IsUniqueID') -eq 'true'
            })
            if ($tag)  { [void]$localTags.Add($tag) }
            if ($rUL)  { [void]$refULs.Add($rUL) }
        }

        $entryData = @{
            register      = Get-ChildText $entry 'Register'
            symbol        = Get-ChildText $entry 'Symbol'
            ul            = $ul
            kind          = Get-ChildText $entry 'Kind'
            name          = $name
            definition    = Get-ChildText $entry 'Definition'
            defDoc        = Get-ChildText $entry 'DefiningDocument'
            namespaceName = Get-ChildText $entry 'NamespaceName'
            isConcrete    = Get-ChildText $entry 'IsConcrete'
            klvSyntax     = Get-ChildText $entry 'KLVSyntax'
            deprecated    = (Get-ChildText $entry 'IsDeprecated') -eq 'true'
            records       = $records
            localTags     = $localTags
            refULs        = $refULs
            reverseRefs   = [System.Collections.Generic.List[hashtable]]::new()
            text          = ''  # filled in pass 2
            _xmlEntry     = $entry
        }
        $entries.Add($entryData)
        if ($ul -and $name) { $ulToEntry[$ul] = $entryData }
    }
}

Write-Host "Pass 1 complete: $($entries.Count) entries, $($ulToEntry.Count) ULs mapped"

# Second pass: wire reverse references and build full-text search field
Write-Host "Pass 2: Wiring reverse references and building text..."

foreach ($entry in $entries) {
    foreach ($rec in $entry.records) {
        $refUL = $rec.ul
        if (-not $refUL) { continue }
        $refEntry = $ulToEntry[$refUL]
        if (-not $refEntry) { continue }
        if ($rec.localTag) {
            $refEntry.reverseRefs.Add(@{
                localTag       = $rec.localTag
                parentName     = $entry.name
                parentRegister = $entry.register
            })
        }
    }
}

foreach ($entry in $entries) {
    $parts = [System.Collections.Generic.List[string]]::new()
    [void]$parts.Add(($entry._xmlEntry.InnerText -replace '\s+', ' '))

    # Forward: add names of referenced elements
    foreach ($refUL in $entry.refULs) {
        $refEntry = $ulToEntry[$refUL]
        if ($refEntry) { [void]$parts.Add($refEntry.name) }
    }

    # Reverse: add localTags and parent names for entries that reference this one
    foreach ($ref in $entry.reverseRefs) {
        [void]$parts.Add($ref.localTag)
        [void]$parts.Add($ref.parentName)
    }

    $entry.text = $parts -join ' '
    $entry.Remove('_xmlEntry')
    $entry.Remove('refULs')  # internal; not needed in output
}

$json = $entries | ConvertTo-Json -Compress -Depth 5
"window.SMPTE_ENTRIES=$json;" | Set-Content -Path 'data.js' -Encoding UTF8

Write-Host "Wrote data.js with $($entries.Count) entries."
