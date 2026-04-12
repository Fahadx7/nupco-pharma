-- Migration v3: نظام تسجيل الدخول — جدول المستخدمين وربط المخزون
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ربط كل دواء بمستخدم
ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_user_id ON nupco_inventory (user_id);
