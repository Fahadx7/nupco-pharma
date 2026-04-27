'use strict';
require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const sql     = require('./src/db');
const routes  = require('./src/api/routes');
const auth    = require('./src/api/auth');

const app  = express();
const PORT = process.env.WEB_PORT || 3000;

// ── تشغيل migrations تلقائياً عند الإقلاع ────────────────────────────────
async function runMigrations() {
    const steps = [
        // v2
        () => sql`ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'أخرى'`,
        () => sql`ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS source   TEXT DEFAULT 'manual'`,
        () => sql`CREATE INDEX IF NOT EXISTS idx_category ON nupco_inventory (category)`,
        // v3
        () => sql`CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            name       TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        () => sql`ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`,
        () => sql`CREATE INDEX IF NOT EXISTS idx_user_id ON nupco_inventory (user_id)`,
    ];
    for (const step of steps) {
        try { await step(); } catch (err) {
            if (!err.message.includes('already exists')) console.warn('⚠️  Migration:', err.message);
        }
    }
    console.log('✅ Migrations ready');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ إضافة مسار رفع PDF (استجابة آمنة تمنع الخطأ)
app.post('/api/upload-pdf', (req, res) => {
    res.json({ success: false, message: '📎 لرفع الفاتورة، أرسل ملف PDF إلى بوت تلغرام مباشرة.' });
});

app.use('/api/auth', auth);
app.use('/api', routes);

// Fallback → SPA (للطلبات GET فقط)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

runMigrations().then(() => {
    app.listen(PORT, () => {
        console.log(`🌐 Web server: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});