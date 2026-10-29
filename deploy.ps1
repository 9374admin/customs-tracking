# Deploy script for customs-tracking on Windows Server
Write-Host "===== Step 1: Download Node.js 22 LTS ====="
$nodeUrl = "https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
$nodeMsi = "$env:TEMP\node-install.msi"
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
Write-Host "Installing Node.js..."
Start-Process msiexec.exe -ArgumentList "/i",$nodeMsi,"/quiet","/norestart" -Wait
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
Write-Host "Node.js installed."

Write-Host "===== Step 2: Download code from GitHub ====="
$codeUrl = "https://github.com/9374admin/customs-tracking/archive/refs/heads/main.zip"
$codeZip = "$env:TEMP\customs.zip"
Invoke-WebRequest -Uri $codeUrl -OutFile $codeZip -UseBasicParsing
Write-Host "Extracting code..."
Expand-Archive -Path $codeZip -DestinationPath "C:\customs-tracking-temp" -Force
if (Test-Path "C:\customs-tracking") { Remove-Item "C:\customs-tracking" -Recurse -Force }
Move-Item "C:\customs-tracking-temp\customs-tracking-main" "C:\customs-tracking" -Force
Remove-Item "C:\customs-tracking-temp" -Recurse -Force
Write-Host "Code extracted to C:\customs-tracking"

Write-Host "===== Step 3: Install backend dependencies ====="
Set-Location "C:\customs-tracking\backend"
npm.cmd install
Write-Host "Backend dependencies installed."

Write-Host "===== Step 4: Verify frontend dist ====="
if (Test-Path "C:\customs-tracking\frontend\dist\index.html") {
    Write-Host "Frontend dist exists."
} else {
    Write-Host "Frontend dist missing - downloading from GitHub..."
    Invoke-WebRequest -Uri "https://github.com/9374admin/customs-tracking/archive/refs/heads/main.zip" -OutFile "$env:TEMP\customs2.zip" -UseBasicParsing
    Expand-Archive -Path "$env:TEMP\customs2.zip" -DestinationPath "C:\customs-temp2" -Force
    Copy-Item -Path "C:\customs-temp2\customs-tracking-main\frontend\dist" -Destination "C:\customs-tracking\frontend\dist" -Recurse -Force
    Remove-Item "C:\customs-temp2" -Recurse -Force
    Write-Host "Frontend dist downloaded."
}

Write-Host "===== Step 5: Open firewall ports ====="
netsh advfirewall firewall add rule name="NodeJS Port 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="NodeJS Port 80" dir=in action=allow protocol=TCP localport=80
Write-Host "Firewall opened."

Write-Host "===== Step 6: Create startup script ====="
$startup = @'
@echo off
cd /d "C:\customs-tracking\backend"
set NODE_ENV=production
node src/index.js
pause
'@
Set-Content -Path "C:\customs-tracking\start.bat" -Value $startup
Write-Host "Startup script created at C:\customs-tracking\start.bat"

Write-Host "===== Step 7: Start server ====="
Set-Location "C:\customs-tracking\backend"
$env:NODE_ENV = "production"
Start-Process cmd -ArgumentList "/c node src/index.js" -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "===== DEPLOY COMPLETE ====="
Write-Host "Access your app at: http://139.199.231.185:3000"
Write-Host "Login: admin / admin123"
Write-Host ""
Write-Host "To restart server later, double-click C:\customs-tracking\start.bat"
