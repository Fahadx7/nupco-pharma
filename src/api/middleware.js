'use strict';
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'nupco-secret-change-in-prod';

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'الجلسة منتهية — سجّل دخولك مجدداً' });
    }
}

module.exports = { authMiddleware, SECRET };
