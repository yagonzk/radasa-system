@echo off
setlocal EnableExtensions
title Exportar Radasa para Chat - LEVE

cd /d "%~dp0"
set "PROJECT=%CD%"

if not exist "%PROJECT%\package.json" (
  echo.
  echo [ERRO] package.json nao encontrado.
  echo Coloque este BAT na raiz do projeto Radasa e execute novamente.
  echo.
  pause
  exit /b 1
)

for %%I in ("%PROJECT%") do set "PROJECT_NAME=%%~nxI"

for /f %%I in ('powershell -NoLogo -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"

set "OUTPUT_DIR=%USERPROFILE%\Desktop"
if defined OneDrive if exist "%OneDrive%\Desktop" set "OUTPUT_DIR=%OneDrive%\Desktop"

set "ZIP=%OUTPUT_DIR%\%PROJECT_NAME%_CHAT_LEVE_%STAMP%.zip"
set "TEMP_DIR=%TEMP%\radasa_chat_leve_%STAMP%_%RANDOM%"

echo.
echo ============================================================
echo   EXPORTAR RADASA PARA O CHAT - MODO LEVE
echo ============================================================
echo.
echo Projeto:
echo %PROJECT%
echo.
echo Saida:
echo %ZIP%
echo.
echo Esta versao copia SOMENTE codigo e configuracoes uteis.
echo Arquivos individuais maiores que 4 MB serao ignorados.
echo.

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%" >nul 2>&1
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" >nul 2>&1

REM ============================================================
REM Copia SOMENTE arquivos de codigo/configuracao.
REM /MAX:4194304 = maximo de 4 MB por arquivo.
REM ============================================================

robocopy "%PROJECT%" "%TEMP_DIR%" ^
  *.ts *.tsx *.mts *.cts ^
  *.js *.jsx *.mjs *.cjs ^
  *.json *.jsonc ^
  *.css *.scss *.sass *.less ^
  *.html *.htm ^
  *.prisma *.sql ^
  *.graphql *.gql ^
  *.yaml *.yml *.toml ^
  *.ini *.conf *.properties ^
  *.bat *.cmd *.ps1 *.sh ^
  *.svg *.ico ^
  /E /MAX:4194304 /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
  /XD ^
    node_modules .git .github ^
    dist dist-sefaz-agent dist-dnit-agent dist-senatran-agent ^
    build out coverage ^
    .wrangler .turbo .cache cache caches ^
    .vite .vercel .output .next .nuxt ^
    .pnpm-store .yarn .npm ^
    .idea .vs ^
    tmp temp logs log ^
    uploads upload downloads download storage ^
    backup backups bkp ^
    dados data datasets ^
    IMPORTACAO importacao importacoes ^
    relatorios reports exports export ^
    anexos attachments documents documentos ^
    playwright-report test-results screenshots snapshots ^
    .nyc_output ^
    generated .prisma ^
  /XF ^
    .env .env.* *.env ^
    .dev.vars .dev.vars.* ^
    *.secret *.secrets ^
    *.map ^
    *.min.js *.min.css ^
    *.lock ^
    Thumbs.db Desktop.ini

set "ROBOCOPY_CODE=%ERRORLEVEL%"

if %ROBOCOPY_CODE% GEQ 8 (
  echo.
  echo [ERRO] Falha ao preparar os arquivos.
  if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
  pause
  exit /b 1
)

REM ============================================================
REM Copia arquivos raiz importantes que podem nao ter extensao.
REM ============================================================

if exist "%PROJECT%\Dockerfile" copy /Y "%PROJECT%\Dockerfile" "%TEMP_DIR%\Dockerfile" >nul
if exist "%PROJECT%\Procfile" copy /Y "%PROJECT%\Procfile" "%TEMP_DIR%\Procfile" >nul

REM yarn.lock pode ser util, mas so e incluido se for pequeno.
if exist "%PROJECT%\yarn.lock" (
  for %%F in ("%PROJECT%\yarn.lock") do (
    if %%~zF LEQ 4194304 copy /Y "%%~fF" "%TEMP_DIR%\yarn.lock" >nul
  )
)

REM ============================================================
REM Estatisticas antes de compactar.
REM ============================================================

set "RADASA_CHAT_TEMP=%TEMP_DIR%"
set "RADASA_CHAT_ZIP=%ZIP%"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$source=$env:RADASA_CHAT_TEMP;" ^
  "$files=Get-ChildItem -LiteralPath $source -Recurse -File -Force;" ^
  "$count=@($files).Count;" ^
  "$bytes=($files | Measure-Object Length -Sum).Sum;" ^
  "if ($null -eq $bytes) { $bytes=0 };" ^
  "Write-Host '';" ^
  "Write-Host ('Arquivos selecionados: ' + $count) -ForegroundColor Cyan;" ^
  "Write-Host ('Tamanho antes do ZIP: {0:N2} MB' -f ($bytes / 1MB)) -ForegroundColor Cyan;"

echo.
echo Compactando...

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip=$env:RADASA_CHAT_ZIP;" ^
  "$source=$env:RADASA_CHAT_TEMP;" ^
  "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force };" ^
  "$minDate=[datetime]'1980-01-01';" ^
  "Get-ChildItem -LiteralPath $source -Recurse -Force | Where-Object { $_.LastWriteTime -lt $minDate } | ForEach-Object { $_.LastWriteTime=$minDate };" ^
  "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $zip -CompressionLevel Optimal -Force;" ^
  "$item=Get-Item -LiteralPath $zip;" ^
  "Write-Host '';" ^
  "Write-Host ('Tamanho final do ZIP: {0:N2} MB' -f ($item.Length / 1MB)) -ForegroundColor Green;" ^
  "Write-Host ('ZIP criado em: ' + $item.FullName) -ForegroundColor Green;" ^
  "if ($item.Length -gt 50MB) {" ^
  "  Write-Host '';" ^
  "  Write-Host 'AVISO: o ZIP ainda passou de 50 MB.' -ForegroundColor Yellow;" ^
  "  Write-Host 'Mesmo assim ele ja esta filtrado apenas para codigo/configuracao.' -ForegroundColor Yellow;" ^
  "}"

if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel criar o ZIP.
  if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
  pause
  exit /b 1
)

if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo.
echo ============================================================
echo   EXPORTACAO CONCLUIDA
echo ============================================================
echo.
echo Este ZIP NAO inclui:
echo - node_modules / .git / builds / caches
echo - imagens pesadas, videos, fontes ou executaveis
echo - PDFs, XMLs, XLSX, CSV e bancos locais
echo - uploads, anexos, dados e relatorios
echo - .env, certificados, chaves ou secrets
echo - arquivos maiores que 4 MB
echo.
echo Ele inclui principalmente:
echo - codigo TypeScript / JavaScript
echo - React / CSS / HTML
echo - Prisma e migrations SQL
echo - package.json e lockfiles YAML/JSON
echo - configuracoes Wrangler / TypeScript / Vite
echo - scripts BAT / PowerShell / Shell
echo.
echo Pode enviar o ZIP criado diretamente no chat.
echo.
pause

endlocal
