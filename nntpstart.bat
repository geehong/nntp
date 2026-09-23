@echo off
chcp 65001 >nul
echo ==================================================
echo       NNTP Web Client - Local Windows Mode
echo ==================================================
echo.

echo [1/4] Stopping existing processes and freeing port 3001...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING 2^>nul') do taskkill /F /PID %%a >nul 2>&1
call docker-compose down >nul 2>&1
echo.

if not exist "node_modules\" (
    echo [2/4] Installing dependencies - npm install...
    call npm install
    echo.
) else (
    echo [2/4] Dependencies already installed. Skipping.
)

if not exist "dist\" (
    echo [3/4] Building frontend UI - npm run build...
    call npm run build
    echo.
) else (
    echo [3/4] Frontend UI already built. Skipping.
)

echo [4/4] Starting NNTP Backend Server natively...
echo ==================================================
echo [*] The app will be available at http://localhost:3001
echo [*] To access local drives (C:\, D:\), open Settings in the browser.
echo [!] Press Ctrl+C in this window to stop the server.
echo ==================================================
echo.

node server.js
pause
