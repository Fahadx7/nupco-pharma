'use strict';
/**
 * نظام التحديث التلقائي — نوبكو فارما
 * يتحقق من GitHub كل ساعة، يُشعر المستخدم في الواجهة وتيليجرام
 */
const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const VERSION_URL  = 'https://raw.githubusercontent.com/Fahadx7/nupco-pharma/main/version.json';
const LOCAL_VER    = require('../package.json').version;
const PUBLIC_DIR   = path.join(__dirname, '../public');
const CHECK_INTERVAL = 60 * 60 * 1000; // كل ساعة

let _latestInfo    = null;
let _updateAvailable = false;
let _bot           = null;
let _chatId        = null;
let _notifiedTg    = false; // لا نرسل إشعار تيليجرام أكثر من مرة لنفس الإصدار

function init(bot, chatId) {
    _bot    = bot;
    _chatId = chatId;
    checkForUpdate(true); // فحص فوري عند التشغيل
    setInterval(checkForUpdate, CHECK_INTERVAL);
}

function semverGt(a, b) {
    const pa = a.replace(/[^\d.]/g,'').split('.').map(Number);
    const pb = b.replace(/[^\d.]/g,'').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i]||0) - (pb[i]||0);
        if (diff > 0) return true;
        if (diff < 0) return false;
    }
    return false;
}

async function checkForUpdate(silent = false) {
    try {
        const info = await fetchJson(VERSION_URL);
        _latestInfo = info;
        _updateAvailable = semverGt(info.version, LOCAL_VER);

        if (_updateAvailable) {
            console.log(`🔔 تحديث متاح: v${LOCAL_VER} → v${info.version}`);
            // إشعار تيليجرام (مرة واحدة فقط لنفس الإصدار)
            if (_bot && _chatId && !_notifiedTg) {
                _notifiedTg = true;
                const msg = [
                    `🆕 *تحديث نوبكو فارما متاح!*`,
                    ``,
                    `الإصدار الحالي: \`v${LOCAL_VER}\``,
                    `الإصدار الجديد: \`v${info.version}\``,
                    ``,
                    `*ما الجديد:*`,
                    ...(info.changelog||[]).map(c => `• ${c}`),
                    ``,
                    `افتح لوحة التحكم وانقر *"تحديث الآن"* أو شغّل:`,
                    `\`\`\``,
                    `cd nupco-pharma && npm run update`,
                    `\`\`\``,
                ].join('\n');
                try { await _bot.sendMessage(_chatId, msg, { parse_mode:'Markdown' }); }
                catch (e) { console.warn('⚠️ تيليجرام:', e.message); }
            }
        } else if (!silent) {
            console.log(`✅ الإصدار محدّث: v${LOCAL_VER}`);
        }
    } catch (e) {
        if (!silent) console.warn('⚠️ فحص التحديث فشل:', e.message);
    }
}

async function applyUpdate(res) {
    if (!_updateAvailable || !_latestInfo) {
        return res.json({ success: false, message: 'لا توجد تحديثات' });
    }
    try {
        res.json({ success: true, message: `جاري التحديث إلى v${_latestInfo.version}...` });

        // تحميل الملفات المحدّثة
        const files = [
            { url: 'https://raw.githubusercontent.com/Fahadx7/nupco-pharma/main/public/index.html',
              dest: path.join(PUBLIC_DIR, 'index.html') },
            { url: 'https://raw.githubusercontent.com/Fahadx7/nupco-pharma/main/src/status.js',
              dest: path.join(__dirname, 'status.js') },
            { url: 'https://raw.githubusercontent.com/Fahadx7/nupco-pharma/main/package.json',
              dest: path.join(__dirname, '../package.json') },
        ];

        for (const f of files) {
            const content = await fetchText(f.url);
            fs.writeFileSync(f.dest, content, 'utf8');
            console.log('✅ Updated:', path.basename(f.dest));
        }

        // إشعار تيليجرام
        if (_bot && _chatId) {
            try {
                await _bot.sendMessage(_chatId,
                    `✅ *نوبكو فارما* تم التحديث إلى \`v${_latestInfo.version}\`\n\nأعد تشغيل السيرفر لتفعيل التحديث.`,
                    { parse_mode:'Markdown' }
                );
            } catch {}
        }

        console.log(`✅ التحديث اكتمل. أعد تشغيل السيرفر.`);
        setTimeout(() => process.exit(0), 2000); // أعد التشغيل
    } catch (e) {
        console.error('❌ فشل التحديث:', e.message);
    }
}

function getStatus() {
    return {
        current:   LOCAL_VER,
        latest:    _latestInfo?.version || LOCAL_VER,
        available: _updateAvailable,
        changelog: _latestInfo?.changelog || [],
        critical:  _latestInfo?.critical || false,
    };
}

// ── HTTP Helpers ──────────────────────────────────────────────
function fetchJson(url) {
    return new Promise((res, rej) => {
        https.get(url, { timeout: 10000 }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => { try { res(JSON.parse(d)); } catch(e){ rej(e); } });
        }).on('error', rej).on('timeout', () => rej(new Error('timeout')));
    });
}
function fetchText(url) {
    return new Promise((res, rej) => {
        https.get(url, { timeout: 30000 }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => res(d));
        }).on('error', rej).on('timeout', () => rej(new Error('timeout')));
    });
}

module.exports = { init, checkForUpdate, applyUpdate, getStatus };
