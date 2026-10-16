# Comando seguro de consulta: nao exibe token, certificado nem CNPJ.
$ErrorActionPreference = 'Continue'
function Testar-Health($endereco, $nome) {
  try {
    $r = Invoke-RestMethod -Uri $endereco -TimeoutSec 8 -ErrorAction Stop
    $ambiente = [string]$r.environment
    $ok = $r.ok -eq $true -and $r.service -eq 'ciot-local'
    Write-Host "$nome : $(if ($ok) { 'ONLINE' } else { 'RESPOSTA_INESPERADA' }) | ambiente=$ambiente"
    return $(if ($ok) { $ambiente } else { '' })
  } catch {
    Write-Host "$nome : OFFLINE_OU_SEM_RESPOSTA" -ForegroundColor Yellow
    return ''
  }
}
Write-Host '=== DIAGNOSTICO DE AMBIENTES CIOT (SEM SEGREDOS) ==='
$localEnv = Testar-Health 'http://127.0.0.1:8789/health' 'PC local'
$publicEnv = Testar-Health 'https://ciot.radasa.com.br/health' 'Tunnel publico'
if ($localEnv -and $publicEnv -and $localEnv -ne $publicEnv) {
  Write-Warning 'AMBIENTES_DIFERENTES: o Tunnel nao aponta para este conector local.'
}
$wranglerPath = Join-Path $PSScriptRoot 'wrangler.jsonc'
if (Test-Path -LiteralPath $wranglerPath) {
  $conteudo = Get-Content -LiteralPath $wranglerPath -Raw
  $m = [regex]::Match($conteudo, '"ANTT_CIOT_ENVIRONMENT"\s*:\s*"(homologacao|producao)"')
  if ($m.Success) {
    $workerEnv = $m.Groups[1].Value
    Write-Host "Projeto local (wrangler.jsonc): ambiente=$workerEnv [nao confirma o Worker publicado]"
    if ($publicEnv -and $workerEnv -ne $publicEnv) {
      Write-Warning 'AMBIENTES_POSSIVELMENTE_DIFERENTES: confira o ambiente PUBLICADO em TMS > CIOT > Configuracao ANTT.'
    }
  }
}
Write-Host 'O ambiente publicado deve ser conferido na tela de Configuracao ANTT; nao emita ate que os ambientes coincidam.'
