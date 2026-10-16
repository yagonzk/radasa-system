# Inicializador do conector sob a conta SYSTEM. Sem gravar senhas, tokens ou payloads.
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$securePath = Join-Path $project "config-protegida.bin"
$logPath = Join-Path $project "diagnostico-inicializacao.log"

function Write-CiotEvent([string]$code) {
  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  # Gravar apenas identificadores fixos: nao registrar segredo, caminho PFX ou corpo de requisicoes.
  if ($code -notmatch '^[A-Za-z0-9_:.-]{1,96}$') { $code = 'EVENTO_INVALIDO' }
  Add-Content -LiteralPath $logPath -Value "$stamp $code" -Encoding UTF8
}

Add-Type -AssemblyName System.Security
try {
  Write-CiotEvent "TAREFA_INICIADA"
  $protected = [IO.File]::ReadAllBytes($securePath)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
  $cfg = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
  $env:CIOT_BRIDGE_PFX = $cfg.pfxFile
  $env:CIOT_BRIDGE_PFX_PASSWORD = $cfg.pfxPassword
  $env:CIOT_BRIDGE_SHARED_TOKEN = $cfg.sharedToken
  $env:CIOT_BRIDGE_CNPJ = $cfg.cnpj
  $env:CIOT_BRIDGE_ENVIRONMENT = $cfg.environment
  $env:CIOT_BRIDGE_ALLOW_PRODUCTION = if ($cfg.environment -eq "producao" -and $cfg.allowProduction -eq "SIM") { "SIM" } else { "NAO" }
  $env:CIOT_BRIDGE_PORT = [string]$cfg.port
  $nodeExe = $cfg.nodePath
  $cfg = $null
  $server = Join-Path $project "servidor.mjs"
  while ($true) {
    try {
      Write-CiotEvent "PROCESSO_NODE_INICIANDO"
      & $nodeExe $server 2>&1 | ForEach-Object {
        $line = [string]$_
        if ($line -match 'CIOT_STARTUP_FAILED:([A-Z0-9_]{1,80})') {
          Write-CiotEvent "CIOT_STARTUP_FAILED:$($Matches[1])"
        } elseif ($line -match 'Conector CIOT pronto em') {
          Write-CiotEvent "SERVIDOR_HTTP_PRONTO"
        }
      }
      $exitCode = [int]$LASTEXITCODE
      if ($exitCode -ge 0 -and $exitCode -le 255) {
        Write-CiotEvent "PROCESSO_NODE_SAIU:$exitCode"
      } else {
        Write-CiotEvent "PROCESSO_NODE_SAIU"
      }
    } catch {
      Write-CiotEvent "ERRO_EXECUCAO_NODE"
    }
    Start-Sleep -Seconds 15
  }
} catch {
  Write-CiotEvent "FALHA_INICIALIZACAO_PROTEGIDA"
  throw "O inicializador CIOT falhou. Consulte diagnostico-inicializacao.log."
} finally {
  Remove-Item Env:CIOT_BRIDGE_PFX,Env:CIOT_BRIDGE_PFX_PASSWORD,Env:CIOT_BRIDGE_SHARED_TOKEN,Env:CIOT_BRIDGE_CNPJ,Env:CIOT_BRIDGE_ENVIRONMENT,Env:CIOT_BRIDGE_ALLOW_PRODUCTION,Env:CIOT_BRIDGE_PORT -ErrorAction SilentlyContinue
}
