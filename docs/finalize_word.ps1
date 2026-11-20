# Оновлює зміст і номери сторінок у .docx через Microsoft Word та зберігає PDF-копію.
# Запускає окремий екземпляр Word і завершує лише його (інші відкриті вікна Word не зачіпаються).
param([Parameter(Mandatory = $true)][string]$DocPath)

$full = (Resolve-Path -LiteralPath $DocPath).Path
$pdf = [System.IO.Path]::ChangeExtension($full, '.pdf')
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$word = New-Object -ComObject Word.Application
$mine = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object { $_.Id })
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
    $doc = $word.Documents.Open($full, $false, $false, $false)
    if ($null -eq $doc) { throw 'Word не відкрив документ' }
    foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
    $doc.Fields.Update() | Out-Null
    $doc.Repaginate()
    foreach ($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }
    $doc.Save()
    $doc.ExportAsFixedFormat($pdf, 17)   # 17 = wdExportFormatPDF
    'pages: ' + $doc.ComputeStatistics(2)
    $doc.Close($false)
    "pdf: $pdf"
}
finally {
    try { $word.Quit() } catch { }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Start-Sleep -Seconds 1
    foreach ($id in $mine) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
}
