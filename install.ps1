# install.ps1
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  💊 نوبكو فارما - تثبيت نظام إدارة الأدوية" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
try { $nodeVersion = node --version; Write-Host "✅ Node.js موجود: $nodeVersion" -ForegroundColor Green }
catch { Write-Host "❌ Node.js غير مثبت. يرجى تثبيته من https://nodejs.org/" -ForegroundColor Red; Read-Host "اضغط Enter"; exit 1 }
Write-Host "`n📦 تثبيت المكتبات..." -ForegroundColor Yellow; npm install --silent
New-Item -ItemType Directory -Force -Path "uploads","temp_images" | Out-Null
Start-Process "http://localhost:3000"
Write-Host "`n✅ التثبيت اكتمل. سيبدأ البوت..." -ForegroundColor Green
node index.js
