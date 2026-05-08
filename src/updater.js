'use strict';
const https = require('https');

const CURRENT_VERSION = '5.10';
const REPO = 'fahadx7/nupco-pharma';

function fetchLatestRelease() {
    return new Promise((resolve, reject) => {
        const req = https.get({
            hostname: 'api.github.com',
            path: `/repos/${REPO}/releases/latest`,
            headers: { 'User-Agent': `NupcoPharma/${CURRENT_VERSION}` }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('parse')); }
            });
        });
        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function checkForUpdate(bot, chatId) {
    try {
        const release = await fetchLatestRelease();
        const latest = (release.tag_name || '').replace(/^v/, '').trim();
        if (!latest || latest === CURRENT_VERSION) return;

        const exeAsset = release.assets?.find(a => a.name.endsWith('.exe'));
        const url = exeAsset?.browser_download_url
            || `https://github.com/${REPO}/releases/latest`;

        await bot.sendMessage(chatId,
            `🆕 *يوجد إصدار جديد من نوبكو فارما!*\n\n` +
            `الإصدار الحالي: \`v${CURRENT_VERSION}\`\n` +
            `الإصدار الجديد: \`v${latest}\`\n\n` +
            `⬇️ [تحميل التحديث](${url})\n\n` +
            `_حمّل الملف وشغّله كمسؤول للتحديث_`,
            { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
    } catch {
        // لا إنترنت أو GitHub غير متاح
    }
}

module.exports = { checkForUpdate, CURRENT_VERSION };
