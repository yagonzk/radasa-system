# Envia os segredos do conector ao Cloudflare usando stdin; nao imprime valores.
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$securePath = Join-Path (Join-Path $env:ProgramFiles "Radasa\CIOT") "config-protegida.bin"
if (-not (Test-Path -LiteralPath $securePath)) { throw "Instale o conector local antes." }
Add-Type -AssemblyName System.Security
$protected = [IO.File]::ReadAllBytes($securePath)
$plain = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine)
$cfg = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm nao encontrado." }
Push-Location $project
try {
  # E necessario que o Worker atualizado ja esteja publicado.
  $cfg.sharedToken | & pnpm exec wrangler secret put ANTT_CIOT_CONNECTOR_TOKEN
  if ($LASTEXITCODE -ne 0) { throw "Falha ao salvar token no Cloudflare." }
  "https://ciot.radasa.com.br" | & pnpm exec wrangler secret put ANTT_CIOT_CONNECTOR_URL
  if ($LASTEXITCODE -ne 0) { throw "Falha ao salvar URL do conector." }
  Write-Host "Segredos enviados ao Cloudflare. Certificado e senha permanecem somente no PC." -ForegroundColor Green
} finally {
  $cfg = $null
  Pop-Location
}
