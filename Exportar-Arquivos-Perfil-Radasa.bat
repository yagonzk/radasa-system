@echo off
setlocal EnableExtensions DisableDelayedExpansion

title Exportador do Sistema de Perfil - Radasa

echo.
echo ==================================================
echo      EXPORTADOR DO SISTEMA DE PERFIL - RADASA
echo ==================================================
echo.

set "ROOT=%CD%"

if not exist "%ROOT%\package.json" (
    echo ERRO: package.json nao encontrado.
    echo.
    echo Coloque este BAT na raiz do projeto,
    echo na mesma pasta do package.json.
    echo.
    pause
    exit /b 1
)

set "TMP_EXPORT=%TEMP%\RadasaPerfilExport"
set "DESKTOP=%USERPROFILE%\Desktop"

if defined OneDrive (
    if exist "%OneDrive%\Desktop" set "DESKTOP=%OneDrive%\Desktop"
)

set "ZIP=%DESKTOP%\Radasa_Arquivos_Perfil.zip"

if exist "%TMP_EXPORT%" rmdir /s /q "%TMP_EXPORT%"
mkdir "%TMP_EXPORT%"

if errorlevel 1 (
    echo ERRO: nao foi possivel criar a pasta temporaria.
    pause
    exit /b 1
)

echo Copiando arquivos necessarios...
echo.

rem ==================================================
rem FRONTEND
rem ==================================================

if exist "%ROOT%\client\src" (
    robocopy "%ROOT%\client\src" "%TMP_EXPORT%\client\src" *.ts *.tsx *.js *.jsx *.css *.scss *.json /E /R:1 /W:1 ^
    /XD node_modules dist build .git coverage __tests__ >nul
)

rem ==================================================
rem BACKEND
rem ==================================================

if exist "%ROOT%\server" (
    robocopy "%ROOT%\server" "%TMP_EXPORT%\server" *.ts *.tsx *.js *.jsx *.json /E /R:1 /W:1 ^
    /XD node_modules dist build .git coverage uploads temp tmp logs >nul
)

rem ==================================================
rem PRISMA E SHARED
rem ==================================================

if exist "%ROOT%\prisma" (
    robocopy "%ROOT%\prisma" "%TMP_EXPORT%\prisma" *.* /E /R:1 /W:1 ^
    /XD node_modules .git >nul
)

if exist "%ROOT%\shared" (
    robocopy "%ROOT%\shared" "%TMP_EXPORT%\shared" *.ts *.tsx *.js *.jsx *.json /E /R:1 /W:1 ^
    /XD node_modules dist build .git >nul
)

rem ==================================================
rem CONFIGURACOES
rem ==================================================

for %%F in (
    package.json
    pnpm-lock.yaml
    package-lock.json
    yarn.lock
    tsconfig.json
    tsconfig.app.json
    tsconfig.node.json
    vite.config.ts
    vite.config.js
    components.json
    tailwind.config.ts
    tailwind.config.js
    postcss.config.js
    postcss.config.cjs
    .env.example
) do (
    if exist "%ROOT%\%%F" (
        copy /Y "%ROOT%\%%F" "%TMP_EXPORT%\" >nul
    )
)

rem Nunca copiar o .env real
if exist "%TMP_EXPORT%\.env" del /f /q "%TMP_EXPORT%\.env"

rem Remover possiveis arquivos sensiveis ou pesados
for /R "%TMP_EXPORT%" %%F in (*.log *.tmp *.cache *.sqlite *.sqlite3 *.db *.pfx *.p12 *.pem *.key) do (
    del /f /q "%%F" >nul 2>&1
)

where tar.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: tar.exe nao foi encontrado no Windows.
    echo Atualize o Windows ou me avise para eu gerar outra versao.
    echo.
    pause
    exit /b 1
)

if not exist "%DESKTOP%" mkdir "%DESKTOP%"

if exist "%ZIP%" del /f /q "%ZIP%"

echo Compactando...
tar.exe -a -c -f "%ZIP%" -C "%TMP_EXPORT%" .

if errorlevel 1 (
    echo.
    echo ==================================================
    echo ERRO: nao foi possivel criar o ZIP
    echo ==================================================
    echo.
    pause
    exit /b 1
)

if not exist "%ZIP%" (
    echo.
    echo ERRO: o processo terminou, mas o ZIP nao foi encontrado.
    echo.
    pause
    exit /b 1
)

echo.
echo ==================================================
echo ZIP criado com sucesso
echo.
echo Arquivo:
echo %ZIP%
echo ==================================================
echo.

explorer.exe /select,"%ZIP%"

pause
