'use strict';
const sql = require('../db');

/** @param {'day'|'week'|'month'} frame */
function buildTargetDate(frame) {
    const date = new Date();
    if (frame === 'day')   date.setDate(date.getDate() + 1);
    if (frame === 'week')  date.setDate(date.getDate() + 7);
    if (frame === 'month') date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
}

/** @param {'day'|'week'|'month'} frame */
function frameLabel(frame) {
    return { day: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر' }[frame];
}

/**
 * فحص الأدوية المنتهية الصلاحية وإرسال تنبيه
 * @param {import('node-telegram-bot-api')} bot
 * @param {number|string} chatId
 * @param {'day'|'week'|'month'} frame
 */
async function checkExpiry(bot, chatId, frame = 'month') {
    const targetDate = buildTargetDate(frame);

    try {
        const rows = await sql`
            SELECT name, batch, expiry_date, quantity
            FROM nupco_inventory
            WHERE expiry_date <= ${targetDate}
              AND status = 'active'
            ORDER BY expiry_date ASC
        `;

        if (rows.length === 0) {
            await bot.sendMessage(chatId, `✅ لا توجد أدوية تنتهي صلاحيتها ${frameLabel(frame)}.`);
            return;
        }

        const lines = rows.map(r => {
            const exp = new Date(r.expiry_date).toLocaleDateString('en-GB');
            const batch = r.batch || 'غير محدد';
            return `🔹 *${r.name}*\n   📦 Batch: ${batch}  |  📊 الكمية: ${r.quantity}\n   📅 Exp: ${exp}`;
        });

        const header = `💊 *أدوية تنتهي ${frameLabel(frame)}* (${rows.length} دواء)\n\n`;
        await bot.sendMessage(chatId, header + lines.join('\n\n'), { parse_mode: 'Markdown' });
    } catch (err) {
        await bot.sendMessage(chatId, `❌ خطأ في قاعدة البيانات: ${err.message}`);
    }
}

module.exports = { checkExpiry };
