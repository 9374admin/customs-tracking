@echo off
title Customs Tracking Deployment
echo ============================================
echo   Customs Tracking - Auto Deployment
echo ============================================
echo.

echo [1/7] Downloading Node.js 22 LTS...
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi' -OutFile '%TEMP%\node-install.msi' -UseBasicParsing"
if exist "%TEMP%\node-install.msi" (
    echo Installing Node.js...
    msiexec /i "%TEMP%\node-install.msi" /quiet /norestart
    echo Node.js installed.
) else (
    echo ERROR: Failed to download Node.js
    pause
    exit /b 1
)

echo.
echo [2/7] Downloading code from GitHub...
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/9374admin/customs-tracking/archive/refs/heads/main.zip' -OutFile '%TEMP%\customs.zip' -UseBasicParsing"
if exist "%TEMP%\customs.zip" (
    powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%TEMP%\customs.zip' -DestinationPath 'C:\customs-temp' -Force"
    if exist "C:\customs-tracking" rd /s /q "C:\customs-tracking"
    move /Y "C:\customs-temp\customs-tracking-main" "C:\customs-tracking"
    if exist "C:\customs-temp" rd /s /q "C:\customs-temp"
    echo Code extracted to C:\customs-tracking
) else (
    echo ERROR: Failed to download code
    pause
    exit /b 1
)

echo.
echo [3/7] Installing backend dependencies...
cd /d "C:\customs-tracking\backend"
set "PATH=C:\Program Files\nodejs;%PATH%"
call npm install
if errorlevel 1 (
    echo ERROR: Backend npm install failed
    pause
    exit /b 1
)
echo Backend dependencies installed.

echo.
echo [4/7] Installing frontend dependencies and building...
cd /d "C:\customs-tracking\frontend"
call npm install
if errorlevel 1 (
    echo ERROR: Frontend npm install failed
    pause
    exit /b 1
)
call npx vite build
if errorlevel 1 (
    echo ERROR: Frontend build failed
    pause
    exit /b 1
)
echo Frontend built successfully.

echo.
echo [5/7] Opening firewall port 3000...
netsh advfirewall firewall add rule name="NodeJS Port 3000" dir=in action=allow protocol=TCP localport=3000
echo Firewall port 3000 opened.

echo.
echo [6/7] Creating startup script...
echo @echo off > C:\customs-tracking\start-server.bat
echo cd /d "C:\customs-tracking\backend" >> C:\customs-tracking\start-server.bat
echo set NODE_ENV=production >> C:\customs-tracking\start-server.bat
echo node src/index.js >> C:\customs-tracking\start-server.bat
echo Startup script created at C:\customs-tracking\start-server.bat

echo.
echo [7/7] Starting server...
cd /d "C:\customs-tracking\backend"
set NODE_ENV=production
start /min cmd /c "node src/index.js"
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   DEPLOY COMPLETE!
echo ============================================
echo.
echo   Access: http://139.199.231.185:3000
echo   Login:  admin / admin123
echo.
echo   To restart later: double-click
echo   C:\customs-tracking\start-server.bat
echo ============================================
echo.
pause