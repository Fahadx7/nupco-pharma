-- جدول مخزون أدوية نوبكو
-- نفّذ هذا في Neon SQL Editor مرة واحدة فقط

CREATE TABLE IF NOT EXISTS nupco_inventory (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    batch       TEXT,
    expiry_date DATE        NOT NULL,
    quantity    INTEGER     DEFAULT 1,
    status      TEXT        DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
    added_by    BIGINT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس لتسريع استعلامات التاريخ
CREATE INDEX IF NOT EXISTS idx_expiry_date ON nupco_inventory (expiry_date);
CREATE INDEX IF NOT EXISTS idx_status      ON nupco_inventory (status);

-- بيانات اختبار (اختياري — احذف عند الاستخدام الفعلي)
INSERT INTO nupco_inventory (name, batch, expiry_date, quantity) VALUES
    ('بانادول 500mg',  'BATCH001', CURRENT_DATE + INTERVAL '10 days', 50),
    ('أمبيسلين 250mg', 'BATCH002', CURRENT_DATE + INTERVAL '25 days', 30),
    ('باراسيتامول',    'BATCH003', CURRENT_DATE + INTERVAL '3 months', 100);
