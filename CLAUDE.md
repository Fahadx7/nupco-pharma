# CLAUDE.md — نوبكو فارما v4

## Think Before Coding

Before touching any file, answer these questions:
1. **What is the actual problem?** Re-read the request. Don't assume.
2. **Where does the problem live?** Trace the flow: Renderer → IPC → `src/main/index.ts` → SQLite.
3. **What is the minimal change?** One function, one file if possible.
4. **What breaks if I change this?** Check IPC callers before editing shared handlers.

---

## Project Identity

**نوبكو فارما** — multi-tenant pharmacy management desktop app for Saudi pharmacies.
- Version: `4.0.0`
- Platform: Windows desktop app (Electron + React)
- Interface: Dark-mode Arabic RTL dashboard
- Build: electron-vite → electron-builder → NSIS installer

---

## Architecture at a Glance

```
src/
  main/
    index.ts        ← Electron main process. DB init, IPC handlers, Telegram bot, window creation.
  preload/
    index.ts        ← contextBridge: exposes window.api to renderer (all IPC calls typed).
  renderer/
    index.html      ← Renderer entry point (references ../main.tsx).

  main.tsx          ← React entry (ReactDOM.render)
  App.tsx           ← HashRouter, RequireAuth guard, all 11 routes
  index.css         ← Tailwind + custom CSS classes (.card, .btn-*, .input, .badge-*, etc.)

  lib/
    ipc.ts          ← TypeScript types for window.api + `export const api = window.api`

  stores/
    auth.ts         ← Zustand store (persist). User state, login/logout/rehydrate.

  components/
    auth/LoginPage.tsx
    wizard/SetupWizard.tsx   ← 4-step first-run wizard
    layout/AppLayout.tsx
    layout/Sidebar.tsx

  pages/
    Dashboard.tsx       ← Stats cards + 7-day sales chart
    Inventory.tsx       ← CRUD inventory with expiry badges
    Prescriptions.tsx   ← Rx tracker (pending/dispensed/cancelled)
    Customers.tsx       ← Patient records
    Suppliers.tsx       ← Supplier management
    Expenses.tsx        ← Expenses with bar chart by category
    Staff.tsx           ← Staff/user account management
    Notifications.tsx   ← Notification center
    TelegramSettings.tsx← Bot token + chat ID + test
    SystemSettings.tsx  ← Pharmacy info, password change, theme toggle
    Support.tsx         ← FAQ + Telegram support link (@AbuAmran2000_10)

sql/
  schema.sql          ← Full multi-tenant SQLite schema (15 tables)

resources/
  installer.nsh       ← NSIS installer customization

bot/                  ← Legacy Telegram bot (v3.4) — separate runtime, not used by Electron app
```

---

## Core Data Flow

### Renderer → Backend
```
React component calls api.someMethod(data)
  → window.api (contextBridge)
  → ipcRenderer.invoke('channel:name', data)
  → ipcMain.handle('channel:name', handler)
  → better-sqlite3 (synchronous SQLite)
  → Returns result to renderer
```

### IPC Channel Naming
```
auth:login / auth:verify / auth:logout
setup:check / setup:create-pharmacy / setup:save-telegram / setup:test-telegram / setup:create-admin
dashboard:stats
inventory:list / inventory:add / inventory:update / inventory:delete
prescriptions:list / prescriptions:add / prescriptions:update-status
customers:list / customers:add / customers:update
suppliers:list / suppliers:add / suppliers:delete
expenses:list / expenses:add / expenses:summary
staff:list / staff:add / staff:update
notifications:list / notifications:read-all / notifications:unread-count
telegram:get / telegram:save / telegram:test
settings:get / settings:set / settings:get-pharmacy / settings:update-pharmacy / settings:change-password
theme:toggle / theme:get
shell:open-url
```

### Multi-Tenancy
All tables include `pharmacy_id` FK. Every query filters by `pharmacyId` passed from the authenticated user (stored in Zustand, originally from JWT).

---

## Simplicity First

**Rules:**
- Do not add HTTP layer between Electron main and renderer — use IPC.
- Do not add new npm packages without clear reason.
- Do not abstract until you have 3+ real duplicates.
- IPC payloads use camelCase from renderer; main.ts converts to snake_case for SQL.

---

## Surgical Changes

### Adding a new page
1. Create `src/pages/NewPage.tsx`
2. Add IPC handlers to `src/main/index.ts`
3. Expose in `src/preload/index.ts` via `contextBridge`
4. Add TypeScript type in `src/lib/ipc.ts`
5. Add route in `src/App.tsx`
6. Add nav link in `src/components/layout/Sidebar.tsx`

### Adding a new IPC handler
1. Add `ipcMain.handle('channel:name', handler)` to `src/main/index.ts`
2. Add `channelName: (d) => ipcRenderer.invoke('channel:name', d)` to `src/preload/index.ts`
3. Add type declaration in `src/lib/ipc.ts`

### Database schema change
1. Add migration SQL to `sql/schema.sql` (use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE`)
2. Also add inline in `src/main/index.ts` fallback schema for first-run

---

## Tech Stack Quick Reference

| Need | Tool |
|------|------|
| Database | `better-sqlite3` (sync) in `src/main/index.ts` |
| Frontend state | Zustand (`src/stores/auth.ts`) |
| Routing | React Router v6 HashRouter |
| Styling | Tailwind CSS v3 + custom CSS classes in `src/index.css` |
| Charts | Recharts (AreaChart, BarChart) |
| IPC typing | `src/lib/ipc.ts` |
| Telegram | `node-telegram-bot-api` + `node-cron` in main process |
| Build | `npm run build` → electron-vite → `out/` |
| Package Win | `npm run package:win` → NSIS installer in `release/` |

---

## Files to Never Break

| File | Why |
|------|-----|
| `src/main/index.ts` | All IPC handlers + DB init + Telegram + window creation |
| `src/preload/index.ts` | Bridge between renderer and main |
| `src/lib/ipc.ts` | TypeScript types for all API calls |
| `src/stores/auth.ts` | Auth state used everywhere |
| `sql/schema.sql` | Source of truth for table structure |

---

## Environment

```bash
# Runtime (Electron main)
JWT_SECRET=...           # Default: nupco-pharma-secret-v4

# Bot (legacy, optional)
BOT_TOKEN=...
MY_CHAT_ID=...
GROQ_API_KEY=...
```

App data stored in `app.getPath('userData')` / `pharmacy.db` (never committed).
