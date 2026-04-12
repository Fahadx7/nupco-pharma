'use strict';
require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const { addMedication }                                          = require('./src/commands/add');
const { checkExpiry }                                            = require('./src/commands/check');
const { listMedications }                                        = require('./src/commands/list');
const { handlePhoto, handleScanMenu, handleScanChoice,
        handleConfirmation, handlePdf }                          = require('./src/commands/scan');
const { startDailyScheduler }                                    = require('./src/scheduler');

// ── التحقق من المتغيرات الأساسية ─────────────────────────────────────────────
const { BOT_TOKEN, MY_CHAT_ID } = process.env;
if (!BOT_TOKEN)   throw new Error('BOT_TOKEN غير موجود في ملف .env');
if (!MY_CHAT_ID)  throw new Error('MY_CHAT_ID غير موجود في ملف .env');

// ── تهيئة البوت ───────────────────────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── أوامر الـ BotFather (اختيارية — تُحسّن واجهة التلجرام) ───────────────────
bot.setMyCommands([
    { command: 'start',  description: 'بدء البوت وعرض المساعدة' },
    { command: 'scan',   description: 'مسح فاتورة نوبكو أو علبة دواء' },
    { command: 'add',    description: 'إضافة دواء يدوياً' },
    { command: 'list',   description: 'عرض جميع الأدوية في المخزون' },
    { command: 'check',  description: 'فحص الأدوية القريبة الانتهاء' },
    { command: 'report', description: 'تقرير فوري للأدوية خلال 30 يوماً' },
]).catch(() => {}); // لا توقف البوت إن فشل

// ════════════════════════════════════════════════════════════════════════════
// /start
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/start$/, async (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from?.first_name || 'صديقي';
    await bot.sendMessage(chatId,
        `👋 مرحباً *${name}!*\n\n` +
        `أنا بوت تتبع صلاحية أدوية *نوبكو* 💊\n\n` +
        `*الأوامر المتاحة:*\n` +
        `📸 /scan — مسح فاتورة أو علبة دواء\n` +
        `➕ /add — إضافة دواء يدوياً\n` +
        `📋 /list — عرض المخزون\n` +
        `🔍 /check — فحص الصلاحيات\n` +
        `📊 /report — تقرير فوري\n\n` +
        `🕘 يصلك تقرير تلقائي كل صباح الساعة 9`,
        { parse_mode: 'Markdown' }
    );
});

// ════════════════════════════════════════════════════════════════════════════
// /scan — فتح قائمة المسح
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/scan$/, (msg) => handleScanMenu(bot, msg));

// ════════════════════════════════════════════════════════════════════════════
// /add — إضافة دواء يدوياً
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/add/, (msg) => addMedication(bot, msg));

// ════════════════════════════════════════════════════════════════════════════
// /list — عرض المخزون
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/list$/, (msg) => listMedications(bot, msg.chat.id));

// ════════════════════════════════════════════════════════════════════════════
// /check — فحص الأدوية (day / week / month)
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/check(?:\s+(day|week|month))?$/, (msg, match) => {
    const frame = match[1] || 'month';
    checkExpiry(bot, msg.chat.id, frame);
});

// ════════════════════════════════════════════════════════════════════════════
// /report — تقرير فوري (نفس منطق الجدولة اليومية)
// ════════════════════════════════════════════════════════════════════════════
bot.onText(/^\/report$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const { buildDailyReport } = require('./src/scheduler');
        const report = await buildDailyReport();
        if (report) {
            await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, '✅ لا توجد أدوية تنتهي خلال 30 يوماً.');
        }
    } catch (err) {
        await bot.sendMessage(chatId, `❌ خطأ في التقرير: ${err.message}`);
    }
});

// ════════════════════════════════════════════════════════════════════════════
// استقبال الصور — تُمرَّر إلى handlePhoto
// ════════════════════════════════════════════════════════════════════════════
bot.on('photo', (msg) => handlePhoto(bot, msg));

// ════════════════════════════════════════════════════════════════════════════
// استقبال المستندات (PDF) — تُمرَّر إلى handlePdf
// ════════════════════════════════════════════════════════════════════════════
bot.on('document', async (msg) => {
    const mime = msg.document?.mime_type || '';
    if (mime === 'application/pdf') {
        await handlePdf(bot, msg);
    } else {
        await bot.sendMessage(msg.chat.id, '⚠️ الملفات المدعومة حالياً هي PDF فقط.');
    }
});

// ════════════════════════════════════════════════════════════════════════════
// معالجة الأزرار (Callback Queries)
// ════════════════════════════════════════════════════════════════════════════
bot.on('callback_query', async (query) => {
    const cb = query.data || '';
    if (cb.startsWith('scan_')) {
        await handleScanChoice(bot, query);
    } else {
        await handleConfirmation(bot, query);
    }
});

// ════════════════════════════════════════════════════════════════════════════
// معالجة الأخطاء العامة
// ════════════════════════════════════════════════════════════════════════════
bot.on('polling_error', (err) => {
    console.error('❌ Polling error:', err.code || err.message);
});

bot.on('error', (err) => {
    console.error('❌ Bot error:', err.message);
});

// ════════════════════════════════════════════════════════════════════════════
// تشغيل الجدولة اليومية
// ════════════════════════════════════════════════════════════════════════════
startDailyScheduler(bot, MY_CHAT_ID);

console.log('🚀 بوت نوبكو يعمل الآن...');
console.log(`📊 التقرير اليومي يُرسَل إلى: ${MY_CHAT_ID}`);
