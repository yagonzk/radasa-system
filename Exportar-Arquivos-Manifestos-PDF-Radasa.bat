@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Exportar arquivos do importador PDF de Manifestos - Radasa

set "ROOT=%CD%"
if not exist "%ROOT%\package.json" (
  echo ERRO: coloque este BAT na raiz do projeto, junto do package.json.
  pause
  exit /b 1
)

set "TMP=%TEMP%\Radasa_Manifestos_PDF_Arquivos"
set "DESKTOP=%USERPROFILE%\Desktop"
if defined OneDrive if exist "%OneDrive%\Desktop" set "DESKTOP=%OneDrive%\Desktop"
set "ZIP=%DESKTOP%\Radasa_Arquivos_Manifestos_PDF.zip"

if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"

call :copyfile "client\src\pages\Manifestos.tsx"
call :copyfile "client\src\pages\Manifesto.tsx"
call :copyfile "client\src\pages\ManifestoGerar.tsx"
call :copyfile "client\src\pages\ManifestosGerar.tsx"
call :copydir "client\src\components\manifestos"
call :copyfile "client\src\components\Layout.tsx"
call :copyfile "client\src\lib\api.ts"
call :copyfile "client\src\lib\store.ts"
call :copyfile "client\src\App.tsx"

call :copyfile "server\routes\manifestos.routes.ts"
call :copyfile "server\routes\manifesto.routes.ts"
call :copyfile "server\controllers\manifestos.controller.ts"
call :copyfile "server\controllers\manifesto.controller.ts"
call :copyfile "server\services\manifestos.service.ts"
call :copyfile "server\services\manifesto.service.ts"
call :copyfile "server\validators\schemas.ts"
call :copyfile "server\app.ts"
call :copyfile "server\index.ts"
call :copyfile "server\lib\prisma.ts"
call :copyfile "server\config\env.ts"

call :copyfile "prisma\schema.prisma"
call :copyfile "package.json"
call :copyfile "pnpm-lock.yaml"
call :copyfile "tsconfig.json"
call :copyfile "vite.config.ts"
call :copyfile ".env.example"

for /R "%ROOT%\client\src" %%F in (*Manifesto*.ts *Manifesto*.tsx *manifesto*.ts *manifesto*.tsx) do call :copyabsolute "%%~fF"
for /R "%ROOT%\server" %%F in (*Manifesto*.ts *manifesto*.ts) do call :copyabsolute "%%~fF"

(
  echo Arquivos para implementar o importador PDF de Manifestos.
  echo O .env real, node_modules, certificados e bancos locais nao foram incluidos.
) > "%TMP%\LEIA-ME.txt"

where tar.exe >nul 2>&1
if errorlevel 1 (
  echo ERRO: tar.exe nao encontrado.
  pause
  exit /b 1
)

if exist "%ZIP%" del /f /q "%ZIP%"
tar.exe -a -c -f "%ZIP%" -C "%TMP%" .

if errorlevel 1 (
  echo ERRO ao criar o ZIP.
  pause
  exit /b 1
)

echo.
echo ZIP criado:
echo %ZIP%
explorer.exe /select,"%ZIP%"
pause
exit /b 0

:copyfile
set "REL=%~1"
if not exist "%ROOT%\%REL%" goto :eof
for %%D in ("%TMP%\%REL%") do if not exist "%%~dpD" mkdir "%%~dpD"
copy /Y "%ROOT%\%REL%" "%TMP%\%REL%" >nul
echo [OK] %REL%
goto :eof

:copydir
set "REL=%~1"
if not exist "%ROOT%\%REL%" goto :eof
robocopy "%ROOT%\%REL%" "%TMP%\%REL%" *.ts *.tsx *.js *.jsx *.css *.json /E /R:1 /W:1 >nul
echo [OK] %REL%
goto :eof

:copyabsolute
set "ABS=%~1"
set "REL=%ABS:%ROOT%\=%"
if "%REL%"=="%ABS%" goto :eof
for %%D in ("%TMP%\%REL%") do if not exist "%%~dpD" mkdir "%%~dpD"
copy /Y "%ABS%" "%TMP%\%REL%" >nul 2>&1
goto :eof
