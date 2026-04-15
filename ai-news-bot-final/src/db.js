'use strict';

const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDb() {
  db = new Database(path.join(__dirname, '..', 'news.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      chat_id INTEGER PRIMARY KEY,
      subscribed_at TEXT DEFAULT (date('now'))
    );
    CREATE TABLE IF NOT EXISTS sent_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE,
      sent_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function subscribeUser(chatId) {
  db.prepare('INSERT OR IGNORE INTO subscribers (chat_id) VALUES (?)').run(chatId);
}

function unsubscribeUser(chatId) {
  db.prepare('DELETE FROM subscribers WHERE chat_id = ?').run(chatId);
}

function getSubscribers() {
  return db.prepare('SELECT chat_id FROM subscribers').all();
}

function isArticleSent(url) {
  return !!db.prepare('SELECT 1 FROM sent_articles WHERE url = ?').get(url);
}

function markArticleSent(url) {
  db.prepare('INSERT OR IGNORE INTO sent_articles (url) VALUES (?)').run(url);
}

module.exports = { initDb, subscribeUser, unsubscribeUser, getSubscribers, isArticleSent, markArticleSent };
