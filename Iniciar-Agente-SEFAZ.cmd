@echo off
cd /d "%~dp0"
title Radasa - Agente SEFAZ
where pnpm >nul 2>nul
if errorlevel 1 (
  echo ERRO: pnpm nao encontrado.
  echo Instale com: npm install -g pnpm
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias do projeto...
  call pnpm install
  if errorlevel 1 pause & exit /b 1
)
if not exist dist-sefaz-agent\index.js (
  echo Compilando Agente SEFAZ...
  call pnpm run build:sefaz-agent
  if errorlevel 1 pause & exit /b 1
)
echo.
echo ========================================
echo   RADASA - AGENTE SEFAZ LOCAL
ECHO ========================================
echo O computador deve permanecer ligado para buscar NF-e.
echo Para encerrar, pressione CTRL+C.
echo.
call pnpm run start:sefaz-agent
pause
