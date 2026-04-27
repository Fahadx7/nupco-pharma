# CLAUDE.md — MedTracker (نوبكو فارما)

## Think Before Coding

Before touching any file, answer these questions:
1. **What is the actual problem?** Re-read the request. Don't assume.
2. **Where does the problem live?** Trace the flow: Telegram message → `index.js` → `commands/` → `src/db.js` → SQLite.
3. **What is the minimal change?** One function, one file if possible.
4. **What breaks if I change this?** Check callers before editing a shared utility.

The two runtimes are separate — the Telegram bot (`index.js`) and the web server (`server.js`) run side-by-side. A change in `src/db.js` affects both. A change in `src/commands/scan.js` affects only the bot.

---

## Project Identity

**MedTracker** — free medication inventory tracker for Saudi pharmacies.
- Version: `3.4.0`
- Platform: Windows desktop app (Node.js bundled via `pkg` → `.exe`)
- Interface: Telegram bot + local web dashboard (`localhost:3000`)
- Language: JavaScript (Node.js 18+), Arabic UI/messages

---

## Architecture at a Glance

```
index.js            ← Bot entry point. Loads config, starts polling, routes commands.
server.js           ← Web server entry point. Runs Express on port 3000.

src/
  db.js             ← SQLite wrapper. Exposes sql`` tagged-template API.
  setup.js          ← First-run HTML wizard. Writes config.json.
  status.js         ← Dashboard routes + stats API for the web UI.
  scheduler.js      ← Cron job: daily 9 AM report (6 UTC).
  autostart.js      ← Windows startup via VBScript.

  commands/         ← One file per Telegram command.
    add.js          ← /add — manual entry
    scan.js         ← /scan — AI OCR pipeline (441 lines, most complex)
    list.js         ← /list — grouped inventory display
    check.js        ← /check — expiry alerts

  api/
    routes.js       ← All REST endpoints (stats, medications, upload)
    auth.js         ← JWT register/login
    middleware.js   ← Token verification

  utils/
    categorize.js   ← Regex-based medicine classification (12 categories)
    scanSession.js  ← Multi-step scan state machine per user

public/
  index.html        ← Single-page web app (46 KB, self-contained)
  sw.js             ← Service worker (PWA offline)

sql/
  schema.sql        ← Base table: nupco_inventory + indexes
  migrate_v2.sql    ← Added: category, source
  migrate_v3.sql    ← Added: users table
```

---

## Core Data Flow

### Telegram Scan Flow
```
User sends photo/PDF
  → index.js routes to commands/scan.js
  → scanSession.js tracks multi-step state
  → Groq Vision API (Llama 4 Scout) → JSON
  → categorize.js assigns category
  → db.js inserts into nupco_inventory
  → Bot replies with Arabic confirmation
```

### Web Upload Flow
```
Browser POST /api/upload/pdf
  → api/routes.js parses PDF (pdf-parse)
  → Groq Vision API → JSON preview
  → Browser shows preview
  → POST /api/upload/confirm → db.js saves
```

### Database Abstraction
```javascript
// Always use the tagged template — never raw SQL strings
const rows = await sql`SELECT * FROM nupco_inventory WHERE status = ${'active'}`;
// This is in src/db.js — it wraps better-sqlite3 with Neon-style API
```

---

## Simplicity First

**Rules:**
- Do not add TypeScript, ORMs, or new dependencies without a clear reason.
- Do not create new files if you can add to an existing one.
- Do not abstract until you have 3+ real duplicates.
- The project is intentionally local-only — do not introduce cloud calls beyond the existing Groq API.

**The database is synchronous** (`better-sqlite3`). The `sql` wrapper returns a Promise for API compatibility, but underneath it's sync. Don't add async complexity where it isn't needed.

**The web UI is a single HTML file** (`public/index.html`). Keep it that way unless there's a strong reason. No build step, no bundler for the frontend.

---

## Surgical Changes

### Adding a new Telegram command
1. Create `src/commands/newcmd.js` — export one async function `(bot, msg, match) => {}`
2. Register in `index.js` with `bot.onText(/\/newcmd/, handler)`
3. Add to the `/start` help text in `index.js`
4. No other files need to change.

### Adding a new API endpoint
1. Add the route to `src/api/routes.js`
2. If it needs auth, use `authenticateToken` from `src/api/middleware.js`
3. No other files need to change.

### Adding a new medication category
1. Edit `src/utils/categorize.js` only — add a regex pattern to the `CATEGORIES` array.
2. No other files need to change.

### Database schema change
1. Write a migration SQL file: `sql/migrate_v4.sql`
2. Add the migration to the startup sequence in `server.js` (see existing migration pattern)
3. Update `sql/schema.sql` to reflect the new baseline
4. Do not modify existing migration files.

---

## Goal-Driven Execution

When given a task:
1. **Identify the single file** most responsible for the behavior.
2. **Read that file** before writing anything.
3. **Make the change** — no cleanup, no refactoring unless asked.
4. **Test the path** mentally: does the bot flow still reach the DB? Does the web route still authenticate?

Do not:
- Rename variables for style
- Add comments to code you didn't change
- Add error handling for impossible paths
- Refactor scan.js because it's long — it's long for a reason

---

## Tech Stack Quick Reference

| Need | Tool |
|------|------|
| Database query | `sql\`...\`` from `src/db.js` |
| Send Telegram message | `bot.sendMessage(chatId, text, opts)` |
| User scan state | `getScanSession(userId)` / `setScanSession()` |
| Categorize a drug name | `categorizeMedication(name)` from `src/utils/categorize.js` |
| Authenticate web request | `authenticateToken` middleware |
| Schedule a job | `node-cron` (see `src/scheduler.js`) |
| AI / OCR | Groq SDK, model `meta-llama/llama-4-scout-17b-16e-instruct` |
| Build exe | `npm run build` → `pkg .` → `dist/medtracker.exe` |
| Dev mode | `npm run dev` (node --watch) |

---

## Conventions

- **`'use strict'`** at top of every JS file.
- **Dates** stored as `YYYY-MM-DD` (ISO). Convert before inserting. Never store Arabic date strings.
- **Arabic messages** to users — keep them in Arabic. Don't translate to English.
- **Emojis** in bot messages — part of the UX. Keep them.
- **SQL** — always parameterized via the template literal. Never concatenate user input into SQL.
- **Secrets** — never commit `config.json`, `pharmacy.db`, or `.env`. They are in `.gitignore`.
- **JWT secret** — `nupco-secret-change-in-prod` is the dev default. In production, set `JWT_SECRET` env var.

---

## Files to Never Break

| File | Why |
|------|-----|
| `src/db.js` | Everything reads/writes through this |
| `src/utils/categorize.js` | Determines data quality for every entry |
| `src/utils/scanSession.js` | Prevents race conditions in multi-step bot flows |
| `sql/schema.sql` | Source of truth for table structure |
| `.github/workflows/build.yml` | Automated Windows release pipeline |

---

## Environment

```bash
# Required at runtime
BOT_TOKEN=...           # Telegram bot token from @BotFather
MY_CHAT_ID=...          # Your personal Telegram chat ID
GROQ_API_KEY=...        # From console.groq.com

# Optional overrides
WEB_PORT=3000           # Default: 3000
JWT_SECRET=...          # Default: nupco-secret-change-in-prod
```

Config is persisted locally in `config.json` (created by setup wizard, never committed).
