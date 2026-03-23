@echo off
title AI 3D Card Generator
cd /d "%~dp0"

echo.
echo  AI 3D Card Generator
echo  ========================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Please install it from https://nodejs.org/ ^(v18 or higher^)
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%i in ('node -v') do set NODE_VER=%%i
set NODE_VER=%NODE_VER:v=%
if %NODE_VER% lss 18 (
    echo  [ERROR] Node.js v18 or higher is required.
    echo  Please update from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js found

:: Install dependencies if needed
if not exist "node_modules" (
    echo  Installing dependencies ^(first run only^)...
    call npm install
    echo.
)

echo  Starting server...
echo  The app will open in your browser automatically.
echo  To stop: close this window or press Ctrl+C
echo.

:: Open browser after delay
start /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

:: Start the app
call npm run dev
