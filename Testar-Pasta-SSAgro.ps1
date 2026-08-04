$path = "C:\SSAgro\Server\Bin\Docs\NFe\Empresa"

Write-Host "Testando acesso a: $path" -ForegroundColor Cyan

if (-not (Test-Path $path)) {
    Write-Host "ERRO: pasta não encontrada." -ForegroundColor Red
    exit 1
}

$files = Get-ChildItem $path -Recurse -File -Filter "*-nfe.xml" -ErrorAction Stop
Write-Host "Pasta acessível." -ForegroundColor Green
Write-Host "XMLs completos encontrados: $($files.Count)" -ForegroundColor Green
$files | Sort-Object LastWriteTime -Descending | Select-Object -First 5 FullName,Length,LastWriteTime
Read-Host "Pressione ENTER para fechar"
