-- ══════════════════════════════════════════════════════════════════════════════
-- نوبكو فارما — Multi-Tenant Schema v4 (SQLite)
-- ══════════════════════════════════════════════════════════════════════════════
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Pharmacies (tenants) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacies (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    logo_path      TEXT,
    address        TEXT,
    phone          TEXT,
    license_number TEXT    UNIQUE,
    setup_done     INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    username    TEXT    NOT NULL,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'pharmacist',
    is_active   INTEGER DEFAULT 1,
    last_login  DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pharmacy_id, username)
);

-- ── Inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id  INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    barcode      TEXT,
    category     TEXT    DEFAULT 'أخرى',
    batch        TEXT,
    expiry_date  TEXT    NOT NULL,
    quantity     INTEGER DEFAULT 0,
    min_quantity INTEGER DEFAULT 10,
    unit_price   REAL    DEFAULT 0,
    supplier_id  INTEGER REFERENCES suppliers(id),
    source       TEXT    DEFAULT 'manual',
    status       TEXT    DEFAULT 'active',
    added_by     INTEGER REFERENCES users(id),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inv_pharmacy ON inventory (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inv_expiry   ON inventory (expiry_date);
CREATE INDEX IF NOT EXISTS idx_inv_status   ON inventory (status);

-- ── Customers / Patients ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id   INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    phone         TEXT,
    date_of_birth TEXT,
    gender        TEXT,
    allergies     TEXT,
    notes         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Prescriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    customer_id       INTEGER REFERENCES customers(id),
    patient_name      TEXT    NOT NULL,
    patient_phone     TEXT,
    doctor_name       TEXT,
    prescription_date TEXT    NOT NULL,
    status            TEXT    DEFAULT 'pending',
    notes             TEXT,
    created_by        INTEGER REFERENCES users(id),
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rx_pharmacy ON prescriptions (pharmacy_id);

CREATE TABLE IF NOT EXISTS prescription_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    inventory_id    INTEGER REFERENCES inventory(id),
    medication_name TEXT    NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit            TEXT,
    instructions    TEXT
);

-- ── Suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id    INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name           TEXT    NOT NULL,
    contact_person TEXT,
    phone          TEXT,
    email          TEXT,
    address        TEXT,
    notes          TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Purchase Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id  INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
    order_date   TEXT    NOT NULL,
    status       TEXT    DEFAULT 'pending',
    total_amount REAL    DEFAULT 0,
    notes        TEXT,
    created_by   INTEGER REFERENCES users(id),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Sales ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id     INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    customer_id     INTEGER REFERENCES customers(id),
    prescription_id INTEGER REFERENCES prescriptions(id),
    total_amount    REAL    NOT NULL DEFAULT 0,
    discount        REAL    DEFAULT 0,
    payment_method  TEXT    DEFAULT 'cash',
    sold_by         INTEGER REFERENCES users(id),
    sale_date       TEXT    NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_pharmacy ON sales (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_sales_date     ON sales (sale_date);

CREATE TABLE IF NOT EXISTS sale_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id         INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id    INTEGER NOT NULL REFERENCES inventory(id),
    medication_name TEXT    NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      REAL    NOT NULL DEFAULT 0,
    subtotal        REAL    NOT NULL DEFAULT 0
);

-- ── Expenses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id  INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    category     TEXT    NOT NULL,
    amount       REAL    NOT NULL,
    description  TEXT,
    expense_date TEXT    NOT NULL,
    created_by   INTEGER REFERENCES users(id),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Staff ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL,
    phone       TEXT,
    email       TEXT,
    salary      REAL,
    hire_date   TEXT,
    is_active   INTEGER DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    type        TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    is_read     INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Telegram Settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_settings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id         INTEGER NOT NULL UNIQUE REFERENCES pharmacies(id) ON DELETE CASCADE,
    bot_token           TEXT,
    chat_id             TEXT,
    enabled             INTEGER DEFAULT 0,
    daily_report        INTEGER DEFAULT 1,
    low_stock_alerts    INTEGER DEFAULT 1,
    prescription_alerts INTEGER DEFAULT 1,
    report_time         TEXT    DEFAULT '09:00',
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── App Settings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    key         TEXT    NOT NULL,
    value       TEXT,
    UNIQUE(pharmacy_id, key)
);
