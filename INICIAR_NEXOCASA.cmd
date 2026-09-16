@echo off
setlocal
cd /d "%~dp0"
title NexoCasa - servidor local

echo.
echo ==================================================
echo   NexoCasa - ambiente local de testes
echo ==================================================
echo.

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:4173/dashboard'; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  echo O NexoCasa ja esta em execucao. Abrindo o painel...
  start "" "http://localhost:4173/dashboard"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Node.js nao foi encontrado neste computador.
  echo Instale o Node.js 22.13 ou mais recente antes de continuar.
  echo Consulte o arquivo INDEX.md para mais detalhes.
  echo.
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 (
  echo [ERRO] Esta versao do Node.js e antiga demais.
  echo Versao atual:
  node --version
  echo Instale o Node.js 22.13 ou mais recente.
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O pnpm nao foi encontrado neste computador.
  echo Instale o Node.js e o pnpm antes de iniciar o NexoCasa.
  echo Consulte o arquivo INDEX.md para mais detalhes.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.pnpm" (
  echo Instalando as dependencias do projeto pela primeira vez...
  call pnpm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo O navegador sera aberto em alguns segundos.
echo Mantenha esta janela aberta enquanto estiver usando o aplicativo.
echo Para encerrar, volte a esta janela e pressione Ctrl+C.
echo.
echo Endereco: http://localhost:4173/dashboard
echo.

start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:4173/dashboard'"
call pnpm run dev:local

echo.
echo O servidor local foi encerrado.
pause
