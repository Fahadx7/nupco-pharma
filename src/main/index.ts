'use strict'
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join, dirname }  from 'path'
import { fileURLToPath }  from 'url'
import Database           from 'better-sqlite3'
import bcrypt             from 'bcryptjs'
import jwt                from 'jsonwebtoken'
import fs                 from 'fs'
import cron               from 'node-cron'
import TelegramBot        from 'node-telegram-bot-api'

// ── pkg compat ───────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// ── Paths ─────────────────────────────────────────────────────────────────────
const USER_DATA  = app.getPath('userData')
const DB_PATH    = join(USER_DATA, 'pharmacy.db')
const SCHEMA_PATH = join(__dirname, '../../sql/schema.sql')

const JWT_SECRET = process.env.JWT_SECRET || 'nupco-pharma-secret-v4'

// ── Database setup ────────────────────────────────────────────────────────────
let db: Database.Database

function initDb() {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Run schema (idempotent)
    const schemaPath = fs.existsSync(SCHEMA_PATH) ? SCHEMA_PATH
        : join(__dirname, '../../../sql/schema.sql')
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8')
        db.exec(schema)
    } else {
        // inline fallback schema (minimal)
        db.exec(`
            CREATE TABLE IF NOT EXISTS pharmacies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, logo_path TEXT, address TEXT, phone TEXT, license_number TEXT UNIQUE, setup_done INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, username TEXT NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', phone TEXT, salary REAL, is_active INTEGER DEFAULT 1, last_login DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(pharmacy_id, username));
            CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, name TEXT NOT NULL, barcode TEXT, category TEXT DEFAULT 'أخرى', batch TEXT, expiry_date TEXT NOT NULL, quantity INTEGER DEFAULT 0, min_quantity INTEGER DEFAULT 10, unit_price REAL DEFAULT 0, supplier_id INTEGER, source TEXT DEFAULT 'manual', status TEXT DEFAULT 'active', added_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, date_of_birth TEXT, gender TEXT, allergies TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS prescriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, customer_id INTEGER, patient_name TEXT NOT NULL, patient_phone TEXT, doctor_name TEXT, diagnosis TEXT, prescription_date TEXT NOT NULL, status TEXT DEFAULT 'pending', notes TEXT, created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS prescription_items (id INTEGER PRIMARY KEY AUTOINCREMENT, prescription_id INTEGER NOT NULL, inventory_id INTEGER, medication_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit TEXT, instructions TEXT);
            CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS purchase_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, supplier_id INTEGER NOT NULL, order_date TEXT NOT NULL, status TEXT DEFAULT 'pending', total_amount REAL DEFAULT 0, notes TEXT, created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, customer_id INTEGER, prescription_id INTEGER, total_amount REAL NOT NULL DEFAULT 0, discount REAL DEFAULT 0, payment_method TEXT DEFAULT 'cash', sold_by INTEGER, sale_date TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL, inventory_id INTEGER NOT NULL, medication_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0, subtotal REAL NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, expense_date TEXT NOT NULL, created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT, email TEXT, salary REAL, hire_date TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS telegram_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL UNIQUE, bot_token TEXT, chat_id TEXT, enabled INTEGER DEFAULT 0, daily_report INTEGER DEFAULT 1, low_stock_alerts INTEGER DEFAULT 1, prescription_alerts INTEGER DEFAULT 1, report_time TEXT DEFAULT '09:00', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, pharmacy_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT, UNIQUE(pharmacy_id, key));
        `)
    }
}

// ── Telegram Bot service ──────────────────────────────────────────────────────
let telegramBot: TelegramBot | null = null
let cronJob: cron.ScheduledTask | null = null

function startTelegramBot(pharmacyId: number) {
    const tg = db.prepare('SELECT * FROM telegram_settings WHERE pharmacy_id = ?').get(pharmacyId) as any
    if (!tg?.enabled || !tg.bot_token || !tg.chat_id) return

    if (telegramBot) { try { telegramBot.stopPolling() } catch {} }

    telegramBot = new TelegramBot(tg.bot_token, { polling: false })

    if (cronJob) cronJob.stop()
    const [hour, min] = (tg.report_time || '09:00').split(':')
    cronJob = cron.schedule(`${min} ${hour} * * *`, () => sendDailyReport(tg.chat_id, pharmacyId), { timezone: 'Asia/Riyadh' })
}

