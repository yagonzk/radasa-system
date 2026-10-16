# Executar em PowerShell como Administrador. Armazena configuracao com DPAPI LocalMachine
# e limita acesso ao arquivo ao SYSTEM e Administradores do Windows.
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = "Radasa - Conector CIOT"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Abra o PowerShell como Administrador para instalar a tarefa de inicializacao."
}
if (-not (Test-Path (Join-Path $project "ciot-conector\servidor.mjs"))) {
  throw "Codigo do conector nao encontrado. Extraia o ZIP atualizado primeiro."
}
# Evita substituir segredos existentes por engano. Instalações com falha usam o reparador.
$existingConfig = Join-Path (Join-Path $env:ProgramFiles "Radasa\CIOT") "config-protegida.bin"
if (Test-Path -LiteralPath $existingConfig -PathType Leaf) {
  throw "Conector CIOT ja instalado. Para corrigir a inicializacao, execute Reparar-Conector-CIOT.ps1 (sem trocar certificado/token)."
}
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$defaultPfx = Join-Path $env:USERPROFILE "Downloads\certificado.pfx"
$pfx = Read-Host "Caminho COMPLETO do certificado A1 local [$defaultPfx]"
if (-not $pfx) { $pfx = $defaultPfx }
$pfx = [IO.Path]::GetFullPath($pfx.Trim('"'))
if (-not (Test-Path -LiteralPath $pfx -PathType Leaf)) { throw "Arquivo de certificado nao encontrado." }
$cnpj = (Read-Host "CNPJ da empresa titular do certificado (14 digitos)") -replace '\D', ''
if ($cnpj -notmatch '^\d{14}$') { throw "CNPJ invalido." }
$pass = Read-Host "Senha do certificado A1" -AsSecureString
$passPlain = [System.Net.NetworkCredential]::new("", $pass).Password
try {
  Add-Type -AssemblyName System.Security
  $pfxBytes = [IO.File]::ReadAllBytes($pfx)
  $pfxCollection = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
  $pfxCollection.Import($pfxBytes, $passPlain, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
  $matches = @($pfxCollection | Where-Object { $_.Subject -match $cnpj -and $_.HasPrivateKey })
  if ($matches.Count -eq 0) { throw "O PFX nao possui chave privada para o CNPJ informado." }
  if ($matches[0].NotAfter -le [DateTime]::Now) { throw "O certificado A1 esta vencido." }
  $randomBytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
  $token = [BitConverter]::ToString($randomBytes).Replace("-", "").ToLowerInvariant()
  # A tarefa SYSTEM NUNCA pode executar codigo de Downloads (gravavel pelo usuario).
  # Copiamos o binario Node, scripts e certificado para Program Files, protegido contra escrita por nao administradores.
  $runtimeDir = Join-Path $env:ProgramFiles "Radasa\CIOT"
  New-Item -Path $runtimeDir -ItemType Directory -Force | Out-Null
  Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $runtimeDir "node.exe") -Force
  Copy-Item -LiteralPath $pfx -Destination (Join-Path $runtimeDir "certificado.pfx") -Force
  Copy-Item -LiteralPath (Join-Path $project "ciot-conector\servidor.mjs") -Destination (Join-Path $runtimeDir "servidor.mjs") -Force
  Copy-Item -LiteralPath (Join-Path $project "ciot-conector\agro-nfe.mjs") -Destination (Join-Path $runtimeDir "agro-nfe.mjs") -Force
  Copy-Item -LiteralPath (Join-Path $project "Iniciar-Conector-CIOT.ps1") -Destination (Join-Path $runtimeDir "Iniciar-Conector-CIOT.ps1") -Force
  $securePath = Join-Path $runtimeDir "config-protegida.bin"
  $secureConfig = @{
    nodePath = (Join-Path $runtimeDir "node.exe")
    pfxFile = (Join-Path $runtimeDir "certificado.pfx")
    pfxPassword = $passPlain
    sharedToken = $token
    cnpj = $cnpj
    environment = "homologacao"
    port = 8789
  } | ConvertTo-Json -Compress
  $encryptedConfig = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($secureConfig), $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
  [IO.File]::WriteAllBytes($securePath, $encryptedConfig)
  # Nunca usar /inheritance:r /T: a operacao pode deixar arquivos sem nenhuma ACE.
  # O modulo aplica permissoes explicitas para SYSTEM/Admins em cada arquivo.
  $permissionsScript = Join-Path $project "ciot-conector\Restaurar-Permissoes-CIOT.ps1"
  if (-not (Test-Path -LiteralPath $permissionsScript -PathType Leaf)) { throw "Modulo de permissoes CIOT ausente." }
  . $permissionsScript
  Set-CiotRestrictedPermissions -RuntimeDir $runtimeDir
  $launcher = Join-Path $runtimeDir "Iniciar-Conector-CIOT.ps1"
  $powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$launcher`"" -WorkingDirectory $runtimeDir
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Conector CIOT local da ANTT via mTLS; inicia no boot." -Force | Out-Null
  Start-ScheduledTask -TaskName $taskName
  Write-Host "Tarefa registrada: $taskName. Aguardando o conector responder..." -ForegroundColor Cyan
  $ready = $false
  for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Seconds 2
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8789/health" -TimeoutSec 2
      if ($health.ok -eq $true -and $health.service -eq "ciot-local") { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) {
    Write-Warning "Tarefa criada, mas o conector nao respondeu em 24 segundos. Nao configure o Tunnel ainda."
    Write-Host "Execute: powershell -ExecutionPolicy Bypass -File .\Diagnosticar-Conector-CIOT.ps1" -ForegroundColor Yellow
  } else {
    Write-Host "Conector CIOT online em http://127.0.0.1:8789/health" -ForegroundColor Green
    Write-Host "Proximo passo: configurar o Tunnel e executar Configurar-Conector-CIOT-Cloudflare.ps1."
  }
} finally {
  $passPlain = $null
  $pass = $null
  $token = $null
  $secureConfig = $null
}
