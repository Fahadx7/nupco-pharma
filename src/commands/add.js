'use strict';
const sql = require('../db');

const USAGE = `⚠️ الاستخدام الصحيح:
/add <الاسم> <الباتش> <تاريخ_الانتهاء> [الكمية]

مثال:
/add بانادول BATCH001 2026-05-15 50`;

/**
 * إضافة دواء جديد
 * @param {import('node-telegram-bot-api')} bot
 * @param {object} msg - رسالة تليجرام
 */
async function addMedication(bot, msg) {
    const chatId = msg.chat.id;
    const parts = msg.text.trim().split(/\s+/).slice(1); // حذف /add

    if (parts.length < 3) {
        await bot.sendMessage(chatId, USAGE);
        return;
    }

    const [name, batch, expiryStr, quantityStr] = parts;
    const quantity = parseInt(quantityStr) || 1;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryStr)) {
        await bot.sendMessage(chatId, '❌ صيغة التاريخ خاطئة. استخدم: YYYY-MM-DD\nمثال: 2026-05-15');
        return;
    }

    const expiryDate = new Date(expiryStr);
    if (isNaN(expiryDate.getTime())) {
        await bot.sendMessage(chatId, '❌ التاريخ غير صالح.');
        return;
    }

    try {
        await sql`
            INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, added_by)
            VALUES (${name}, ${batch}, ${expiryDate}, ${quantity}, ${chatId})
        `;

        const exp = expiryDate.toLocaleDateString('en-GB');
        await bot.sendMessage(
            chatId,
            `✅ تم إضافة الدواء بنجاح!\n\n💊 *${name}*\n📦 Batch: ${batch}\n📊 الكمية: ${quantity}\n📅 Exp: ${exp}`,
            { parse_mode: 'Markdown' }
        );
    } catch (err) {
        await bot.sendMessage(chatId, `❌ فشل الإضافة: ${err.message}`);
    }
}

module.exports = { addMedication };
