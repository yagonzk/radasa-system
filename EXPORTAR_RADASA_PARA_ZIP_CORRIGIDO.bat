@echo off
setlocal EnableExtensions

title Exportar Radasa System para ZIP

echo ==========================================
echo    EXPORTAR RADASA SYSTEM PARA ZIP
echo ==========================================
echo.

set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"

for %%I in ("%PROJECT%") do set "PROJECT_NAME=%%~nxI"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"

set "OUTPUT=%USERPROFILE%\Desktop\%PROJECT_NAME%_%STAMP%.zip"
set "TEMP_DIR=%TEMP%\radasa_export_%STAMP%"

if not exist "%PROJECT%\package.json" (
    echo [ERRO] package.json nao encontrado.
    echo Coloque este arquivo BAT na pasta raiz do projeto Radasa.
    echo.
    pause
    exit /b 1
)

echo Projeto:
echo %PROJECT%
echo.
echo Destino:
echo %OUTPUT%
echo.
echo Preparando arquivos...

if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%" >nul 2>&1

robocopy "%PROJECT%" "%TEMP_DIR%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
  /XD node_modules .git dist .wrangler .turbo .cache coverage ^
  /XF .env .env.* *.zip

if errorlevel 8 (
    echo.
    echo [ERRO] Falha ao preparar os arquivos.
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

echo Compactando...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "if (Test-Path -LiteralPath '%OUTPUT%') { Remove-Item -LiteralPath '%OUTPUT%' -Force };" ^
  "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%OUTPUT%' -CompressionLevel Optimal -Force"

if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel criar o ZIP.
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

rmdir /s /q "%TEMP_DIR%"

if not exist "%OUTPUT%" (
    echo.
    echo [ERRO] O ZIP nao foi encontrado apos a exportacao.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo EXPORTACAO CONCLUIDA
echo ==========================================
echo.
echo Arquivo criado:
echo %OUTPUT%
echo.
echo Ignorados:
echo - node_modules
echo - .git
echo - dist
echo - .wrangler
echo - .turbo
echo - .cache
echo - coverage
echo - arquivos .env
echo - arquivos .zip
echo.
pause
