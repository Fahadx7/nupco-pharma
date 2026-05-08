@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
    echo Run install.bat first!
    pause & exit /b 1
)

node index.js
pause
