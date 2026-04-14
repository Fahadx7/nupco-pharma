'use strict';
const https      = require('https');
const pdfParse   = require('pdf-parse');
const Groq       = require('groq-sdk');
const sql        = require('../db');
const { categorize } = require('../utils/categorize');
const session    = require('../utils/scanSession');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// تخزين مؤقت للأدوية المنتظرة التأكيد
const pendingScans = new Map();

// ══════════════════════════════════════════════════════════════════════════════
// مساعدات التحميل والتحويل
// ══════════════════════════════════════════════════════════════════════════════

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data',  c => chunks.push(c));
            res.on('end',   () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function normalizeDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    const my = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (my) return `${my[2]}-${my[1].padStart(2,'0')}-01`;
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    return null;
}

function formatMedsList(meds) {
    return meds.map((m, i) => {
        const batch = m.batch    || 'غير محدد';
        const qty   = m.quantity || 1;
        const exp   = normalizeDate(m.expiry_date) || m.expiry_date || 'غير محدد';
        return `${i+1}. 💊 *${m.name}*\n    📦 ${batch}  |  📊 ${qty}  |  📅 ${exp}`;
    }).join('\n\n');
}

// ══════════════════════════════════════════════════════════════════════════════
// استدعاءات Groq
// ══════════════════════════════════════════════════════════════════════════════

async function groqVision(imageBuffer, prompt) {
    const base64 = imageBuffer.toString('base64');
    const res = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 1500,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
        }],
    });
    return res.choices[0].message.content.trim();
}

async function groqText(text, prompt) {
    const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2000,
        messages: [
            { role: 'system', content: prompt },
            { role: 'user',   content: text },
        ],
    });
    return res.choices[0].message.content.trim();
}

// ══════════════════════════════════════════════════════════════════════════════
// استخراج البيانات من الصور
// ══════════════════════════════════════════════════════════════════════════════

async function extractInvoiceMeds(imageBuffer) {
    const raw = await groqVision(imageBuffer,
        `هذه Goods Delivery Note من نوبكو. استخرج كل الأدوية.
أرجع JSON array فقط بدون markdown:
[{"name":"...","batch":"...","expiry_date":"YYYY-MM-DD","quantity":1}]
إذا التاريخ بصيغة DD/MM/YYYY أو MM/YYYY حوّله. لا تتجاهل أي دواء.`
    );
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('لم أتمكن من قراءة الفاتورة');
    const meds = JSON.parse(match[0]);
    if (!Array.isArray(meds) || !meds.length) throw new Error('لا توجد أدوية في الفاتورة');
    return meds;
}

async function extractBoxName(imageBuffer) {
    const raw = await groqVision(imageBuffer,
        `هذه صورة علبة دواء. استخرج اسم الدواء الكامل فقط (بما يشمل التركيز والشكل الصيدلاني).
أرجع JSON فقط: {"name":"اسم الدواء الكامل"}`
    );
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('لم أتمكن من قراءة اسم الدواء');
    return JSON.parse(match[0]).name;
}

async function extractExpiry(imageBuffer) {
    const raw = await groqVision(imageBuffer,
        `استخرج تاريخ الانتهاء (Expiry Date / EXP) من هذه الصورة.
أرجع JSON فقط: {"expiry_date":"YYYY-MM-DD"}
إذا الصيغة DD/MM/YYYY أو MM/YYYY حوّلها تلقائياً.`
    );
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('لم أتمكن من قراءة تاريخ الانتهاء');
    return JSON.parse(match[0]).expiry_date;
}

async function extractBoxSingle(imageBuffer) {
    const raw = await groqVision(imageBuffer,
        `هذه صورة علبة دواء. استخرج اسم الدواء وتاريخ الانتهاء.
أرجع JSON فقط: {"name":"...","expiry_date":"YYYY-MM-DD","quantity":1}
إذا التاريخ بصيغة DD/MM/YYYY أو MM/YYYY حوّله.`
    );
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('لم أتمكن من قراءة بيانات العلبة');
    return JSON.parse(match[0]);
}

