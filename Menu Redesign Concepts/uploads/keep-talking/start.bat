@echo off
title Keep Talking 3D Local Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

echo Starting Keep Talking 3D... open http://localhost:3020
echo Press Ctrl+C to stop.
echo.
start "" http://localhost:3020
node src/server.js
pause
