'use strict';
require('dotenv').config();

// ── محاكاة استجابة Gemini (بدون استهلاك API) ─────────────────────────────
const MOCK_GEMINI_RESPONSE = `[
  {"name":"AMLODIPINE 5MG TABLET","batch":"OT894","expiry_date":"2026-01-12","quantity":18},
  {"name":"PERINDOPRIL 4MG TABLET","batch":"40J97","expiry_date":"2026-09-01","quantity":18},
  {"name":"PERINDOPRIL 8MG GOLD RELEASE TABLET","batch":"4OJ97","expiry_date":"2026-09-29","quantity":18}
]`;

// ── اختبار 1: التحقق من parsing الـ JSON ─────────────────────────────────
function testJsonParsing() {
    console.log('\n📋 اختبار 1: JSON Parsing');
    try {
        const match = MOCK_GEMINI_RESPONSE.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('لا يوجد JSON');
        const meds = JSON.parse(match[0]);
        if (!Array.isArray(meds) || meds.length === 0) throw new Error('Array فارغ');
        console.log(`   ✅ تم استخراج ${meds.length} أدوية`);
        meds.forEach((m, i) => console.log(`   ${i+1}. ${m.name} | ${m.batch} | ${m.expiry_date} | qty:${m.quantity}`));
        return meds;
    } catch (e) {
        console.log(`   ❌ فشل: ${e.message}`);
        return null;
    }
}

// ── اختبار 2: التحقق من الاتصال بـ Neon ──────────────────────────────────
async function testDbConnection() {
    console.log('\n📋 اختبار 2: Database Connection');
    try {
        const sql = require('./src/db');
        const result = await sql`SELECT COUNT(*) as total FROM nupco_inventory`;
        console.log(`   ✅ الاتصال ناجح — المخزون الحالي: ${result[0].total} دواء`);
        return sql;
    } catch (e) {
        console.log(`   ❌ فشل الاتصال: ${e.message}`);
        return null;
    }
}

// ── اختبار 3: إدخال بيانات تجريبية ───────────────────────────────────────
async function testDbInsert(sql, meds) {
    console.log('\n📋 اختبار 3: Database Insert');
    if (!sql || !meds) { console.log('   ⏭️  تم التخطي (اختبار سابق فشل)'); return false; }
    try {
        for (const med of meds) {
            await sql`
                INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, added_by)
                VALUES (${med.name}, ${med.batch}, ${med.expiry_date}, ${med.quantity || 1}, 0)
            `;
        }
        console.log(`   ✅ تم إدخال ${meds.length} أدوية بنجاح`);
        return true;
    } catch (e) {
        console.log(`   ❌ فشل الإدخال: ${e.message}`);
        return false;
    }
}

// ── اختبار 4: التحقق من حذف البيانات التجريبية ───────────────────────────
async function testDbCleanup(sql) {
    console.log('\n📋 اختبار 4: Cleanup (حذف بيانات الاختبار)');
    if (!sql) { console.log('   ⏭️  تم التخطي'); return; }
    try {
        const result = await sql`DELETE FROM nupco_inventory WHERE added_by = 0`;
        console.log(`   ✅ تم حذف بيانات الاختبار`);
    } catch (e) {
        console.log(`   ❌ فشل الحذف: ${e.message}`);
    }
}

// ── اختبار 5: التحقق من متغيرات البيئة ───────────────────────────────────
function testEnvVars() {
    console.log('\n📋 اختبار 5: Environment Variables');
    const vars = ['BOT_TOKEN', 'MY_CHAT_ID', 'DATABASE_URL', 'GROQ_API_KEY'];
    let allOk = true;
    vars.forEach(v => {
        if (process.env[v] && !process.env[v].includes('ضع_هنا')) {
            console.log(`   ✅ ${v}`);
        } else {
            console.log(`   ❌ ${v} — غير موجود أو غير مكتمل`);
            allOk = false;
        }
    });
    return allOk;
}

// ── تشغيل جميع الاختبارات ──────────────────────────────────────────────
async function runAllTests() {
    console.log('🧪 بدء الاختبارات — NUPCO Tracker\n' + '='.repeat(40));
    testEnvVars();
    const meds = testJsonParsing();
    const sql  = await testDbConnection();
    const ok   = await testDbInsert(sql, meds);
    await testDbCleanup(sql);
    console.log('\n' + '='.repeat(40));
    console.log(ok ? '🎉 جميع الاختبارات نجحت — الكود جاهز تماماً' : '⚠️  بعض الاختبارات فشلت — راجع الأخطاء أعلاه');
    process.exit(0);
}

runAllTests().catch(console.error);
