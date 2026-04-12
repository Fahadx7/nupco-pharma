'use strict';
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const sql      = require('../db');
const { authMiddleware, SECRET } = require('./middleware');

const router = express.Router();

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        if (!username || !password || !name)
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        if (username.length < 3)
            return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });
        if (password.length < 6)
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

        const exists = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()}`;
        if (exists.length) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });

        const hash = await bcrypt.hash(password, 10);
        const rows = await sql`
            INSERT INTO users (username, password, name)
            VALUES (${username.toLowerCase()}, ${hash}, ${name})
            RETURNING id, username, name
        `;
        const user  = rows[0];
        const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور' });

        const rows = await sql`SELECT id, username, password, name FROM users WHERE username = ${username.toLowerCase()}`;
        if (!rows.length) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور خاطئة' });

        const user = rows[0];
        const ok   = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور خاطئة' });

        const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
