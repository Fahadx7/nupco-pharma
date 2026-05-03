@echo off
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%temp%\node_setup.msi'"
msiexec /i "%temp%\node_setup.msi" /quiet /norestart
