const path = require('path');
const { loadConfig, isConfigComplete, startSetupWizard } = require('./src/setup');
const { startStatusServer } = require('./src/status');
const { showStartupNotification } = require('./src/autostart');

async function main() {
    let config = loadConfig();
    if (!isConfigComplete(config)) {
        console.log('🆕 أول تشغيل — سيفتح المتصفح لإعداد البوت...');
        config = await startSetupWizard();
        console.log('\n✅ تم الإعداد. جاري تشغيل البوت...\n');
    }
    process.env.BOT_TOKEN = config.BOT_TOKEN;
    process.env.MY_CHAT_ID = config.MY_CHAT_ID;
    process.env.GROQ_API_KEY = config.GROQ_API_KEY;
    const PHARMACY_NAME = config.PHARMACY_NAME || 'صيدليتي';

    const TelegramBot = require('node-telegram-bot-api');
    const sql = require('./src/db');
    const db = sql.db;
    const { addMedication } = require('./src/commands/add');
    const { checkExpiry } = require('./src/commands/check');
    const { listMedications } = require('./src/commands/list');
    const { handlePhoto, handleScanMenu, handleScanChoice, handleConfirmation, handlePdf, registerTextHandler } = require('./src/commands/scan');
    const { startDailyScheduler, buildDailyReport } = require('./src/scheduler');

    const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
    registerTextHandler(bot);

    bot.setMyCommands([
        { command: 'start', description: 'بدء البوت وعرض المساعدة' },
        { command: 'scan', description: 'مسح فاتورة نوبكو أو علبة دواء' },
        { command: 'add', description: 'إضافة دواء يدوياً' },
        { command: 'list', description: 'عرض جميع الأدوية في المخزون' },
        { command: 'check', description: 'فحص الأدوية القريبة الانتهاء' },
        { command: 'report', description: 'تقرير فوري للأدوية خلال 30 يوماً' },
    ]).catch(() => {});

    bot.onText(/^\/start$/, async (msg) => {
        const chatId = msg.chat.id;
        const name = msg.from?.first_name || 'صديقي';
        await bot.sendMessage(chatId, `👋 مرحباً *${name}!*\n\nأنا بوت تتبع صلاحية أدوية *${PHARMACY_NAME}* 💊\n\n*الأوامر المتاحة:*\n📸 /scan — مسح فاتورة أو علبة دواء\n➕ /add — إضافة دواء يدوياً\n📋 /list — عرض المخزون\n🔍 /check — فحص الصلاحيات\n📊 /report — تقرير فوري\n\n🕘 يصلك تقرير تلقائي كل صباح الساعة 9`, { parse_mode: 'Markdown' });
    });
    bot.onText(/^\/scan$/, (msg) => handleScanMenu(bot, msg));
    bot.onText(/^\/add/, (msg) => addMedication(bot, msg));
    bot.onText(/^\/list$/, (msg) => listMedications(bot, msg.chat.id));
    bot.onText(/^\/check(?:\s+(day|week|month))?$/, (msg, match) => { checkExpiry(bot, msg.chat.id, match[1] || 'month'); });
    bot.onText(/^\/report$/, async (msg) => { const report = await buildDailyReport(); await bot.sendMessage(msg.chat.id, report || '✅ لا توجد أدوية تنتهي خلال 30 يوماً.', { parse_mode: 'Markdown' }); });
    bot.on('photo', (msg) => handlePhoto(bot, msg));
    bot.on('document', async (msg) => { if (msg.document?.mime_type === 'application/pdf') await handlePdf(bot, msg); else await bot.sendMessage(msg.chat.id, '⚠️ الملفات المدعومة حالياً هي PDF فقط.'); });
    bot.on('callback_query', async (query) => { if (query.data.startsWith('scan_')) await handleScanChoice(bot, query); else await handleConfirmation(bot, query); });
    bot.on('polling_error', (err) => console.error('❌ Polling error:', err.message));
    startDailyScheduler(bot, config.MY_CHAT_ID);
    startStatusServer(PHARMACY_NAME, db);
    showStartupNotification(PHARMACY_NAME);
    const { exec } = require('child_process');
    exec('start http://localhost:3000', () => {});
    console.log(`\n💊 ${PHARMACY_NAME} — البوت يعمل\n📊 لوحة التحكم: http://localhost:3000`);
}
main().catch(err => { console.error('❌ خطأ فادح:', err.message); process.exit(1); });
