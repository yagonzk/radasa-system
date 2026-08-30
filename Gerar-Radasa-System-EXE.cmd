@echo off
setlocal
cd /d "%~dp0desktop-app"
echo ========================================
echo   RADASA SYSTEM - GERADOR DO APP .EXE
echo ========================================
echo.
echo Instalando dependencias do aplicativo Windows...
call npm install
if errorlevel 1 goto erro

echo.
echo Gerando instalador .EXE...
call npm run build
if errorlevel 1 goto erro

echo.
echo Concluido. O instalador esta em:
echo %CD%\dist
start "" "%CD%\dist"
pause
exit /b 0

:erro
echo.
echo Ocorreu um erro ao gerar o aplicativo.
pause
exit /b 1
