'use strict';
const sql = require('../db');
const { icon } = require('../utils/categorize');

/**
 * عرض المخزون مصنّفاً حسب الفئة
 * @param {import('node-telegram-bot-api')} bot
 * @param {number|string} chatId
 */
async function listMedications(bot, chatId) {
    try {
        const rows = await sql`
            SELECT name, batch, expiry_date, quantity, category
            FROM nupco_inventory
            WHERE status = 'active'
            ORDER BY category, expiry_date ASC
        `;

        if (rows.length === 0) {
            await bot.sendMessage(chatId,
                '📭 المخزون فارغ حالياً.\n\nأضف أدوية عبر:\n📸 /scan — مسح صورة\n➕ /add — إدخال يدوي'
            );
            return;
        }

        // تجميع حسب الفئة
        const grouped = {};
        const today = new Date();
        rows.forEach(r => {
            const cat = r.category || 'أخرى';
            if (!grouped[cat]) grouped[cat] = [];
            const exp      = new Date(r.expiry_date);
            const daysLeft = Math.ceil((exp - today) / 86400000);
            grouped[cat].push({ ...r, daysLeft });
        });

        const parts = [];
        for (const [cat, meds] of Object.entries(grouped)) {
            const lines = meds.map(m => {
                const flag = m.daysLeft <= 7 ? '🔴' : m.daysLeft <= 30 ? '🟡' : '🟢';
                const exp  = new Date(m.expiry_date).toLocaleDateString('en-GB');
                return `  ${flag} ${m.name}\n     📅 ${exp} (${m.daysLeft}د)  📊 ${m.quantity}`;
            });
            parts.push(`${icon(cat)} *${cat}* (${meds.length})\n${lines.join('\n')}`);
        }

        const total   = rows.length;
        const expired = rows.filter(r => new Date(r.expiry_date) < today).length;
        const soon    = rows.filter(r => { const d = Math.ceil((new Date(r.expiry_date)-today)/86400000); return d > 0 && d <= 30; }).length;

        const header = `📋 *مخزون الصيدلية* — ${total} دواء\n🔴 ${expired} منتهي  🟡 ${soon} قريب  🟢 باقي\n\n`;
        const footer = '\n\n🟢 > شهر   🟡 ≤ شهر   🔴 منتهي أو أسبوع';

        // إرسال على دفعات إذا الرسالة طويلة
        const body = parts.join('\n\n');
        if ((header + body + footer).length <= 4000) {
            await bot.sendMessage(chatId, header + body + footer, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, header + footer, { parse_mode: 'Markdown' });
            for (const part of parts) {
                await bot.sendMessage(chatId, part, { parse_mode: 'Markdown' });
            }
        }
    } catch (err) {
        await bot.sendMessage(chatId, `❌ خطأ: ${err.message}`);
    }
}

module.exports = { listMedications };
