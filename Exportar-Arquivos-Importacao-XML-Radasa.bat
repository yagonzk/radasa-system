@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Exportar arquivos da importacao XML - Radasa

set "ROOT=%CD%"
if not exist "%ROOT%\package.json" (
  echo ERRO: coloque este BAT na raiz do projeto, junto do package.json.
  pause
  exit /b 1
)

set "TMP=%TEMP%\Radasa_Importacao_XML_Arquivos"
set "DESKTOP=%USERPROFILE%\Desktop"
if defined OneDrive if exist "%OneDrive%\Desktop" set "DESKTOP=%OneDrive%\Desktop"
set "ZIP=%DESKTOP%\Radasa_Arquivos_Importacao_XML.zip"

if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"

call :copyfile "client\src\pages\Abastecimentos.tsx"
call :copyfile "client\src\lib\api.ts"
call :copyfile "client\src\lib\store.ts"
call :copyfile "server\routes\abastecimentos-xml.routes.ts"
call :copyfile "server\routes\abastecimentos.routes.ts"
call :copyfile "server\services\abastecimento-xml.service.ts"
call :copyfile "server\services\abastecimentos.service.ts"
call :copyfile "server\controllers\abastecimentos.controller.ts"
call :copyfile "server\lib\prisma.ts"
call :copyfile "server\config\env.ts"
call :copyfile "server\app.ts"
call :copyfile "server\index.ts"
call :copyfile "prisma\schema.prisma"
call :copyfile "package.json"
call :copyfile "tsconfig.json"
call :copyfile "vite.config.ts"

(
  echo Arquivos para ajustar:
  echo - limite de 1000 XMLs
  echo - envio em lotes
  echo - timeout de 10 minutos
  echo - progresso e tratamento de falhas
) > "%TMP%\LEIA-ME.txt"

where tar.exe >nul 2>&1
if errorlevel 1 (
  echo ERRO: tar.exe nao encontrado no Windows.
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
if not exist "%ROOT%\%REL%" (
  echo [NAO ENCONTRADO] %REL%
  goto :eof
)
for %%D in ("%TMP%\%REL%") do if not exist "%%~dpD" mkdir "%%~dpD"
copy /Y "%ROOT%\%REL%" "%TMP%\%REL%" >nul
echo [OK] %REL%
goto :eof
