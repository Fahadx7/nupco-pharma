'use strict';
const cron = require('node-cron');
const sql  = require('./db');
const { icon } = require('./utils/categorize');

/**
 * يبني تقرير الأدوية القريبة الانتهاء مصنّفاً حسب الفئة
 */
async function buildDailyReport() {
    const today    = new Date();
    const in30days = new Date();
    in30days.setDate(today.getDate() + 30);
    const in30str  = in30days.toISOString().split('T')[0];

    const rows = await sql`
        SELECT name, batch, expiry_date, quantity, category
        FROM nupco_inventory
        WHERE expiry_date <= ${in30str}
          AND status = 'active'
        ORDER BY expiry_date ASC
    `;

    if (rows.length === 0) return null;

    // تجميع حسب الفئة
    const grouped = {};
    rows.forEach(r => {
        const cat = r.category || 'أخرى';
        if (!grouped[cat]) grouped[cat] = [];
        const daysLeft = Math.ceil((new Date(r.expiry_date) - today) / 86400000);
        grouped[cat].push({ ...r, daysLeft });
    });

    const dateStr = today.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let msg = `📊 *تقرير الصيدلية اليومي*\n📅 ${dateStr}\n`;
    msg += `⚠️ ${rows.length} دواء تنتهي خلال 30 يوماً\n\n`;

    for (const [cat, meds] of Object.entries(grouped)) {
        msg += `${icon(cat)} *${cat}* (${meds.length}):\n`;
        meds.forEach(m => {
            const flag = m.daysLeft <= 0 ? '🔴 منتهي' : m.daysLeft <= 7 ? `🔴 ${m.daysLeft} أيام` : `🟡 ${m.daysLeft} يوم`;
            const exp  = new Date(m.expiry_date).toLocaleDateString('en-GB');
            msg += `  • ${m.name} — ${exp} (${flag})\n`;
        });
        msg += '\n';
    }

    return msg;
}

/**
 * جدولة تقرير يومي الساعة 9 صباحاً (توقيت الرياض = 6 UTC)
 */
function startDailyScheduler(bot, chatId) {
    cron.schedule('0 6 * * *', async () => {
        try {
            const report = await buildDailyReport();
            if (report) {
                await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
            } else {
                await bot.sendMessage(chatId, '✅ لا توجد أدوية تنتهي خلال 30 يوماً.');
            }
        } catch (err) {
            await bot.sendMessage(chatId, `❌ خطأ في التقرير اليومي: ${err.message}`);
        }
    }, { timezone: 'UTC' });
}

module.exports = { startDailyScheduler, buildDailyReport };