// ══════════════════════════════════════════════════════════════════════════════
// استخراج البيانات من PDF
// ══════════════════════════════════════════════════════════════════════════════

async function extractPdfMeds(pdfBuffer) {
    // 1. استخراج النص من PDF
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text?.trim();
    if (!text || text.length < 20) throw new Error('لم أتمكن من قراءة نص ملف PDF');

    // 2. إرسال النص إلى Groq كـ text (وليس صورة)
    const raw = await groqText(
        text,
        `أنت مساعد صيدلاني. المستخدم سيرسل لك نص من نموذج استلام أدوية نوبكو (Goods Delivery Note).
استخرج جميع الأدوية وأرجع JSON array فقط بدون markdown:
[{"name":"...","batch":"...","expiry_date":"YYYY-MM-DD","quantity":1}]
- إذا التاريخ بصيغة DD/MM/YYYY أو MM/YYYY حوّله إلى YYYY-MM-DD.
- الكمية يجب أن تكون رقم صحيح.
- لا تُضف أي نص خارج الـ JSON.`
    );

    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('لم أتمكن من استخراج البيانات من النص');
    const meds = JSON.parse(match[0]);
    if (!Array.isArray(meds) || !meds.length) throw new Error('لا توجد أدوية في هذا الملف');
    return meds;
}

// ══════════════════════════════════════════════════════════════════════════════
// حفظ في قاعدة البيانات
// ══════════════════════════════════════════════════════════════════════════════

async function saveMed(med, userId, source = 'box') {
    const expiry = normalizeDate(med.expiry_date);
    if (!expiry) throw new Error(`تاريخ انتهاء غير صالح: ${med.expiry_date}`);
    const cat = categorize(med.name);
    await sql`
        INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, category, source, added_by)
        VALUES (${med.name}, ${med.batch || null}, ${expiry}, ${med.quantity || 1}, ${cat}, ${source}, ${userId})
    `;
    return cat;
}

// ══════════════════════════════════════════════════════════════════════════════
// /scan — قائمة الاختيار
// ══════════════════════════════════════════════════════════════════════════════

async function handleScanMenu(bot, msg) {
    const chatId = msg.chat.id;
    session.destroy(chatId);
    await bot.sendMessage(chatId,
        `📸 *اختر طريقة الإضافة:*`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🧾 صوّر نموذج نوبكو (فاتورة)', callback_data: 'scan_invoice' }],
                    [{ text: '📦 صوّر علبة (صورة واحدة)',     callback_data: 'scan_box_1'   }],
                    [{ text: '📦📦 صوّر علبة (صورتان)',       callback_data: 'scan_box_2'   }],
                    [{ text: '📄 رفع ملف PDF',                callback_data: 'scan_pdf'     }],
                ],
            },
        }
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// معالجة اختيار نوع المسح
// ══════════════════════════════════════════════════════════════════════════════

