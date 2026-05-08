'use strict';
// ينسخ better_sqlite3.node إلى dist/ بعد pkg compilation
const fs   = require('fs');
const path = require('path');

const src  = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const dest = path.join(__dirname, '..', 'dist', 'better_sqlite3.node');

if (!fs.existsSync(src)) {
    console.error('❌ better_sqlite3.node not found. Run npm install first.');
    process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('✅ better_sqlite3.node copied to dist/');
