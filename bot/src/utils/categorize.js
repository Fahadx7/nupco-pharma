'use strict';

const CATEGORIES = {
    'أقراص':   [/tablet/i, /capsule/i, /cap\b/i, /tab\b/i, /قرص/i, /كبسول/i, /lozenge/i, /caplet/i],
    'شرابات':  [/syrup/i, /suspension/i, /oral.?solution/i, /elixir/i, /شراب/i, /معلق/i, /oral.?liquid/i],
    'محاليل':  [/infusion/i, /iv.?solution/i, /normal.?saline/i, /dextrose/i, /ringer/i, /محلول/i, /glucose/i, /dialysis/i],
    'إبر':     [/injection/i, /injectable/i, /\bampoule\b/i, /\bamp\b/i, /\bvial\b/i, /im\b/i, /\bsc\b/i, /حقن/i, /أمبول/i, /فيال/i],
    'مراهم':   [/cream/i, /ointment/i, /gel\b/i, /lotion/i, /paste/i, /كريم/i, /مرهم/i, /جل/i, /لوشن/i],
    'تحاميل':  [/suppository/i, /suppositories/i, /rectal/i, /تحميل/i, /تحاميل/i],
    'نقط':     [/drop/i, /eye.?drop/i, /ear.?drop/i, /nasal.?drop/i, /نقط/i, /قطرة/i, /قطر/i],
    'بخاخات':  [/inhaler/i, /spray/i, /aerosol/i, /nasal.?spray/i, /بخاخ/i, /رذاذ/i],
    'لصقات':   [/patch/i, /plaster/i, /transdermal/i, /لصقة/i],
};

/**
 * تصنيف الدواء تلقائياً بناءً على اسمه
 * @param {string} name
 * @returns {string}
 */
function categorize(name) {
    if (!name) return 'أخرى';
    for (const [category, patterns] of Object.entries(CATEGORIES)) {
        if (patterns.some(p => p.test(name))) return category;
    }
    return 'أخرى';
}

/** أيقونة لكل فئة */
const CATEGORY_ICON = {
    'أقراص':  '💊', 'شرابات': '🍶', 'محاليل': '💉',
    'إبر':    '💉', 'مراهم':  '🧴', 'تحاميل': '🔵',
    'نقط':    '💧', 'بخاخات': '💨', 'لصقات':  '🩹',
    'أخرى':   '📦',
};

function icon(category) {
    return CATEGORY_ICON[category] || '📦';
}

module.exports = { categorize, icon, CATEGORIES };
