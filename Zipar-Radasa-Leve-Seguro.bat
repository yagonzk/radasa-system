@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Compactar Radasa-System v1.1 - Versao leve e segura

cd /d "%~dp0"

set "PROJECT_NAME=Radasa-System-v1.1"
set "OUTPUT_ZIP=%~dp0%PROJECT_NAME%-LEVE.zip"
set "TEMP_COPY=%TEMP%\%PROJECT_NAME%_ZIP_%RANDOM%%RANDOM%"

echo.
echo ============================================================
echo   COMPACTADOR SEGURO - RADASA-SYSTEM V1.1
echo ============================================================
echo.
echo Este processo NAO altera nem apaga arquivos do projeto original.
echo Ele cria uma copia temporaria, remove apenas arquivos recriaveis
echo e gera um ZIP mais leve.
echo.
echo Serao preservados:
echo   - Banco de dados e arquivos .db, .sqlite e .sqlite3
echo   - Arquivos .env
echo   - Pasta prisma e migrations
echo   - Uploads, documentos e storage
echo   - Todo o codigo-fonte e configuracoes
echo.
pause

echo.
echo [1/4] Criando copia temporaria...
echo.

if exist "%TEMP_COPY%" (
    rd /s /q "%TEMP_COPY%" >nul 2>&1
)

mkdir "%TEMP_COPY%" >nul 2>&1

robocopy "%~dp0" "%TEMP_COPY%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP ^
 /XD ^
 "node_modules" ^
 ".git" ^
 ".pnpm-store" ^
 ".npm" ^
 ".yarn" ^
 ".cache" ^
 ".parcel-cache" ^
 ".turbo" ^
 ".vite" ^
 ".next" ^
 "dist" ^
 "build" ^
 "coverage" ^
 "out" ^
 "release" ^
 "tmp" ^
 "temp" ^
 "logs" ^
 ".idea" ^
 ".vs" ^
 "bin" ^
 "obj" ^
 "Debug" ^
 "Release" ^
 /XF ^
 "*.log" ^
 "*.tmp" ^
 "*.temp" ^
 "*.cache" ^
 "*.zip" ^
 "*.7z" ^
 "*.rar" ^
 "Thumbs.db" ^
 "Desktop.ini" ^
 "*.tsbuildinfo"

set "ROBOCOPY_EXIT=%ERRORLEVEL%"

if %ROBOCOPY_EXIT% GEQ 8 (
    echo.
    echo ERRO: Falha ao criar a copia temporaria.
    echo Codigo do Robocopy: %ROBOCOPY_EXIT%
    rd /s /q "%TEMP_COPY%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [2/4] Verificando arquivos importantes...
echo.

if exist "%~dp0.env" (
    if not exist "%TEMP_COPY%\.env" (
        echo ERRO: O arquivo .env nao foi copiado.
        rd /s /q "%TEMP_COPY%" >nul 2>&1
        pause
        exit /b 1
    )
)

if exist "%~dp0prisma" (
    if not exist "%TEMP_COPY%\prisma" (
        echo ERRO: A pasta prisma nao foi copiada.
        rd /s /q "%TEMP_COPY%" >nul 2>&1
        pause
        exit /b 1
    )
)

echo Arquivos importantes preservados.

echo.
echo [3/4] Gerando ZIP...
echo.

if exist "%OUTPUT_ZIP%" del /f /q "%OUTPUT_ZIP%" >nul 2>&1

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath '%TEMP_COPY%\*' -DestinationPath '%OUTPUT_ZIP%' -CompressionLevel Optimal -Force"

if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel criar o ZIP.
    rd /s /q "%TEMP_COPY%" >nul 2>&1
    pause
    exit /b 1
)

echo.
echo [4/4] Limpando copia temporaria...
echo.

rd /s /q "%TEMP_COPY%" >nul 2>&1

if not exist "%OUTPUT_ZIP%" (
    echo.
    echo ERRO: O arquivo ZIP nao foi encontrado ao final do processo.
    pause
    exit /b 1
)

for %%A in ("%OUTPUT_ZIP%") do set "ZIP_SIZE=%%~zA"
set /a ZIP_SIZE_MB=%ZIP_SIZE% / 1048576

echo.
echo ============================================================
echo   FINALIZADO COM SUCESSO
echo ============================================================
echo.
echo Projeto original: NAO FOI ALTERADO
echo Arquivo criado:
echo "%OUTPUT_ZIP%"
echo.
echo Tamanho aproximado: %ZIP_SIZE_MB% MB
echo.
echo Para restaurar o projeto em outro computador:
echo   1. Extraia o ZIP
echo   2. Abra o terminal na pasta extraida
echo   3. Execute: pnpm install
echo   4. Execute o comando normal para iniciar o sistema
echo.
pause

endlocal
