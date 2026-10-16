$ErrorActionPreference = "Stop"
$taskName = "Radasa - Conector CIOT"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute como Administrador."
}
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$runtimeDir = Join-Path $env:ProgramFiles "Radasa\CIOT"
Remove-Item -LiteralPath $runtimeDir -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Tarefa local removida. Desative tambem o Tunnel e os dois segredos ANTT_CIOT_CONNECTOR_* no Cloudflare para evitar tentativas de chamada." -ForegroundColor Yellow
