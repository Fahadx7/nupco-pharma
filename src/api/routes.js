'use strict';
const express      = require('express');
const multer       = require('multer');
const Groq         = require('groq-sdk');

// Polyfill browser APIs المطلوبة من pdfjs-dist
const { createCanvas, DOMMatrix, Path2D } = require('@napi-rs/canvas');
if (!global.DOMMatrix) global.DOMMatrix = DOMMatrix;
if (!global.Path2D)    global.Path2D    = Path2D;

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const sql      = require('../db');
const { categorize } = require('../utils/categorize');

const { authMiddleware } = require('./middleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });

// كل routes تتطلب تسجيل دخول
router.use(authMiddleware);

// pdfjs لا يطبع تحذيرات في الـ console
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

// ── Canvas factory مطلوب لـ pdfjs-dist في Node.js ─────────────────────────
class NodeCanvasFactory {
    create(w, h)  { const canvas = createCanvas(w, h); return { canvas, context: canvas.getContext('2d') }; }
    reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
    destroy(cc)   { cc.canvas.width = 0; cc.canvas.height = 0; }
}

// ── مساعدات ────────────────────────────────────────────────────────────────

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

// ── تحويل صفحات PDF إلى صور JPEG ─────────────────────────────────────────
async function pdfToImages(buffer, maxPages = 30) {
    const data = new Uint8Array(buffer);
    const doc  = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
    const total     = doc.numPages;
    const toProcess = Math.min(total, maxPages);
    const factory   = new NodeCanvasFactory();
    const images    = [];

    for (let p = 1; p <= toProcess; p++) {
        const page     = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 }); // دقة عالية للـ OCR
        const cc       = factory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: cc.context, viewport, canvasFactory: factory }).promise;
        images.push(cc.canvas.toBuffer('image/jpeg', { quality: 90 }));
        factory.destroy(cc);
        page.cleanup();
    }
    await doc.destroy();
    return { images, total, processed: toProcess };
}

// ── Groq Vision: استخراج أدوية من صورة صفحة واحدة ───────────────────────
async function extractMedsFromImage(imageBuffer) {
    const base64 = imageBuffer.toString('base64');
    let raw;
    try {
        const res = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `هذه صورة من نموذج استلام نوبكو (Goods Delivery Note).
استخرج كل الأدوية الموجودة في هذه الصفحة.
أرجع JSON array فقط بدون أي نص إضافي أو markdown:
[{"name":"...","batch":"...","expiry_date":"YYYY-MM-DD","quantity":1}]
- حوّل أي تاريخ DD/MM/YYYY أو MM/YYYY إلى YYYY-MM-DD.
- الكمية رقم صحيح.
- إذا لم توجد أدوية في الصفحة أرجع: []`
                    },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
                ],
            }],
        });
        raw = res.choices[0].message.content.trim();
    } catch { return []; }

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
        const meds = JSON.parse(match[0]);
        return Array.isArray(meds) ? meds.filter(m => m.name) : [];
    } catch { return []; }
}

