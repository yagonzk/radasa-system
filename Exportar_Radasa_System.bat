@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

REM ============================================================
REM RADASA SYSTEM - EXPORTADOR DO PROJETO
REM Coloque este .BAT na raiz do projeto e execute com duplo clique.
REM ============================================================

cd /d "%~dp0"

for %%I in ("%CD%") do set "PROJECT_NAME=%%~nxI"

REM Data/hora segura para nome de arquivo usando PowerShell
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "STAMP=%%I"

set "EXPORT_DIR=%CD%\EXPORTADOS"
set "TEMP_DIR=%TEMP%\RadasaExport_%RANDOM%_%RANDOM%"
set "ZIP_FILE=%EXPORT_DIR%\%PROJECT_NAME%_%STAMP%.zip"

echo.
echo ============================================================
echo   RADASA SYSTEM - EXPORTADOR
echo ============================================================
echo.
echo Projeto: %PROJECT_NAME%
echo Origem : %CD%
echo Destino: %ZIP_FILE%
echo.

if not exist "%EXPORT_DIR%" mkdir "%EXPORT_DIR%"
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo [1/3] Copiando arquivos do projeto...
echo.

REM Robocopy retorna codigos 0-7 como sucesso/avisos normais.
robocopy "%CD%" "%TEMP_DIR%\%PROJECT_NAME%" /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 ^
 /XD "node_modules" ".git" ".wrangler" "dist" "build" ".next" ".turbo" "coverage" "EXPORTADOS" ".cache" ^
 /XF ".env" ".env.*" ".dev.vars" ".dev.vars.*" "*.pfx" "*.p12" "*.pem" "*.key" "*.cer" "*.crt" "*.log" >nul

set "ROBOCOPY_CODE=%ERRORLEVEL%"
if %ROBOCOPY_CODE% GEQ 8 (
    echo.
    echo ERRO: Falha ao copiar os arquivos. Codigo Robocopy: %ROBOCOPY_CODE%
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b %ROBOCOPY_CODE%
)

echo [2/3] Gerando arquivo ZIP...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop'; Compress-Archive -Path '%TEMP_DIR%\%PROJECT_NAME%' -DestinationPath '%ZIP_FILE%' -CompressionLevel Optimal -Force"

if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel gerar o ZIP.
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)

echo [3/3] Limpando arquivos temporarios...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo.
echo ============================================================
echo   EXPORTACAO CONCLUIDA
echo ============================================================
echo.
echo Arquivo criado:
echo %ZIP_FILE%
echo.
echo Foram excluidos automaticamente:
echo - node_modules
echo - .git
echo - .wrangler
echo - dist / build
echo - EXPORTADOS
echo - .env e .dev.vars
echo - certificados e chaves privadas
echo - arquivos de log
echo.

REM Abre a pasta dos exports
explorer "%EXPORT_DIR%"

pause
endlocal
