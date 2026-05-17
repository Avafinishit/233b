@echo off
cd /d "%~dp0"
echo Starting BHT server on http://localhost:3000
node scripts\start-server.js 3000
pause
