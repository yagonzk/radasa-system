@echo off
setlocal EnableExtensions
title Exportar Radasa para Chat

cd /d "%~dp0"
set "PROJECT=%CD%"

if not exist "%PROJECT%\package.json" (
  echo.
  echo [ERRO] package.json nao encontrado.
  echo Execute este BAT na raiz do projeto Radasa.
  echo.
  if not defined RADASA_CHAT_EXPORT_NO_PAUSE pause
  exit /b 1
)

for %%I in ("%PROJECT%") do set "PROJECT_NAME=%%~nxI"

if defined RADASA_CHAT_EXPORT_STAMP (
  set "STAMP=%RADASA_CHAT_EXPORT_STAMP%"
) else (
  for /f %%I in ('powershell -NoLogo -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
)

if defined RADASA_CHAT_EXPORT_DIR (
  set "OUTPUT_DIR=%RADASA_CHAT_EXPORT_DIR%"
) else (
  set "OUTPUT_DIR=%USERPROFILE%\Desktop"
  if defined OneDrive if exist "%OneDrive%\Desktop" set "OUTPUT_DIR=%OneDrive%\Desktop"
)

set "ZIP=%OUTPUT_DIR%\%PROJECT_NAME%_chat_%STAMP%.zip"
set "TEMP_DIR=%TEMP%\radasa_chat_export_%STAMP%_%RANDOM%"

echo.
echo ==========================================
echo   EXPORTAR RADASA PARA O CHAT
echo ==========================================
echo.
echo Projeto:
echo %PROJECT%
echo.
echo ZIP:
echo %ZIP%
echo.
echo Ignorando dependencias, builds, dados pesados, backups e segredos.
echo.

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%" >nul 2>&1
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" >nul 2>&1

robocopy "%PROJECT%" "%TEMP_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
  /XD node_modules .git dist dist-sefaz-agent dist-dnit-agent dist-senatran-agent build out coverage .wrangler .turbo .cache .vite .vercel .output .next tmp temp logs dados IMPORTACAO relatorios ^
  /XF .env .env.* .dev.vars *.zip *.7z *.rar *.gz *.tgz *.log *.tmp *.bak *.bak-* *.csv *.xlsx *.xls *.pdf *.xml *.sqlite *.sqlite3 *.db *.pfx *.p12 *.pem *.key *.crt *.cer *.exe *.dll Thumbs.db Desktop.ini

if errorlevel 8 (
  echo.
  echo [ERRO] Falha ao preparar os arquivos.
  if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
  if not defined RADASA_CHAT_EXPORT_NO_PAUSE pause
  exit /b 1
)

(
  echo RADASA - EXPORTACAO LEVE PARA CHAT
  echo.
  echo Este ZIP foi criado para compartilhar o codigo do sistema sem arquivos pesados.
  echo.
  echo Incluido:
  echo - Codigo client/server/shared/worker/api
  echo - Prisma schema e migrations
  echo - Scripts e configuracoes do projeto
  echo - package.json e lockfiles
  echo.
  echo Ignorado:
  echo - node_modules, .git e caches
  echo - dist, builds e coverage
  echo - .env, chaves, certificados e bancos locais
  echo - ZIPs, planilhas, CSVs, PDFs, XMLs e logs
  echo - dados/importacoes/relatorios pesados
) > "%TEMP_DIR%\LEIA-ME-EXPORTACAO-CHAT.txt"

echo.
echo Compactando...

set "RADASA_CHAT_ZIP=%ZIP%"
set "RADASA_CHAT_TEMP=%TEMP_DIR%"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip=$env:RADASA_CHAT_ZIP;" ^
  "$source=$env:RADASA_CHAT_TEMP;" ^
  "if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force };" ^
  "$minDate=[datetime]'1980-01-01';" ^
  "Get-ChildItem -LiteralPath $source -Recurse -Force | Where-Object { $_.LastWriteTime -lt $minDate } | ForEach-Object { $_.LastWriteTime = $minDate };" ^
  "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $zip -CompressionLevel Optimal -Force;" ^
  "$item=Get-Item -LiteralPath $zip;" ^
  "Write-Host ('Tamanho do ZIP: {0:N2} MB' -f ($item.Length / 1MB));" ^
  "Write-Host ('ZIP criado em: ' + $item.FullName);"

if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel criar o ZIP.
  if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
  if not defined RADASA_CHAT_EXPORT_NO_PAUSE pause
  exit /b 1
)

if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

if not exist "%ZIP%" (
  echo.
  echo [ERRO] O ZIP nao foi encontrado apos a exportacao.
  if not defined RADASA_CHAT_EXPORT_NO_PAUSE pause
  exit /b 1
)

echo.
echo ==========================================
echo   EXPORTACAO CONCLUIDA
echo ==========================================
echo.
echo Arquivo criado:
echo %ZIP%
echo.
echo Pode enviar esse ZIP no chat.
echo.

if not defined RADASA_CHAT_EXPORT_NO_PAUSE pause
endlocal
