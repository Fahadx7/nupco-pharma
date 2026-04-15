'use strict';

const Parser = require('rss-parser');

const parser = new Parser();

const FEEDS = [
  'https://www.pharmaceutical-technology.com/feed/',
  'https://www.fiercepharma.com/rss/xml',
  'https://www.drugdiscoverytrends.com/feed/',
];

async function fetchNews() {
  const articles = [];
  for (const feedUrl of FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, 5).map(item => ({
        title: item.title || '',
        link: item.link || '',
        summary: item.contentSnippet || item.content || '',
        pubDate: item.pubDate || '',
      }));
      articles.push(...items);
    } catch (err) {
      console.error(`Failed to fetch feed ${feedUrl}:`, err.message);
    }
  }
  return articles;
}

module.exports = { fetchNews };