async function sendDailyReport(chatId: string, pharmacyId: number) {
    if (!telegramBot) return
    const today   = new Date().toISOString().split('T')[0]
    const in30    = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
    const expiring = db.prepare(`SELECT name, expiry_date, quantity FROM inventory WHERE pharmacy_id=? AND status='active' AND expiry_date <= ? ORDER BY expiry_date ASC LIMIT 20`).all(pharmacyId, in30) as any[]
    const sales   = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE pharmacy_id=? AND sale_date=?`).get(pharmacyId, today) as any
    const low     = db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active' AND quantity <= min_quantity`).get(pharmacyId) as any

    let msg = `📊 *التقرير اليومي*\n📅 ${today}\n\n`
    msg += `💰 مبيعات اليوم: *${(sales?.total || 0).toFixed(2)} ر.س*\n`
    msg += `⚠️ أصناف منخفضة: *${low?.c || 0}*\n`
    if (expiring.length) {
        msg += `\n📦 *تنتهي خلال 30 يوم (${expiring.length}):*\n`
        expiring.slice(0, 10).forEach(e => { msg += `  • ${e.name} — ${e.expiry_date} (${e.quantity} وحدة)\n` })
    } else {
        msg += `\n✅ لا توجد أدوية تنتهي قريباً\n`
    }
    msg += `\n🏥 *نوبكو فارما*`
    await telegramBot.sendMessage(chatId, msg, { parse_mode: 'Markdown' }).catch(() => {})
}

async function sendLowStockAlert(pharmacyId: number, medName: string, qty: number) {
    const tg = db.prepare('SELECT * FROM telegram_settings WHERE pharmacy_id=? AND enabled=1 AND low_stock_alerts=1').get(pharmacyId) as any
    if (!tg || !telegramBot) return
    await telegramBot.sendMessage(tg.chat_id, `⚠️ *تنبيه مخزون منخفض*\n💊 ${medName}\n📊 الكمية المتبقية: *${qty}*`, { parse_mode: 'Markdown' }).catch(() => {})
}

// ── IPC: Auth ─────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_e, { username, password }: { username: string; password: string }) => {
    const user = db.prepare(`
        SELECT u.*, p.name as pharmacy_name, p.setup_done
        FROM users u JOIN pharmacies p ON u.pharmacy_id = p.id
        WHERE u.username = ? AND u.is_active = 1
    `).get(username.toLowerCase()) as any
    if (!user) return { ok: false, error: 'اسم المستخدم أو كلمة المرور خاطئة' }
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return { ok: false, error: 'اسم المستخدم أو كلمة المرور خاطئة' }
    db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(user.id)
    const token = jwt.sign({ id: user.id, pharmacyId: user.pharmacy_id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' })
    startTelegramBot(user.pharmacy_id)
    return { ok: true, token, user: { id: user.id, name: user.name, role: user.role, pharmacyId: user.pharmacy_id, pharmacyName: user.pharmacy_name, setupDone: user.setup_done } }
})

ipcMain.handle('auth:verify', (_e, token: string) => {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as any
        return { ok: true, user: payload }
    } catch { return { ok: false } }
})

ipcMain.handle('auth:logout', () => ({ ok: true }))

// ── IPC: Setup Wizard ─────────────────────────────────────────────────────────
ipcMain.handle('setup:check', () => {
    const pharmacy = db.prepare('SELECT * FROM pharmacies LIMIT 1').get() as any
    return { hasPharmacy: !!pharmacy, setupDone: !!(pharmacy?.setup_done) }
})

ipcMain.handle('setup:create-pharmacy', async (_e, data: { name: string; address: string; phone: string; licenseNumber: string }) => {
    const result = db.prepare(`INSERT INTO pharmacies (name, address, phone, license_number) VALUES (?,?,?,?)`).run(data.name, data.address || null, data.phone || null, data.licenseNumber || null)
    return { ok: true, pharmacyId: result.lastInsertRowid }
})

ipcMain.handle('setup:save-telegram', (_e, { pharmacyId, botToken, chatId }: { pharmacyId: number; botToken: string; chatId: string }) => {
    db.prepare(`INSERT INTO telegram_settings (pharmacy_id, bot_token, chat_id, enabled) VALUES (?,?,?,1) ON CONFLICT(pharmacy_id) DO UPDATE SET bot_token=excluded.bot_token, chat_id=excluded.chat_id, enabled=1, updated_at=CURRENT_TIMESTAMP`).run(pharmacyId, botToken, chatId)
    return { ok: true }
})

