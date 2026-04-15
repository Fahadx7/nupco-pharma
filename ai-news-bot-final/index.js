'use strict';

const TelegramBot = require('node-telegram-bot-api');
const { initDb, subscribeUser, unsubscribeUser } = require('./src/db');
const { startScheduler } = require('./src/scheduler');
const { fetchAndSummarize } = require('./src/summarizer');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN || '';

if (!BOT_TOKEN) {
  console.error('TELEGRAM_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

initDb();

const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (OWNER_CHAT_ID) subscribeUser(Number(OWNER_CHAT_ID));

startScheduler(bot);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  subscribeUser(chatId);
  bot.sendMessage(
    chatId,
    '📰 *مرحباً بك في بوت أخبار الأدوية!*\n\n' +
    'سأرسل لك ملخصات يومية للأخبار الصيدلانية والطبية.\n\n' +
    'الأوامر المتاحة:\n' +
    '/start - الاشتراك في الأخبار\n' +
    '/stop - إلغاء الاشتراك\n' +
    '/news - آخر الأخبار الآن',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  unsubscribeUser(chatId);
  bot.sendMessage(chatId, '👋 تم إلغاء اشتراكك. يمكنك العودة في أي وقت بكتابة /start');
});

bot.onText(/\/news/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⏳ جاري جلب آخر الأخبار...');
  try {
    const summaries = await fetchAndSummarize();
    for (const s of summaries) {
      await bot.sendMessage(chatId, s, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    bot.sendMessage(chatId, '❌ حدث خطأ أثناء جلب الأخبار. حاول لاحقاً.');
    console.error(err);
  }
});

console.log('🤖 AI News Bot started');
