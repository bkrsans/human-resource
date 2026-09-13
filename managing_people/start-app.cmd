@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm was not found. Open this project in Codex and run: pnpm dev
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call pnpm install
  if errorlevel 1 goto :failed
)

if not exist "dist\client\index.html" (
  echo Creating the production build...
  call pnpm build
  if errorlevel 1 goto :failed
)

echo Starting Project Combination Engine...
if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=4173"
start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\open-app.ps1" -Port %PORT%
set "NODE_ENV=production"
call pnpm start
exit /b %errorlevel%

:failed
echo.
echo The app could not be prepared. Review the message above.
pause
exit /b 1