// ── معالجة PDF كاملاً (دُفعات لتجنب rate limit) ─────────────────────────
async function extractPdfMeds(buffer) {
    const { images, total, processed } = await pdfToImages(buffer, 30);
    if (!images.length) throw new Error('لم أتمكن من تحويل الصفحات');

    const allMeds = [];
    const BATCH   = 3; // 3 صفحات بالتوازي

    for (let i = 0; i < images.length; i += BATCH) {
        const batch   = images.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(img => extractMedsFromImage(img)));
        results.forEach(meds => allMeds.push(...meds));
    }

    if (!allMeds.length) throw new Error('لا توجد أدوية في هذا الملف أو لم يتمكن الذكاء الاصطناعي من القراءة');
    return { meds: allMeds, totalPages: total, processedPages: processed };
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/stats
// ══════════════════════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
    try {
        const today = new Date();
        const in7   = new Date(); in7.setDate(today.getDate() + 7);
        const in30  = new Date(); in30.setDate(today.getDate() + 30);
        const rows  = await sql`SELECT expiry_date, category FROM nupco_inventory WHERE status = 'active' AND user_id = ${req.user.id}`;

        const total    = rows.length;
        const expired  = rows.filter(r => new Date(r.expiry_date) < today).length;
        const critical = rows.filter(r => { const d = new Date(r.expiry_date); return d >= today && d <= in7; }).length;
        const soon     = rows.filter(r => { const d = new Date(r.expiry_date); return d >= today && d <= in30; }).length;
        const cats     = {};
        rows.forEach(r => { const c = r.category || 'أخرى'; cats[c] = (cats[c] || 0) + 1; });

        res.json({ total, expired, critical, soon, categories: cats });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/medications
// ══════════════════════════════════════════════════════════════════════════════
router.get('/medications', async (req, res) => {
    try {
        const rows = await sql`
            SELECT id, name, batch, expiry_date, quantity, category, source, created_at
            FROM nupco_inventory WHERE status = 'active' AND user_id = ${req.user.id} ORDER BY expiry_date ASC
        `;
        const today = new Date();
        let result = rows.map(r => {
            const daysLeft = Math.ceil((new Date(r.expiry_date) - today) / 86400000);
            const status   = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'soon' : 'ok';
            return { ...r, daysLeft, status };
        });
        if (req.query.search)   { const q = req.query.search.toLowerCase(); result = result.filter(m => m.name.toLowerCase().includes(q) || (m.batch||'').toLowerCase().includes(q)); }
        if (req.query.category && req.query.category !== 'all') result = result.filter(m => m.category === req.query.category);
        if (req.query.status   && req.query.status   !== 'all') result = result.filter(m => m.status   === req.query.status);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/medications
// ══════════════════════════════════════════════════════════════════════════════
router.post('/medications', async (req, res) => {
    try {
        const { name, batch, expiry_date, quantity } = req.body;
        if (!name || !expiry_date) return res.status(400).json({ error: 'الاسم وتاريخ الانتهاء مطلوبان' });
        const expiry = normalizeDate(expiry_date);
        if (!expiry) return res.status(400).json({ error: 'تاريخ انتهاء غير صالح' });
        const cat  = categorize(name);
        const rows = await sql`
            INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, category, source, added_by, user_id)
            VALUES (${name}, ${batch||null}, ${expiry}, ${parseInt(quantity)||1}, ${cat}, 'web', ${req.user.id}, ${req.user.id})
            RETURNING id, name, batch, expiry_date, quantity, category
        `;
        res.json({ success: true, medication: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/medications/:id
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/medications/:id', async (req, res) => {
    try {
        await sql`UPDATE nupco_inventory SET status = 'removed' WHERE id = ${parseInt(req.params.id)} AND user_id = ${req.user.id}`;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/upload/pdf — تحليل PDF صور عبر Groq Vision
// ══════════════════════════════════════════════════════════════════════════════
router.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'لم يتم إرسال ملف' });
        if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'الملف يجب أن يكون PDF' });

        const { meds, totalPages, processedPages } = await extractPdfMeds(req.file.buffer);

        const preview = meds.map(m => ({
            ...m,
            expiry_date: normalizeDate(m.expiry_date) || m.expiry_date,
            category: categorize(m.name),
        }));

        res.json({
            success: true,
            medications: preview,
            count: preview.length,
            totalPages,
            processedPages,
        });
    } catch (err) {
        res.status(422).json({ error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/upload/confirm
// ══════════════════════════════════════════════════════════════════════════════
router.post('/upload/confirm', async (req, res) => {
    try {
        const { medications } = req.body;
        if (!Array.isArray(medications) || !medications.length) return res.status(400).json({ error: 'لا توجد أدوية للحفظ' });

        let saved = 0, skipped = 0;
        for (const med of medications) {
            try {
                const expiry = normalizeDate(med.expiry_date);
                if (!expiry || !med.name) { skipped++; continue; }
                const cat = categorize(med.name);
                await sql`
                    INSERT INTO nupco_inventory (name, batch, expiry_date, quantity, category, source, added_by, user_id)
                    VALUES (${med.name}, ${med.batch||null}, ${expiry}, ${parseInt(med.quantity)||1}, ${cat}, 'pdf_web', ${req.user.id}, ${req.user.id})
                `;
                saved++;
            } catch { skipped++; }
        }
        res.json({ success: true, saved, skipped });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