async function handleScanChoice(bot, query) {
    const chatId = query.message.chat.id;
    await bot.answerCallbackQuery(query.id);
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

    switch (query.data) {
        case 'scan_invoice':
            session.create(chatId, 'invoice');
            await bot.sendMessage(chatId, '🧾 أرسل صورة نموذج نوبكو الآن:');
            break;
        case 'scan_box_1':
            session.create(chatId, 'box_single');
            await bot.sendMessage(chatId, '📦 أرسل صورة العلبة (يجب أن يظهر الاسم وتاريخ الانتهاء):');
            break;
        case 'scan_box_2':
            session.create(chatId, 'box_dual');
            await bot.sendMessage(chatId, '📦 الخطوة 1/2 — أرسل صورة *الاسم* (الجهة الأمامية للعلبة):', { parse_mode: 'Markdown' });
            break;
        case 'scan_pdf':
            session.create(chatId, 'pdf');
            await bot.sendMessage(chatId, '📄 أرسل ملف PDF الآن (نموذج استلام نوبكو):');
            break;
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// استقبال الصور
// ══════════════════════════════════════════════════════════════════════════════

async function handlePhoto(bot, msg) {
    const chatId = msg.chat.id;
    const s      = session.get(chatId);

    if (!s) {
        await handleScanMenu(bot, msg);
        return;
    }

    // إذا المستخدم أرسل صورة وهو في وضع PDF — نرد بتوضيح
    if (s.mode === 'pdf') {
        await bot.sendMessage(chatId, '⚠️ أنت في وضع PDF. أرسل ملف PDF وليس صورة.');
        return;
    }

    const fileId   = msg.photo[msg.photo.length - 1].file_id;
    const fileLink = await bot.getFileLink(fileId);
    const buffer   = await downloadFile(fileLink);

    // ── فاتورة ──────────────────────────────────────────────────────────────
    if (s.mode === 'invoice') {
        const processing = await bot.sendMessage(chatId, '🔍 جاري تحليل الفاتورة...');
        try {
            const meds = await extractInvoiceMeds(buffer);
            session.destroy(chatId);
            const key = `${chatId}_${Date.now()}`;
            pendingScans.set(key, { meds, source: 'invoice' });
            await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
            await bot.sendMessage(chatId,
                `✅ *تم استخراج ${meds.length} دواء:*\n\n${formatMedsList(meds)}\n\n─────────────────\nحفظ الكل؟`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                    { text: `✅ حفظ الكل (${meds.length})`, callback_data: `confirm_${key}` },
                    { text: '❌ إلغاء',                      callback_data: `cancel_${key}`  },
                ]]}}
            );
        } catch (err) {
            session.destroy(chatId);
            await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
            await bot.sendMessage(chatId, `❌ ${err.message}\n\nأرسل /scan للمحاولة مجدداً.`);
        }
        return;
    }

    // ── علبة — صورة واحدة ───────────────────────────────────────────────────
    if (s.mode === 'box_single') {
        const processing = await bot.sendMessage(chatId, '🔍 جاري تحليل العلبة...');
        try {
            const med = await extractBoxSingle(buffer);
            session.destroy(chatId);
            const key = `${chatId}_${Date.now()}`;
            pendingScans.set(key, { meds: [med], source: 'box' });
            await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
            await bot.sendMessage(chatId,
                `✅ *تم استخراج البيانات:*\n\n${formatMedsList([med])}\n\n─────────────────\nحفظ؟`,
                { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                    { text: '✅ حفظ', callback_data: `confirm_${key}` },
                    { text: '❌ إلغاء', callback_data: `cancel_${key}` },
                ]]}}
            );
        } catch (err) {
            session.destroy(chatId);
            await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
            await bot.sendMessage(chatId, `❌ ${err.message}\n\nأرسل /scan للمحاولة مجدداً.`);
        }
        return;
    }

    // ── علبة — صورتان ────────────────────────────────────────────────────────
    if (s.mode === 'box_dual') {
        if (s.step === 'await_name_photo') {
            const processing = await bot.sendMessage(chatId, '🔍 جاري قراءة الاسم...');
            try {
                const name = await extractBoxName(buffer);
                session.update(chatId, { step: 'await_expiry_photo', data: { name } });
                await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
                await bot.sendMessage(chatId,
                    `✅ الاسم: *${name}*\n\n📦 الخطوة 2/2 — أرسل صورة *تاريخ الانتهاء*:`,
                    { parse_mode: 'Markdown' }
                );
            } catch (err) {
                session.destroy(chatId);
                await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
                await bot.sendMessage(chatId, `❌ ${err.message}\n\nأرسل /scan للمحاولة مجدداً.`);
            }
            return;
        }

        if (s.step === 'await_expiry_photo') {
            const processing = await bot.sendMessage(chatId, '🔍 جاري قراءة تاريخ الانتهاء...');
            try {
                const expiry_date = await extractExpiry(buffer);
                const med = { name: s.data.name, expiry_date, quantity: 1 };
                session.destroy(chatId);
                const key = `${chatId}_${Date.now()}`;
                pendingScans.set(key, { meds: [med], source: 'box' });
                await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
                await bot.sendMessage(chatId,
                    `✅ *البيانات المستخرجة:*\n\n${formatMedsList([med])}\n\n─────────────────\nحفظ؟`,
                    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                        { text: '✅ حفظ', callback_data: `confirm_${key}` },
                        { text: '❌ إلغاء', callback_data: `cancel_${key}` },
                    ]]}}
                );
            } catch (err) {
                session.destroy(chatId);
                await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
                await bot.sendMessage(chatId, `❌ ${err.message}\n\nأرسل /scan للمحاولة مجدداً.`);
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// استقبال ملفات PDF
// ══════════════════════════════════════════════════════════════════════════════

async function handlePdf(bot, msg) {
    const chatId = msg.chat.id;
    const s = session.get(chatId);

    // إذا لم تكن هناك جلسة pdf نشطة — نبدأ مباشرة
    if (s && s.mode !== 'pdf') {
        await bot.sendMessage(chatId,
            '⚠️ أنت حالياً في وضع مسح آخر. هل تريد إلغاءه والتبديل لـ PDF؟',
            { reply_markup: { inline_keyboard: [[
                { text: '✅ نعم، تبديل إلى PDF', callback_data: 'scan_pdf' },
                { text: '❌ لا',                  callback_data: 'cancel_switch' },
            ]]}}
        );
        return;
    }

    const processing = await bot.sendMessage(chatId, '📄 جاري قراءة ملف PDF وتحليله...');
    try {
        const fileLink = await bot.getFileLink(msg.document.file_id);
        const buffer   = await downloadFile(fileLink);
        const meds     = await extractPdfMeds(buffer);

        session.destroy(chatId);
        const key = `${chatId}_pdf_${Date.now()}`;
        pendingScans.set(key, { meds, source: 'pdf' });

        await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
        await bot.sendMessage(chatId,
            `✅ *تم استخراج ${meds.length} دواء من PDF:*\n\n${formatMedsList(meds)}\n\n─────────────────\nحفظ الكل؟`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
                { text: `✅ حفظ الكل (${meds.length})`, callback_data: `confirm_${key}` },
                { text: '❌ إلغاء',                      callback_data: `cancel_${key}`  },
            ]]}}
        );
    } catch (err) {
        session.destroy(chatId);
        await bot.deleteMessage(chatId, processing.message_id).catch(() => {});
        await bot.sendMessage(chatId, `❌ ${err.message}\n\nأرسل /scan للمحاولة مجدداً.`);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// معالجة أزرار التأكيد / الإلغاء
// ══════════════════════════════════════════════════════════════════════════════

async function handleConfirmation(bot, query) {
    const { data: cb, message, from } = query;
    const chatId = message.chat.id;
    await bot.answerCallbackQuery(query.id);

    if (cb === 'cancel_switch') {
        await bot.deleteMessage(chatId, message.message_id).catch(() => {});
        return;
    }

    if (cb.startsWith('cancel_')) {
        pendingScans.delete(cb.replace('cancel_', ''));
        await bot.editMessageText('❌ تم إلغاء الحفظ.', {
            chat_id: chatId, message_id: message.message_id,
        });
        return;
    }

    if (cb.startsWith('confirm_')) {
        const key  = cb.replace('confirm_', '');
        const scan = pendingScans.get(key);
        if (!scan) {
            await bot.editMessageText('⚠️ انتهت صلاحية الطلب. أرسل /scan مجدداً.', {
                chat_id: chatId, message_id: message.message_id,
            });
            return;
        }
        try {
            let saved = 0, skipped = 0;
            for (const med of scan.meds) {
                try { await saveMed(med, from.id, scan.source); saved++; }
                catch { skipped++; }
            }
            pendingScans.delete(key);
            const skipNote = skipped > 0 ? `\n⚠️ تم تخطي ${skipped} دواء بتاريخ غير صالح.` : '';
            await bot.editMessageText(
                `✅ *تم حفظ ${saved} دواء بنجاح!*${skipNote}\n\nاستخدم /list لعرض المخزون.`,
                { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown' }
            );
        } catch (err) {
            await bot.editMessageText(`❌ فشل الحفظ: ${err.message}`, {
                chat_id: chatId, message_id: message.message_id,
            });
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
module.exports = { handlePhoto, handleScanMenu, handleScanChoice, handleConfirmation, handlePdf };
