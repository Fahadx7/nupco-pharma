'use strict';
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// مجلد Startup في Windows
const STARTUP_DIR = path.join(
    os.homedir(),
    'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);

const VBS_NAME = 'nupco-pharma.vbs';
const VBS_PATH = path.join(STARTUP_DIR, VBS_NAME);

/**
 * يُضاف البرنامج لقائمة بدء التشغيل عبر VBScript
 * (VBScript يشغّل البرنامج بدون نافذة CMD)
 */
function enableAutoStart() {
    try {
        if (!fs.existsSync(STARTUP_DIR)) return false;

        const exePath  = process.execPath.replace(/\\/g, '\\\\');
        const workDir  = process.cwd().replace(/\\/g, '\\\\');

        const vbs = [
            'Set objShell = CreateObject("WScript.Shell")',
            `objShell.CurrentDirectory = "${workDir}"`,
            `objShell.Run """${exePath}""", 0, False`,
        ].join('\r\n');

        fs.writeFileSync(VBS_PATH, vbs, 'utf8');
        return true;
    } catch {
        return false;
    }
}

/** إلغاء التشغيل التلقائي */
function disableAutoStart() {
    try {
        if (fs.existsSync(VBS_PATH)) fs.unlinkSync(VBS_PATH);
        return true;
    } catch {
        return false;
    }
}

/** هل التشغيل التلقائي مفعّل؟ */
function isAutoStartEnabled() {
    return fs.existsSync(VBS_PATH);
}

/**
 * إشعار Windows Balloon عند بدء التشغيل (بدون مكتبات إضافية)
 * يستخدم PowerShell المدمج في Windows
 */
function showStartupNotification(pharmacyName) {
    const { exec } = require('child_process');
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipTitle = 'نوبكو فارما'
$notify.BalloonTipText  = '${pharmacyName} — البوت يعمل الآن ✓'
$notify.Visible = $true
$notify.ShowBalloonTip(4000)
Start-Sleep -Seconds 5
$notify.Dispose()
`.trim();

    exec(`powershell -NoProfile -WindowStyle Hidden -Command "${ps.replace(/\n/g, ';').replace(/"/g, '\\"')}"`,
        { windowsHide: true },
        () => {} // تجاهل الأخطاء — الإشعار اختياري
    );
}

module.exports = { enableAutoStart, disableAutoStart, isAutoStartEnabled, showStartupNotification };
