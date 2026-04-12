'use strict';
const Database = require('better-sqlite3');
const path     = require('path');

// مسار قاعدة البيانات — بجانب ملف الإعدادات
const dbPath = path.join(process.cwd(), 'pharmacy.db');

const db = new Database(dbPath);

// تحسين الأداء
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// إنشاء الجداول تلقائياً عند أول تشغيل
db.exec(`
    CREATE TABLE IF NOT EXISTS nupco_inventory (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        batch       TEXT,
        expiry_date TEXT    NOT NULL,
        quantity    INTEGER DEFAULT 1,
        category    TEXT,
        source      TEXT,
        status      TEXT    DEFAULT 'active',
        added_by    INTEGER,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_expiry_date ON nupco_inventory (expiry_date);
    CREATE INDEX IF NOT EXISTS idx_status      ON nupco_inventory (status);
`);

/**
 * Tagged template متوافق مع واجهة Neon — يعمل مع جميع الأوامر الحالية بدون تعديل
 *
 * مثال:
 *   const rows = await sql`SELECT * FROM nupco_inventory WHERE status = ${'active'}`;
 *   await sql`INSERT INTO nupco_inventory (name) VALUES (${'بانادول'})`;
 */
function sql(strings, ...values) {
    // بناء الـ query باستبدال ${value} بـ ?
    let query = '';
    strings.forEach((str, i) => {
        query += str;
        if (i < values.length) query += '?';
    });

    try {
        const trimmed = query.trim().toUpperCase();
        if (trimmed.startsWith('SELECT')) {
            return Promise.resolve(db.prepare(query).all(...values));
        } else {
            return Promise.resolve(db.prepare(query).run(...values));
        }
    } catch (err) {
        return Promise.reject(err);
    }
}

module.exports = sql;
