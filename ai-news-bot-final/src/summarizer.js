'use strict';

const Groq = require('groq-sdk');
const { fetchNews } = require('./fetcher');
const { isArticleSent, markArticleSent } = require('./db');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function summarizeArticle(article) {
  const prompt = `أنت مساعد صيدلاني متخصص. لخص الخبر التالي باللغة العربية في 3-4 جمل موجزة ومفيدة للصيادلة:

العنوان: ${article.title}
المحتوى: ${article.summary}
الرابط: ${article.link}

قدم الملخص بصيغة مباشرة ومهنية.`;

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || '';
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
