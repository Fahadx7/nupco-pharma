@echo off
cd /d "%~dp0"

echo.
echo  ============================================
echo   NupcoPharma Bot - Setup
echo  ============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [1/2] Downloading Node.js...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node_setup.msi' -UseBasicParsing"
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: Failed to download Node.js
        echo  Check internet connection and run install.bat again
        pause & exit /b 1
    )
    echo  [1/2] Installing Node.js...
    msiexec /i "%TEMP%\node_setup.msi" /quiet /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs"
    echo  [1/2] Node.js installed OK
) else (
    for /f "tokens=*" %%i in ('node --version') do echo  [1/2] Node.js %%i OK
)

:: Install packages
echo  [2/2] Installing packages - please wait 2-5 min...
call npm install --silent 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: npm install failed
    echo  Check internet and run install.bat again
    pause & exit /b 1
)
echo  [2/2] Packages installed OK

echo.
echo  ============================================
echo   Done! Now run: run.bat
echo  ============================================
echo.
pause
