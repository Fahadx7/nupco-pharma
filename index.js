'use strict';

const { loadConfig, isConfigComplete, startSetupWizard } = require('./src/setup');

async function main() {
    // ── تحميل الإعدادات من config.json ───────────────────────────────────────
    let config = loadConfig();

    // ── أول تشغيل أو إعدادات ناقصة → فتح Setup Wizard ───────────────────────
    if (!isConfigComplete(config)) {
        console.log('🆕 أول تشغيل — سيفتح المتصفح لإعداد البوت...');
        config = await startSetupWizard();
        console.log('\n✅ تم الإعداد بنجاح. جاري تشغيل البوت...\n');
    }

    // ── نقل الإعدادات إلى process.env ────────────────────────────────────────
    process.env.BOT_TOKEN    = config.BOT_TOKEN;
    process.env.MY_CHAT_ID   = config.MY_CHAT_ID;
    process.env.GROQ_API_KEY = config.GROQ_API_KEY;

    const PHARMACY_NAME = config.PHARMACY_NAME || 'صيدليتي';

    // ── تحميل البوت والأوامر ──────────────────────────────────────────────────
    const TelegramBot = require('node-telegram-bot-api');

    const { addMedication }   = require('./src/commands/add');
    const { checkExpiry }     = require('./src/commands/check');
    const { listMedications } = require('./src/commands/list');
    const {
        handlePhoto, handleScanMenu, handleScanChoice,
        handleConfirmation, handlePdf,
    } = require('./src/commands/scan');
    const { startDailyScheduler, buildDailyReport } = require('./src/scheduler');

    // ── تهيئة البوت ───────────────────────────────────────────────────────────
    const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

    bot.setMyCommands([
        { command: 'start',  description: 'بدء البوت وعرض المساعدة' },
        { command: 'scan',   description: 'مسح فاتورة نوبكو أو علبة دواء' },
        { command: 'add',    description: 'إضافة دواء يدوياً' },
        { command: 'list',   description: 'عرض جميع الأدوية في المخزون' },
        { command: 'check',  description: 'فحص الأدوية القريبة الانتهاء' },
        { command: 'report', description: 'تقرير فوري للأدوية خلال 30 يوماً' },
    ]).catch(() => {});

    // ════════════════════════════════════════════════════════════════════════════
    // /start
    // ════════════════════════════════════════════════════════════════════════════
    bot.onText(/^\/start$/, async (msg) => {
        const chatId = msg.chat.id;
        const name   = msg.from?.first_name || 'صديقي';
        await bot.sendMessage(chatId,
            `👋 مرحباً *${name}!*\n\n` +
            `أنا بوت تتبع صلاحية أدوية *${PHARMACY_NAME}* 💊\n\n` +
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
    // الأوامر الأخرى
    // ════════════════════════════════════════════════════════════════════════════
    bot.onText(/^\/scan$/,  (msg) => handleScanMenu(bot, msg));
    bot.onText(/^\/add/,    (msg) => addMedication(bot, msg));
    bot.onText(/^\/list$/,  (msg) => listMedications(bot, msg.chat.id));

    bot.onText(/^\/check(?:\s+(day|week|month))?$/, (msg, match) => {
        checkExpiry(bot, msg.chat.id, match[1] || 'month');
    });

    bot.onText(/^\/report$/, async (msg) => {
        const chatId = msg.chat.id;
        try {
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
    // الصور والمستندات
    // ════════════════════════════════════════════════════════════════════════════
    bot.on('photo', (msg) => handlePhoto(bot, msg));

    bot.on('document', async (msg) => {
        const mime = msg.document?.mime_type || '';
        if (mime === 'application/pdf') {
            await handlePdf(bot, msg);
        } else {
            await bot.sendMessage(msg.chat.id, '⚠️ الملفات المدعومة حالياً هي PDF فقط.');
        }
    });

    // ════════════════════════════════════════════════════════════════════════════
    // أزرار التأكيد
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
    // الأخطاء
    // ════════════════════════════════════════════════════════════════════════════
    bot.on('polling_error', (err) => console.error('❌ Polling error:', err.code || err.message));
    bot.on('error',         (err) => console.error('❌ Bot error:',     err.message));

    // ════════════════════════════════════════════════════════════════════════════
    // الجدولة اليومية
    // ════════════════════════════════════════════════════════════════════════════
    startDailyScheduler(bot, config.MY_CHAT_ID);

    console.log(`🚀 بوت ${PHARMACY_NAME} يعمل الآن...`);
    console.log(`📊 التقرير اليومي يُرسَل إلى: ${config.MY_CHAT_ID}`);
}

main().catch(err => {
    console.error('❌ خطأ فادح:', err.message);
    process.exit(1);
});
