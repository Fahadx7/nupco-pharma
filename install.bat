@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ===========================================
echo    NupcoPharma - اعداد البرنامج
echo  ===========================================
echo.

:: التحقق من Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [1/2] Node.js غير موجود - جاري التحميل...
    powershell -NoProfile -Command ^
      "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node_setup.msi' -UseBasicParsing"
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: تعذر تحميل Node.js
        echo  تأكد من اتصال الإنترنت وأعد تشغيل install.bat
        pause & exit /b 1
    )
    echo  [1/2] جاري تثبيت Node.js...
    msiexec /i "%TEMP%\node_setup.msi" /quiet /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs"
    echo  [1/2] تم تثبيت Node.js
) else (
    echo  [1/2] Node.js موجود
)

:: تثبيت مكتبات البوت
echo  [2/2] جاري تثبيت مكتبات البوت...
echo        (قد يستغرق 2-5 دقائق - يرجى الانتظار)
call npm install --silent 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: فشل تثبيت المكتبات
    echo  تأكد من اتصال الإنترنت وأعد المحاولة
    pause & exit /b 1
)
echo  [2/2] تم تثبيت المكتبات

echo.
echo  ===========================================
echo    تم الاعداد بنجاح
echo    الخطوة التالية: شغّل run.bat
echo  ===========================================
echo.
pause