ipcMain.handle('setup:test-telegram', async (_e, { botToken, chatId }: { botToken: string; chatId: string }) => {
    try {
        const bot = new TelegramBot(botToken, { polling: false })
        await bot.sendMessage(chatId, '✅ *نوبكو فارما* — تم ربط البوت بنجاح! 🎉', { parse_mode: 'Markdown' })
        return { ok: true }
    } catch (err: any) { return { ok: false, error: err.message } }
})

ipcMain.handle('setup:create-admin', async (_e, { pharmacyId, username, password, name }: { pharmacyId: number; username: string; password: string; name: string }) => {
    const hash = await bcrypt.hash(password, 10)
    db.prepare(`INSERT INTO users (pharmacy_id, username, password, name, role) VALUES (?,?,?,?,'admin')`).run(pharmacyId, username.toLowerCase(), hash, name)
    db.prepare(`UPDATE pharmacies SET setup_done = 1 WHERE id = ?`).run(pharmacyId)
    return { ok: true }
})

// ── IPC: Dashboard ────────────────────────────────────────────────────────────
ipcMain.handle('dashboard:stats', (_e, pharmacyId: number) => {
    const today  = new Date().toISOString().split('T')[0]
    const in7    = new Date(Date.now() + 7 *86400000).toISOString().split('T')[0]
    const in30   = new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
    const firstOfMonth = today.slice(0, 7) + '-01'

    const totalInv  = (db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active'`).get(pharmacyId) as any)?.c ?? 0
    const expired   = (db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active' AND expiry_date < ?`).get(pharmacyId, today) as any)?.c ?? 0
    const critical  = (db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active' AND expiry_date >= ? AND expiry_date <= ?`).get(pharmacyId, today, in7) as any)?.c ?? 0
    const soon      = (db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active' AND expiry_date > ? AND expiry_date <= ?`).get(pharmacyId, in7, in30) as any)?.c ?? 0
    const lowStock  = (db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE pharmacy_id=? AND status='active' AND quantity <= min_quantity`).get(pharmacyId) as any)?.c ?? 0
    const salesToday = (db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE pharmacy_id=? AND sale_date=?`).get(pharmacyId, today) as any)?.total ?? 0
    const salesMonth = (db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total FROM sales WHERE pharmacy_id=? AND sale_date >= ?`).get(pharmacyId, firstOfMonth) as any)?.total ?? 0
    const rxPending  = (db.prepare(`SELECT COUNT(*) as c FROM prescriptions WHERE pharmacy_id=? AND status='pending'`).get(pharmacyId) as any)?.c ?? 0
    const customers  = (db.prepare(`SELECT COUNT(*) as c FROM customers WHERE pharmacy_id=?`).get(pharmacyId) as any)?.c ?? 0
    const unread     = (db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE pharmacy_id=? AND is_read=0`).get(pharmacyId) as any)?.c ?? 0

    // Sales last 7 days for chart
    const chartData = db.prepare(`
        SELECT sale_date as date, COALESCE(SUM(total_amount),0) as amount
        FROM sales WHERE pharmacy_id=? AND sale_date >= ? GROUP BY sale_date ORDER BY sale_date ASC
    `).all(pharmacyId, new Date(Date.now()-6*86400000).toISOString().split('T')[0]) as any[]

    return { totalInv, expired, critical, soon, lowStock, salesToday, salesMonth, rxPending, customers, unread, chartData }
})

// ── IPC: Inventory ────────────────────────────────────────────────────────────
ipcMain.handle('inventory:list', (_e, { pharmacyId, search, category, status }: any) => {
    const today = new Date().toISOString().split('T')[0]
    let q = `SELECT * FROM inventory WHERE pharmacy_id=? AND status != 'removed'`
    const params: any[] = [pharmacyId]
    if (search) { q += ` AND name LIKE ?`; params.push(`%${search}%`) }
    if (category && category !== 'all') { q += ` AND category=?`; params.push(category) }
    if (status === 'expired') { q += ` AND expiry_date < ?`; params.push(today) }
    else if (status === 'low') { q += ` AND quantity <= min_quantity` }
    else if (status === 'active') { q += ` AND expiry_date >= ?`; params.push(today) }
    q += ` ORDER BY expiry_date ASC`
    const rows = db.prepare(q).all(...params) as any[]
    return rows.map(r => ({ ...r, daysLeft: Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000) }))
})

ipcMain.handle('inventory:add', async (_e, data: any) => {
    const result = db.prepare(`
        INSERT INTO inventory (pharmacy_id, name, barcode, category, batch, expiry_date, quantity, min_quantity, unit_price, source)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(data.pharmacyId, data.name, data.barcode||null, data.category||'أخرى', data.batchNumber||null, data.expiryDate, data.quantity||0, data.minQuantity||10, data.unitPrice||0, 'manual')
    if ((data.quantity||0) <= (data.minQuantity||10)) sendLowStockAlert(data.pharmacyId, data.name, data.quantity||0)
    return { ok: true, id: result.lastInsertRowid }
})

ipcMain.handle('inventory:update', (_e, data: any) => {
    db.prepare(`UPDATE inventory SET name=?, barcode=?, category=?, batch=?, expiry_date=?, quantity=?, min_quantity=?, unit_price=? WHERE id=? AND pharmacy_id=?`).run(data.name, data.barcode||null, data.category||'أخرى', data.batchNumber||null, data.expiryDate, data.quantity||0, data.minQuantity||10, data.unitPrice||0, data.id, data.pharmacyId)
    return { ok: true }
})

ipcMain.handle('inventory:delete', (_e, { pharmacyId, id }: any) => {
    db.prepare(`UPDATE inventory SET status='removed' WHERE id=? AND pharmacy_id=?`).run(id, pharmacyId)
    return { ok: true }
})

// ── IPC: Prescriptions ────────────────────────────────────────────────────────
ipcMain.handle('prescriptions:list', (_e, { pharmacyId, status }: any) => {
    let q = `SELECT p.*, p.patient_name as customer_name FROM prescriptions p WHERE p.pharmacy_id=?`
    const params: any[] = [pharmacyId]
    if (status && status !== 'all') { q += ` AND p.status=?`; params.push(status) }
    q += ` ORDER BY p.created_at DESC`
    return db.prepare(q).all(...params)
})

ipcMain.handle('prescriptions:add', (_e, data: any) => {
    const today = new Date().toISOString().split('T')[0]
    const result = db.prepare(`INSERT INTO prescriptions (pharmacy_id, patient_name, doctor_name, diagnosis, prescription_date, status, notes) VALUES (?,?,?,?,?,?,?)`).run(data.pharmacyId, data.customerName, data.doctorName||null, data.diagnosis||null, today, 'pending', data.notes||null)
    return { ok: true, id: result.lastInsertRowid }
})

ipcMain.handle('prescriptions:update-status', (_e, { pharmacyId, id, status }: any) => {
    db.prepare(`UPDATE prescriptions SET status=? WHERE id=? AND pharmacy_id=?`).run(status, id, pharmacyId)
    return { ok: true }
})

// ── IPC: Customers ────────────────────────────────────────────────────────────
ipcMain.handle('customers:list', (_e, { pharmacyId, search }: any) => {
    let q = `SELECT c.* FROM customers c WHERE c.pharmacy_id=?`
    const params: any[] = [pharmacyId]
    if (search) { q += ` AND c.name LIKE ?`; params.push(`%${search}%`) }
    q += ` ORDER BY c.name ASC`
    return db.prepare(q).all(...params)
})

ipcMain.handle('customers:add', (_e, data: any) => {
    const result = db.prepare(`INSERT INTO customers (pharmacy_id, name, phone, date_of_birth, allergies, notes) VALUES (?,?,?,?,?,?)`).run(data.pharmacyId, data.name, data.phone||null, data.dateOfBirth||null, data.allergies||null, data.notes||null)
    return { ok: true, id: result.lastInsertRowid }
})

ipcMain.handle('customers:update', (_e, data: any) => {
    db.prepare(`UPDATE customers SET name=?, phone=?, date_of_birth=?, allergies=?, notes=? WHERE id=? AND pharmacy_id=?`).run(data.name, data.phone||null, data.dateOfBirth||null, data.allergies||null, data.notes||null, data.id, data.pharmacyId)
    return { ok: true }
})

// ── IPC: Suppliers ────────────────────────────────────────────────────────────
ipcMain.handle('suppliers:list', (_e, pharmacyId: number) => db.prepare(`SELECT * FROM suppliers WHERE pharmacy_id=? ORDER BY name ASC`).all(pharmacyId))
ipcMain.handle('suppliers:add', (_e, data: any) => {
    const r = db.prepare(`INSERT INTO suppliers (pharmacy_id, name, contact_person, phone, email, address, notes) VALUES (?,?,?,?,?,?,?)`).run(data.pharmacyId, data.name, data.contactPerson||null, data.phone||null, data.email||null, data.address||null, data.notes||null)
    return { ok: true, id: r.lastInsertRowid }
})
ipcMain.handle('suppliers:delete', (_e, { pharmacyId, id }: any) => {
    db.prepare(`DELETE FROM suppliers WHERE id=? AND pharmacy_id=?`).run(id, pharmacyId)
    return { ok: true }
})

// ── IPC: Expenses ─────────────────────────────────────────────────────────────
ipcMain.handle('expenses:list', (_e, { pharmacyId, month }: any) => {
    const q = month
        ? `SELECT *, expense_date as date FROM expenses WHERE pharmacy_id=? AND expense_date LIKE ? ORDER BY expense_date DESC`
        : `SELECT *, expense_date as date FROM expenses WHERE pharmacy_id=? ORDER BY expense_date DESC`
    return month ? db.prepare(q).all(pharmacyId, `${month}%`) : db.prepare(q).all(pharmacyId)
})
ipcMain.handle('expenses:add', (_e, data: any) => {
    const r = db.prepare(`INSERT INTO expenses (pharmacy_id, category, amount, description, expense_date) VALUES (?,?,?,?,?)`).run(data.pharmacyId, data.category, data.amount, data.description||null, data.date)
    return { ok: true, id: r.lastInsertRowid }
})
ipcMain.handle('expenses:summary', (_e, { pharmacyId, month }: any) => {
    const prefix = month || new Date().toISOString().slice(0, 7)
    return db.prepare(`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses WHERE pharmacy_id=? AND expense_date LIKE ? GROUP BY category`).all(pharmacyId, `${prefix}%`)
})

// ── IPC: Staff (manages users table for login accounts) ───────────────────────
ipcMain.handle('staff:list', (_e, pharmacyId: number) =>
    db.prepare(`SELECT id, pharmacy_id, username, name, role, phone, salary, is_active, created_at FROM users WHERE pharmacy_id=? ORDER BY name ASC`).all(pharmacyId)
)
ipcMain.handle('staff:add', async (_e, data: any) => {
    if (!data.password) return { ok: false, error: 'كلمة المرور مطلوبة' }
    const existing = db.prepare(`SELECT id FROM users WHERE pharmacy_id=? AND username=?`).get(data.pharmacyId, data.username.toLowerCase())
    if (existing) return { ok: false, error: 'اسم المستخدم مستخدم بالفعل' }
    const hash = await bcrypt.hash(data.password, 10)
    const r = db.prepare(`INSERT INTO users (pharmacy_id, username, password, name, role, phone, salary) VALUES (?,?,?,?,?,?,?)`).run(data.pharmacyId, data.username.toLowerCase(), hash, data.name, data.role||'pharmacist', data.phone||null, data.salary||null)
    return { ok: true, id: r.lastInsertRowid }
})
ipcMain.handle('staff:update', async (_e, data: any) => {
    if (data.password) {
        const hash = await bcrypt.hash(data.password, 10)
        db.prepare(`UPDATE users SET name=?, role=?, phone=?, salary=?, password=? WHERE id=? AND pharmacy_id=?`).run(data.name, data.role, data.phone||null, data.salary||null, hash, data.id, data.pharmacyId)
    } else {
        db.prepare(`UPDATE users SET name=?, role=?, phone=?, salary=? WHERE id=? AND pharmacy_id=?`).run(data.name, data.role, data.phone||null, data.salary||null, data.id, data.pharmacyId)
    }
    return { ok: true }
})

// ── IPC: Notifications ────────────────────────────────────────────────────────
ipcMain.handle('notifications:list', (_e, pharmacyId: number) => db.prepare(`SELECT * FROM notifications WHERE pharmacy_id=? ORDER BY created_at DESC LIMIT 100`).all(pharmacyId))
ipcMain.handle('notifications:read-all', (_e, pharmacyId: number) => { db.prepare(`UPDATE notifications SET is_read=1 WHERE pharmacy_id=?`).run(pharmacyId); return { ok: true } })
ipcMain.handle('notifications:unread-count', (_e, pharmacyId: number) => {
    return (db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE pharmacy_id=? AND is_read=0`).get(pharmacyId) as any)?.c ?? 0
})

