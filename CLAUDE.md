# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

**نوبكو فارما** — multi-tenant pharmacy management desktop app for Saudi pharmacies.
- Version: `4.0.0` | Platform: Windows (Electron 33 + React 18 + TypeScript)
- Interface: Dark-mode Arabic RTL | Build: electron-vite → electron-builder → NSIS installer

---

## Commands

```bash
npm run dev           # Electron dev mode (hot-reload)
npm run build         # electron-vite build only → out/
npm run package:win   # Full build + NSIS installer → release/
npm run bot           # Legacy Telegram bot (separate process, not the Electron app)
```

No test runner is configured. TypeScript check: `npx tsc --noEmit`.

---

## Architecture

```
src/
  main/index.ts       ← ONLY backend: DB init, all IPC handlers, Telegram bot, window
  preload/index.ts    ← contextBridge: exposes window.api (typed) to renderer
  renderer/index.html ← Vite entry (script src="../main.tsx" — note the ../ path)
  main.tsx            ← React root
  App.tsx             ← HashRouter + RequireAuth guard + 11 routes
  lib/ipc.ts          ← window.api TypeScript types (source of truth for IPC contract)
  stores/auth.ts      ← Zustand persist store (pharmacyId, token, user)
  pages/              ← 11 pages (Dashboard, Inventory, Prescriptions, Customers,
                         Suppliers, Expenses, Staff, Notifications, TelegramSettings,
                         SystemSettings, Support)
sql/schema.sql        ← SQLite schema (15 tables, idempotent CREATE IF NOT EXISTS)
```

### Data Flow

```
React page → api.method(payload)       [camelCase]
  → ipcRenderer.invoke('channel:name')
  → ipcMain.handle('channel:name')
  → better-sqlite3 synchronous query   [snake_case columns]
  → return value back to renderer
```

IPC payload convention: **renderer sends camelCase flat objects**; `src/main/index.ts` maps to snake_case for SQL. Never send nested objects over IPC.

### Multi-Tenancy

Every table has `pharmacy_id FK`. Every query must filter by `pharmacyId` (from Zustand auth store, originally from JWT). The auth flow: `auth:login` → JWT signed with `JWT_SECRET` → stored in Zustand persist → verified on app reopen via `auth:verify`.

### First-Run Wizard

`setup:check` → if no pharmacy → `SetupWizard.tsx` (4 steps: pharmacy info → Telegram → admin account → done). The wizard calls `setup:create-pharmacy`, `setup:save-telegram`, `setup:create-admin`, sets `pharmacies.setup_done = 1`.

---

## Critical: Native Module Bundling

**`better-sqlite3` must never be bundled by Rollup.** The `.node` binary cannot run inside an asar archive or inside a bundled JS file.

`vite.config.ts` uses a function-based `external` that externalizes ALL non-relative imports for the main process. **Do not remove this.** If you see the error:
```
Could not dynamically require "...build\better_sqlite3.node"
at commonjsRequire ... at bindings2
```
→ `better-sqlite3` is being bundled. The fix is in `vite.config.ts` `rollupOptions.external`.

`package.json` build config uses `"asar": false` so all `node_modules` are installed as plain files — the `.node` binary loads from `resources/app/node_modules/better-sqlite3/build/Release/`.

CI (`electron-rebuild`) rebuilds `better-sqlite3` for Electron's Node ABI before packaging.

---

## Adding Features

### New page
1. `src/pages/NewPage.tsx`
2. IPC handlers → `src/main/index.ts`
3. `contextBridge` exposure → `src/preload/index.ts`
4. Type declaration → `src/lib/ipc.ts`
5. Route → `src/App.tsx`
6. Nav link → `src/components/layout/Sidebar.tsx`

### New IPC handler
1. `ipcMain.handle('ns:action', handler)` in `src/main/index.ts`
2. `nsAction: (d) => ipcRenderer.invoke('ns:action', d)` in `src/preload/index.ts`
3. Type in `src/lib/ipc.ts`

### Schema change
1. Add to `sql/schema.sql` (idempotent: `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE`)
2. Mirror in the inline fallback schema inside `initDb()` in `src/main/index.ts`

---

## Files to Never Break

| File | Why |
|------|-----|
| `src/main/index.ts` | All IPC handlers + DB init + error dialogs + window |
| `src/preload/index.ts` | contextBridge — break this = all API calls fail |
| `src/lib/ipc.ts` | TypeScript contract for all `window.api` calls |
| `src/stores/auth.ts` | Auth state; `pharmacyId` used in every page |
| `sql/schema.sql` | Source of truth for DB structure |
| `vite.config.ts` | `external` function must stay — removes native module crash |

---

## IPC Channels

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

---

## Environment

```bash
JWT_SECRET=...    # Default fallback: 'nupco-pharma-secret-v4'
```

DB stored at `app.getPath('userData')/pharmacy.db` — never committed.
Staff records live in the `users` table (not a separate `staff` table).
