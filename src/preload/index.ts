'use strict'
import { contextBridge, ipcRenderer } from 'electron'

// ── Expose safe IPC API to renderer ──────────────────────────────────────────
contextBridge.exposeInMainWorld('api', {
    // Auth
    login:          (d: any)    => ipcRenderer.invoke('auth:login', d),
    verify:         (t: string) => ipcRenderer.invoke('auth:verify', t),
    logout:         ()          => ipcRenderer.invoke('auth:logout'),

    // Setup Wizard
    setupCheck:     ()          => ipcRenderer.invoke('setup:check'),
    createPharmacy: (d: any)    => ipcRenderer.invoke('setup:create-pharmacy', d),
    saveTelegram:   (d: any)    => ipcRenderer.invoke('setup:save-telegram', d),
    testTelegram:   (d: any)    => ipcRenderer.invoke('setup:test-telegram', d),
    createAdmin:    (d: any)    => ipcRenderer.invoke('setup:create-admin', d),

    // Dashboard
    dashboardStats: (id: number) => ipcRenderer.invoke('dashboard:stats', id),

    // Inventory
    inventoryList:   (d: any)   => ipcRenderer.invoke('inventory:list', d),
    inventoryAdd:    (d: any)   => ipcRenderer.invoke('inventory:add', d),
    inventoryUpdate: (d: any)   => ipcRenderer.invoke('inventory:update', d),
    inventoryDelete: (d: any)   => ipcRenderer.invoke('inventory:delete', d),

    // Prescriptions
    rxList:          (d: any)   => ipcRenderer.invoke('prescriptions:list', d),
    rxAdd:           (d: any)   => ipcRenderer.invoke('prescriptions:add', d),
    rxUpdateStatus:  (d: any)   => ipcRenderer.invoke('prescriptions:update-status', d),

    // Customers
    customersList:   (d: any)   => ipcRenderer.invoke('customers:list', d),
    customersAdd:    (d: any)   => ipcRenderer.invoke('customers:add', d),
    customersUpdate: (d: any)   => ipcRenderer.invoke('customers:update', d),

    // Suppliers
    suppliersList:   (id: number) => ipcRenderer.invoke('suppliers:list', id),
    suppliersAdd:    (d: any)   => ipcRenderer.invoke('suppliers:add', d),
    suppliersDelete: (d: any)   => ipcRenderer.invoke('suppliers:delete', d),

    // Expenses
    expensesList:    (d: any)   => ipcRenderer.invoke('expenses:list', d),
    expensesAdd:     (d: any)   => ipcRenderer.invoke('expenses:add', d),
    expensesSummary: (d: any)   => ipcRenderer.invoke('expenses:summary', d),

    // Staff
    staffList:   (id: number)   => ipcRenderer.invoke('staff:list', id),
    staffAdd:    (d: any)       => ipcRenderer.invoke('staff:add', d),
    staffUpdate: (d: any)       => ipcRenderer.invoke('staff:update', d),

    // Notifications
    notifList:       (id: number) => ipcRenderer.invoke('notifications:list', id),
    notifReadAll:    (id: number) => ipcRenderer.invoke('notifications:read-all', id),
    notifUnread:     (id: number) => ipcRenderer.invoke('notifications:unread-count', id),

    // Telegram
    telegramGet:     (id: number) => ipcRenderer.invoke('telegram:get', id),
    telegramSave:    (d: any)   => ipcRenderer.invoke('telegram:save', d),
    telegramTest:    (d: any)   => ipcRenderer.invoke('telegram:test', d),

    // Settings
    settingsGet:          (d: any) => ipcRenderer.invoke('settings:get', d),
    settingsSet:          (d: any) => ipcRenderer.invoke('settings:set', d),
    settingsGetPharmacy:  (id: number) => ipcRenderer.invoke('settings:get-pharmacy', id),
    settingsUpdatePharmacy:(d: any) => ipcRenderer.invoke('settings:update-pharmacy', d),
    settingsChangePassword:(d: any) => ipcRenderer.invoke('settings:change-password', d),

    // Theme & Shell
    themeToggle: () => ipcRenderer.invoke('theme:toggle'),
    themeGet:    () => ipcRenderer.invoke('theme:get'),
    openUrl:     (url: string) => ipcRenderer.invoke('shell:open-url', url),
})

// ── TypeScript types (consumed by renderer) ───────────────────────────────────
export type API = typeof import('./preload')
