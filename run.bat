@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
    echo  مكتبات البوت غير مثبتة - يرجى تشغيل install.bat اولاً
    pause & exit /b 1
)

node index.js
pause