// ── IPC: Telegram Settings ────────────────────────────────────────────────────
ipcMain.handle('telegram:get', (_e, pharmacyId: number) => db.prepare(`SELECT * FROM telegram_settings WHERE pharmacy_id=?`).get(pharmacyId) || null)
ipcMain.handle('telegram:save', (_e, data: any) => {
    db.prepare(`INSERT INTO telegram_settings (pharmacy_id, bot_token, chat_id, enabled) VALUES (?,?,?,?) ON CONFLICT(pharmacy_id) DO UPDATE SET bot_token=excluded.bot_token, chat_id=excluded.chat_id, enabled=excluded.enabled, updated_at=CURRENT_TIMESTAMP`).run(data.pharmacyId, data.botToken, data.chatId, data.enabled?1:0)
    startTelegramBot(data.pharmacyId)
    return { ok: true }
})
ipcMain.handle('telegram:test', async (_e, { botToken, chatId }: any) => {
    try {
        const bot = new TelegramBot(botToken, { polling: false })
        await bot.sendMessage(chatId, '✅ *نوبكو فارما* — الاتصال يعمل بشكل صحيح! 🎉', { parse_mode: 'Markdown' })
        return { ok: true }
    } catch (err: any) { return { ok: false, error: err.message } }
})

// ── IPC: Settings ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_e, { pharmacyId, key }: any) => {
    const r = db.prepare(`SELECT value FROM app_settings WHERE pharmacy_id=? AND key=?`).get(pharmacyId, key) as any
    return r?.value ?? null
})
ipcMain.handle('settings:set', (_e, { pharmacyId, key, value }: any) => {
    db.prepare(`INSERT INTO app_settings (pharmacy_id, key, value) VALUES (?,?,?) ON CONFLICT(pharmacy_id,key) DO UPDATE SET value=excluded.value`).run(pharmacyId, key, value)
    return { ok: true }
})
ipcMain.handle('settings:get-pharmacy', (_e, pharmacyId: number) => db.prepare(`SELECT * FROM pharmacies WHERE id=?`).get(pharmacyId) || null)
ipcMain.handle('settings:update-pharmacy', (_e, data: any) => {
    db.prepare(`UPDATE pharmacies SET name=?, address=?, phone=?, license_number=? WHERE id=?`).run(data.name, data.address||null, data.phone||null, data.licenseNumber||null, data.pharmacyId)
    return { ok: true }
})
ipcMain.handle('settings:change-password', async (_e, data: any) => {
    const user = db.prepare(`SELECT password FROM users WHERE id=?`).get(data.userId) as any
    if (!user) return { ok: false, error: 'المستخدم غير موجود' }
    const ok = await bcrypt.compare(data.currentPassword, user.password)
    if (!ok) return { ok: false, error: 'كلمة المرور الحالية خاطئة' }
    const hash = await bcrypt.hash(data.newPassword, 10)
    db.prepare(`UPDATE users SET password=? WHERE id=?`).run(hash, data.userId)
    return { ok: true }
})

// ── IPC: Theme ────────────────────────────────────────────────────────────────
ipcMain.handle('theme:toggle', () => {
    nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark'
    return { dark: nativeTheme.shouldUseDarkColors }
})
ipcMain.handle('theme:get', () => ({ dark: nativeTheme.shouldUseDarkColors }))

// ── IPC: Shell ────────────────────────────────────────────────────────────────
ipcMain.handle('shell:open-url', (_e, url: string) => shell.openExternal(url))

// ── Window creation ───────────────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'نوبكو فارما',
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        titleBarStyle: process.platform === 'win32' ? 'default' : 'hiddenInset',
        show: false,
    })

    win.once('ready-to-show', () => {
        win.show()
        if (process.env.NODE_ENV === 'development') win.webContents.openDevTools()
    })

    if (process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    initDb()
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (telegramBot) telegramBot.stopPolling().catch(() => {})
        if (cronJob) cronJob.stop()
        if (db) db.close()
        app.quit()
    }
})
