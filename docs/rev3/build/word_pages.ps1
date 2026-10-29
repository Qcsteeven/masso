# Opens a .docx in Microsoft Word (hidden), prints JSON {"pages": N, "headings": [page of each Heading 1, in order]}
# and, with -Pdf, saves a PDF next to it. Used by finalize.py to fill the static table of contents.
param([Parameter(Mandatory = $true)][string]$Path, [string]$Pdf = "")
$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($Path, $false, $true)
    $doc.Repaginate()
    $heads = @()
    foreach ($p in $doc.Paragraphs) {
        if ($p.OutlineLevel -eq 1) {
            $t = $p.Range.Text.Trim()
            if ($t) { $heads += $p.Range.Information(3) }
        }
    }
    $pages = $doc.ComputeStatistics(2)
    if ($Pdf) { $doc.ExportAsFixedFormat($Pdf, 17) }
    $doc.Close($false)
    [ordered]@{ pages = $pages; headings = $heads } | ConvertTo-Json -Compress
}
finally {
    $word.Quit()
}
