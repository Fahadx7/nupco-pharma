'use strict';
const sql = require('../db');

const USAGE = `⚠️ الاستخدام الصحيح:
/add <الاسم> <الباتش> <تاريخ_الانتهاء> [الكمية]

مثال:
/add بانادول BATCH001 2026-05-15 50`;

/**
 * دالة الإضافة الأساسية (تُستخدم من الأمر /add ومن الـ scan)
 * @param {number} chatId - معرف المستخدم
 * @param {string} name - اسم الدواء
 * @param {string} batch - رقم الباتش (إذا لم يكن موجوداً نضع 'N/A')
 * @param {string} expiryDate - تاريخ الصلاحية بصيغة YYYY-MM-DD
 * @param {number} quantity - الكمية
 * @returns {Promise<boolean>} - نجاح أم لا
 */
async function addMedicationToDB(chatId, name, batch, expiryDate, quantity) {
    try {
        await sql`
            INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, added_by)
            VALUES (${name}, ${batch}, ${expiryDate}, ${quantity}, ${chatId})
        `;
        return true;
    } catch (err) {
        console.error('❌ فشل إضافة إلى DB:', err.message);
        return false;
    }
}

/**
 * معالج الأمر /add (يتوقع msg كامل)
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

    if (isNaN(new Date(expiryStr).getTime())) {
        await bot.sendMessage(chatId, '❌ التاريخ غير صالح.');
        return;
    }

    const success = await addMedicationToDB(chatId, name, batch, expiryStr, quantity);
    if (success) {
        const exp = new Date(expiryStr).toLocaleDateString('en-GB');
        await bot.sendMessage(
            chatId,
            `✅ تم إضافة الدواء بنجاح!\n\n💊 *${name}*\n📦 Batch: ${batch}\n📊 الكمية: ${quantity}\n📅 Exp: ${exp}`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await bot.sendMessage(chatId, `❌ فشل الإضافة: خطأ في قاعدة البيانات.`);
    }
}

module.exports = { addMedication, addMedicationToDB };