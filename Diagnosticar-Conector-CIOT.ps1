# Diagnostico sem mostrar certificados, senhas, tokens, CNPJ nem dados financeiros.
$taskName = "Radasa - Conector CIOT"
$runtime = Join-Path $env:ProgramFiles "Radasa\CIOT"
Write-Host "=== Conector CIOT - Diagnostico ===" -ForegroundColor Cyan
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
  Write-Host "TAREFA_NAO_ENCONTRADA" -ForegroundColor Yellow
} else {
  Write-Host "Estado da tarefa: $($task.State)"
  $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
  if ($info) {
    Write-Host "Ultima execucao: $($info.LastRunTime)"
    Write-Host "Ultimo resultado: $($info.LastTaskResult)"
  }
}
foreach ($name in @("node.exe", "servidor.mjs", "config-protegida.bin", "certificado.pfx")) {
  Write-Host "Arquivo $name presente: $(Test-Path -LiteralPath (Join-Path $runtime $name) -PathType Leaf)"
}
try {
  $health = Invoke-RestMethod "http://127.0.0.1:8789/health" -TimeoutSec 3
  Write-Host "Health: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
  if ($health.service -eq 'ciot-local') {
    if ($health.environment -eq 'producao') { Write-Host 'AMBIENTE_ATUAL: producao (operacoes oficiais)' -ForegroundColor Yellow }
    elseif ($health.environment -eq 'homologacao') { Write-Host 'AMBIENTE_ATUAL: homologacao (testes)' -ForegroundColor Cyan }
  }
} catch {
  Write-Host "Health: OFFLINE (porta 8789 sem resposta)" -ForegroundColor Yellow
}
# Checagem de leitura/execucao para SYSTEM e Administradores (sem mostrar segredos).
foreach ($name in @("node.exe", "servidor.mjs", "Iniciar-Conector-CIOT.ps1", "config-protegida.bin", "certificado.pfx")) {
  $path = Join-Path $runtime $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
  try {
    $aces = @((Get-Acl -LiteralPath $path -ErrorAction Stop).Access)
    $sids = @($aces | ForEach-Object {
      try { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { "" }
    })
    $ok = ("S-1-5-18" -in $sids) -and ("S-1-5-32-544" -in $sids)
    Write-Host "ACL $name restrita SYSTEM/Admins: $ok"
  } catch { Write-Host "ACL $name inacessivel" }
}
$log = Join-Path $runtime "diagnostico-inicializacao.log"
if (Test-Path -LiteralPath $log) {
  Write-Host "=== Eventos recentes (codigos, sem dados secretos) ==="
  Get-Content -LiteralPath $log -Tail 20 -ErrorAction SilentlyContinue
} else {
  Write-Host "LOG_AUSENTE (servico antigo ou inicializador nao executado)"
}
