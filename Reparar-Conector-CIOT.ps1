# Instala atualizacao sem alterar PFX, senha, CNPJ ou token compartilhado existente.
$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Abra o PowerShell como Administrador."
}
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $env:ProgramFiles "Radasa\CIOT"
$taskName = "Radasa - Conector CIOT"
if (-not (Test-Path -LiteralPath (Join-Path $runtime "config-protegida.bin") -PathType Leaf)) {
  throw "Configuracao existente nao encontrada. Execute Instalar-Conector-CIOT.ps1."
}
foreach ($name in @("servidor.mjs", "agro-nfe.mjs", "Iniciar-Conector-CIOT.ps1")) {
  $source = if ($name -eq "servidor.mjs" -or $name -eq "agro-nfe.mjs") { Join-Path $project "ciot-conector\$name" } else { Join-Path $project $name }
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Arquivo necessario ausente: $name" }
}
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if ($task.State -eq "Running") {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
  Start-Sleep -Seconds 3
}
# Recupera PRIMEIRO as ACLs dos arquivos antigos; Copy-Item falhava por falta de ACE.
$permissionsScript = Join-Path $project "ciot-conector\Restaurar-Permissoes-CIOT.ps1"
if (-not (Test-Path -LiteralPath $permissionsScript -PathType Leaf)) { throw "Modulo de permissoes CIOT ausente." }
. $permissionsScript
Set-CiotRestrictedPermissions -RuntimeDir $runtime
Copy-Item -LiteralPath (Join-Path $project "ciot-conector\servidor.mjs") -Destination (Join-Path $runtime "servidor.mjs") -Force
Copy-Item -LiteralPath (Join-Path $project "ciot-conector\agro-nfe.mjs") -Destination (Join-Path $runtime "agro-nfe.mjs") -Force
Copy-Item -LiteralPath (Join-Path $project "Iniciar-Conector-CIOT.ps1") -Destination (Join-Path $runtime "Iniciar-Conector-CIOT.ps1") -Force
# Garantia final: arquivos atualizados tambem recebem ACE explicita SYSTEM/Admins.
Set-CiotRestrictedPermissions -RuntimeDir $runtime
Start-ScheduledTask -TaskName $taskName
$ready = $false
for ($i = 0; $i -lt 12; $i++) {
  Start-Sleep -Seconds 2
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:8789/health" -TimeoutSec 2
    if ($health.ok -eq $true -and $health.service -eq "ciot-local") { $ready = $true; break }
  } catch { }
}
if ($ready) {
  Write-Host "Conector CIOT ONLINE. Certificado e token existentes preservados." -ForegroundColor Green
} else {
  Write-Warning "Conector continua offline. Execute Diagnosticar-Conector-CIOT.ps1 e envie o resultado sem dados secretos."
}
