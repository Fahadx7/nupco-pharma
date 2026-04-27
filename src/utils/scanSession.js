'use strict';

/**
 * مدير جلسات المسح — يتتبع حالة كل مستخدم أثناء مسح علبة دواء
 * الحالات:
 *   'await_name_photo'   — ينتظر صورة اسم الدواء
 *   'await_expiry_photo' — ينتظر صورة تاريخ الانتهاء
 *   'await_confirm'      — ينتظر تأكيد الحفظ
 */

const sessions = new Map();

function create(chatId, mode) {
    sessions.set(chatId, { mode, step: 'await_name_photo', data: {} });
}

function get(chatId) {
    return sessions.get(chatId) || null;
}

function update(chatId, patch) {
    const s = sessions.get(chatId);
    if (s) sessions.set(chatId, { ...s, ...patch });
}

function destroy(chatId) {
    sessions.delete(chatId);
}

function hasSession(chatId) {
    return sessions.has(chatId);
}

module.exports = { create, get, update, destroy, hasSession };
