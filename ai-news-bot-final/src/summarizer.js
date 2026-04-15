'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { fetchNews } = require('./fetcher');
const { isArticleSent, markArticleSent } = require('./db');

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = 'أنت مساعد صيدلاني متخصص. مهمتك تلخيص الأخبار الدوائية والصيدلانية باللغة العربية بأسلوب مهني وموجز يفيد الصيادلة.';

async function summarizeArticle(article) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `لخص الخبر التالي في 3-4 جمل موجزة:\n\nالعنوان: ${article.title}\nالمحتوى: ${article.summary}\n\nقدم الملخص بصيغة مباشرة.`,
      },
    ],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : '';
}

async function fetchAndSummarize() {
  const articles = await fetchNews();
  const newArticles = articles.filter(a => a.link && !isArticleSent(a.link));

  if (newArticles.length === 0) {
    return ['📭 لا توجد أخبار جديدة في الوقت الحالي.'];
  }

  const summaries = [];
  for (const article of newArticles.slice(0, 3)) {
    try {
      const summary = await summarizeArticle(article);
      const msg = `📰 *${article.title}*\n\n${summary}\n\n🔗 [اقرأ المزيد](${article.link})`;
      summaries.push(msg);
      markArticleSent(article.link);
    } catch (err) {
      console.error('Summarization failed:', err.message);
    }
  }

  return summaries.length > 0 ? summaries : ['📭 لا توجد أخبار جديدة في الوقت الحالي.'];
}

module.exports = { fetchAndSummarize };
