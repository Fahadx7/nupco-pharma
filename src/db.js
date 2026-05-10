'use strict';
const path = require('path');

// ── pkg compat: عند تشغيله كـ exe يجب أن يكون better_sqlite3.node بجانبه ─────
if (process.pkg) {
    const fs = require('fs');
    const Module = require('module');
    const bindingPath = path.join(path.dirname(process.execPath), 'better_sqlite3.node');

    if (!fs.existsSync(bindingPath)) {
        console.error('❌ الملف better_sqlite3.node غير موجود بجانب البرنامج.');
        console.error('   تأكد أن كلا الملفين في نفس المجلد:');
        console.error('   • نوبكو-فارما.exe');
        console.error('   • better_sqlite3.node');
        process.exit(1);
    }

    // bindings لا يقرأ env vars — نُعيد توجيه أي require لـ better_sqlite3 للمسار الخارجي
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (request, ...args) {
        if (typeof request === 'string' && request.includes('better_sqlite3')) {
            return bindingPath;
        }
        return origResolve.call(this, request, ...args);
    };
}

let Database;
try {
    Database = require('better-sqlite3');
} catch (err) {
    console.error('❌ فشل تحميل محرك قاعدة البيانات:', err.message);
    process.exit(1);
}

// مسار قاعدة البيانات — بجانب ملف الإعدادات
const dbPath = path.join(process.cwd(), 'pharmacy.db');
const db = new Database(dbPath);

// تحسين الأداء والموثوقية
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

function sql(strings, ...values) {
    let query = '';
    strings.forEach((str, i) => {
        query += str;
        if (i < values.length) query += '?';
    });

    try {
        const upper = query.trim().toUpperCase();
        if (upper.startsWith('SELECT') || upper.includes('RETURNING')) {
            return Promise.resolve(db.prepare(query).all(...values));
        } else {
            return Promise.resolve(db.prepare(query).run(...values));
        }
    } catch (err) {
        return Promise.reject(err);
    }
}

sql.db = db;

module.exports = sql;
