@echo off
cd /d "%~dp0backend"
start "Backend" cmd /k "node src/index.js"
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npx vite"
timeout /t 3 /nobreak >nul
start http://localhost:5173