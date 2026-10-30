@echo off
title Customs Tracking Server
cd /d "C:\customs-tracking\backend"

echo Checking node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm.cmd install
)

echo Starting server...
set NODE_ENV=production
node src/index.js
pause