# Executar em PowerShell Administrador. Nenhum certificado, senha ou chave sai do Windows.
# A mudanca local so e efetivada apos confirmacao humana, e nao publica o Worker.
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet("homologacao", "producao")]
  [string]$Ambiente
)
$ErrorActionPreference = "Stop"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute o PowerShell como Administrador."
}
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $env:ProgramFiles "Radasa\CIOT"
$securePath = Join-Path $runtime "config-protegida.bin"
$taskName = "Radasa - Conector CIOT"
if (-not (Test-Path -LiteralPath $securePath -PathType Leaf)) { throw "Conector CIOT nao instalado." }
if (-not (Test-Path -LiteralPath (Join-Path $runtime "servidor.mjs") -PathType Leaf)) { throw "Instalacao do conector incompleta." }
Add-Type -AssemblyName System.Security
$previousBytes = [IO.File]::ReadAllBytes($securePath)
$decoded = [Security.Cryptography.ProtectedData]::Unprotect($previousBytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
$cfg = [Text.Encoding]::UTF8.GetString($decoded) | ConvertFrom-Json
try {
  if ($cfg.environment -eq $Ambiente -and (($Ambiente -eq "homologacao") -or $cfg.allowProduction -eq "SIM")) {
    Write-Host "Conector ja configurado em $Ambiente; nada foi alterado." -ForegroundColor Green
    exit 0
  }
  $pfx = [string]$cfg.pfxFile
  $cnpj = [string]$cfg.cnpj
  if ($cnpj -notmatch '^\d{14}$' -or -not (Test-Path -LiteralPath $pfx -PathType Leaf)) { throw "CNPJ ou certificado local nao encontrado." }
  $certs = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
  $certs.Import([IO.File]::ReadAllBytes($pfx), [string]$cfg.pfxPassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
  $valid = @($certs | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and $_.Subject -match $cnpj })
  if ($valid.Count -eq 0) { throw "Certificado A1 invalido, expirado ou nao pertence ao CNPJ cadastrado." }
  if ($Ambiente -eq "producao") {
    Write-Warning "PRODUCAO: os CIOTs enviados serao oficiais e poderao gerar efeitos legais."
    Write-Warning "Confirme que a ETC esta apta a emitir diretamente e que NAO ha subcontratacao de TAC/equiparado sem IP autorizada."
    Write-Warning "Primeiro verifique o emissor, o RNTRC, a frota, o Tunnel e os dados da operacao."
    $confirmacao = Read-Host 'Para preparar o conector oficial, digite exatamente ATIVAR CIOT PRODUCAO'
    if ($confirmacao -cne 'ATIVAR CIOT PRODUCAO') { throw "Confirmacao nao recebida. Nenhuma alteracao feita." }
  }
  $cfg.environment = $Ambiente
  $cfg | Add-Member -NotePropertyName allowProduction -NotePropertyValue $(if ($Ambiente -eq 'producao') { 'SIM' } else { 'NAO' }) -Force
  $json = $cfg | ConvertTo-Json -Compress -Depth 10
  $encrypted = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($json), $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
  $permissionsScript = Join-Path $project "ciot-conector\Restaurar-Permissoes-CIOT.ps1"
  if (-not (Test-Path -LiteralPath $permissionsScript)) { throw "Modulo de permissoes CIOT ausente." }
  . $permissionsScript
  $stage = "CONSULTAR_TAREFA"
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  $stage = "PARAR_TAREFA"
  if ($task.State -eq "Running") {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
  }
  # Aguarda a tarefa anterior terminar para evitar conflito na porta 8789.
  $taskStopped = $false
  for ($i = 0; $i -lt 20; $i++) {
    $state = (Get-ScheduledTask -TaskName $taskName -ErrorAction Stop).State
    if ($state -ne "Running") { $taskStopped = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $taskStopped) { throw "CIOT_TAREFA_NAO_PAROU" }
  $changed = $false
  try {
    $stage = "VERIFICAR_PERMISSOES"
    Set-CiotRestrictedPermissions -RuntimeDir $runtime
    $stage = "GRAVAR_AMBIENTE"
    # Se a gravacao for interrompida, restaura bytes anteriores no rollback.
    $changed = $true
    [IO.File]::WriteAllBytes($securePath, $encrypted)
    $stage = "RESTRINGIR_ARQUIVO"
    Set-CiotRestrictedPermissions -RuntimeDir $runtime
    $stage = "INICIAR_SERVICO"
    Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $stage = "AGUARDAR_RESPOSTA"
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
      Start-Sleep -Seconds 2
      try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8789/health' -TimeoutSec 2 -ErrorAction Stop
        if ($health.ok -eq $true -and $health.service -eq 'ciot-local' -and $health.environment -eq $Ambiente) { $ready = $true; break }
      } catch { }
    }
    if (-not $ready) { throw "CIOT_HEALTH_NAO_CONFIRMOU_AMBIENTE" }
  } catch {
    $failureStage = $stage
    $errorType = $_.Exception.GetType().Name
    # NUNCA imprimir o texto arbitrario da excecao, pois pode conter paths e segredos.
    $knownCodes = @('CIOT_TAREFA_NAO_PAROU', 'CIOT_HEALTH_NAO_CONFIRMOU_AMBIENTE',
      'PASTA_CIOT_INESPERADA', 'PASTA_CIOT_INVALIDA', 'ITEM_CIOT_INESPERADO',
      'FALHA_ACL_PASTA_CIOT', 'FALHA_PROPRIEDADE_ARQUIVO_CIOT',
      'FALHA_ACL_ARQUIVO_CIOT', 'ACL_CIOT_CONTEM_PERMISSAO_INESPERADA')
    $safeCause = if ($_.Exception.Message -in $knownCodes) { $_.Exception.Message } else { 'ERRO_' + $errorType.ToUpperInvariant() }
    Write-Warning "CIOT_ATIVACAO_FALHOU etapa=$failureStage motivo=$safeCause"
    if ($changed) {
      try {
        $stage = "ROLLBACK_PARAR_TAREFA"
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        for ($i = 0; $i -lt 15; $i++) {
          if ((Get-ScheduledTask -TaskName $taskName).State -ne 'Running') { break }
          Start-Sleep -Seconds 1
        }
        $stage = "ROLLBACK_RESTAURAR_CONFIG"
        [IO.File]::WriteAllBytes($securePath, $previousBytes)
        Set-CiotRestrictedPermissions -RuntimeDir $runtime
        $stage = "ROLLBACK_REINICIAR_SERVICO"
        Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
        Write-Warning "CIOT_CONFIG_ANTERIOR_RESTAURADA"
      } catch {
        # Nao ocultar falha do rollback; nunca afirmar que houve restauracao sem validar.
        Write-Warning "CIOT_FALHA_ROLLBACK etapa=$stage tipo=$($_.Exception.GetType().Name)"
      }
    } else {
      # Se a falha aconteceu apos parar a tarefa, tentar restabelecer o ambiente anterior.
      try { Start-ScheduledTask -TaskName $taskName -ErrorAction Stop } catch { Write-Warning 'CIOT_REINICIO_ANTERIOR_FALHOU' }
    }
    Write-Warning 'Execute Diagnosticar-Conector-CIOT.ps1 para conferir a tarefa e eventos de inicializacao.'
    throw "CIOT_ATIVACAO_NAO_CONCLUIDA_$failureStage"
  }
  Write-Host "Conector CIOT local online no ambiente: $Ambiente" -ForegroundColor Green
  Write-Host "IMPORTANTE: O Worker Cloudflare ainda deve ser configurado no MESMO ambiente e publicado separadamente."
} finally {
  $cfg = $null
  $decoded = $null
  $encrypted = $null
  $json = $null
}
