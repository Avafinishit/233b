@echo off
cd /d "%~dp0"
echo Starting BHT server on http://localhost:5500
node scripts\start-server.js 5500
pause
