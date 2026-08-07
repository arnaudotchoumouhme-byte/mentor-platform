@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo ERREUR : Node.js est absent du PATH Windows.
  echo Installez Node.js 24 ou plus recent, puis rouvrez cette fenetre :
  echo winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

node scripts\check-node-version.mjs
if errorlevel 1 (
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo ERREUR : pnpm et Corepack sont absents.
    pause
    exit /b 1
  )
  call corepack prepare pnpm@11.9.0 --activate
  if errorlevel 1 exit /b 1
)

if not exist "node_modules" (
  echo Installation des dependances...
  call pnpm install --frozen-lockfile
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Demarrage de Mentor PEBC sur http://localhost:3000
echo Gardez cette fenetre ouverte. Ctrl+C arrete l'application.
call pnpm dev
