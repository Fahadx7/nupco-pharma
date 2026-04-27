-- Migration v2: إضافة التصنيف والمصدر
ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'أخرى';
ALTER TABLE nupco_inventory ADD COLUMN IF NOT EXISTS source   TEXT DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_category ON nupco_inventory (category);

-- تحديث البيانات الموجودة بتصنيف افتراضي
UPDATE nupco_inventory SET category = 'أخرى' WHERE category IS NULL;
