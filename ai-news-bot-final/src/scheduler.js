'use strict';

const cron = require('node-cron');
const { getSubscribers } = require('./db');
const { fetchAndSummarize } = require('./summarizer');

function startScheduler(bot) {
  // Daily at 9 AM Riyadh time (6 UTC)
  cron.schedule('0 6 * * *', async () => {
    console.log('📅 Running scheduled news delivery...');
    try {
      const summaries = await fetchAndSummarize();
      const subscribers = getSubscribers();
      for (const { chat_id } of subscribers) {
        for (const msg of summaries) {
          await bot.sendMessage(chat_id, msg, { parse_mode: 'Markdown' }).catch(console.error);
        }
      }
      console.log(`✅ Sent to ${subscribers.length} subscribers`);
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  console.log('⏰ Scheduler started — daily at 9 AM Riyadh time');
}

module.exports = { startScheduler };
