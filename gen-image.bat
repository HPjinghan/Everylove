@echo off
rem Prompt tuning for image generation: double-click to start the local web page
rem (http://127.0.0.1:3939, opens the browser automatically). Close this window to stop.
rem Keep this file pure ASCII: cmd mis-reads batch files with multibyte text (see D-072).
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install it from https://nodejs.org and run again.
  pause
  exit /b 1
)
node scripts\gen-image-server.mjs %*
echo.
echo Server stopped.
pause
