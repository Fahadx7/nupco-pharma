// Typed wrapper around the contextBridge API exposed in preload.ts
// In development (browser), falls back to mock/noop

declare global {
  interface Window {
    api: {
      login:              (d: { username: string; password: string }) => Promise<any>
      verify:             (token: string) => Promise<any>
      logout:             () => Promise<any>
      setupCheck:         () => Promise<{ hasPharmacy: boolean; setupDone: boolean }>
      createPharmacy:     (d: any) => Promise<any>
      saveTelegram:       (d: any) => Promise<any>
      testTelegram:       (d: any) => Promise<any>
      createAdmin:        (d: any) => Promise<any>
      dashboardStats:     (pharmacyId: number) => Promise<any>
      inventoryList:      (d: any) => Promise<any[]>
      inventoryAdd:       (d: any) => Promise<any>
      inventoryUpdate:    (d: any) => Promise<any>
      inventoryDelete:    (d: any) => Promise<any>
      rxList:             (d: any) => Promise<any[]>
      rxAdd:              (d: any) => Promise<any>
      rxUpdateStatus:     (d: any) => Promise<any>
      customersList:      (d: any) => Promise<any[]>
      customersAdd:       (d: any) => Promise<any>
      customersUpdate:    (d: any) => Promise<any>
      suppliersList:      (pharmacyId: number) => Promise<any[]>
      suppliersAdd:       (d: any) => Promise<any>
      suppliersDelete:    (d: any) => Promise<any>
      expensesList:       (d: any) => Promise<any[]>
      expensesAdd:        (d: any) => Promise<any>
      expensesSummary:    (d: any) => Promise<any[]>
      staffList:          (pharmacyId: number) => Promise<any[]>
      staffAdd:           (d: any) => Promise<any>
      staffUpdate:        (d: any) => Promise<any>
      notifList:          (pharmacyId: number) => Promise<any[]>
      notifReadAll:       (pharmacyId: number) => Promise<any>
      notifUnread:        (pharmacyId: number) => Promise<number>
      telegramGet:        (pharmacyId: number) => Promise<any>
      telegramSave:       (d: any) => Promise<any>
      telegramTest:       (d: any) => Promise<any>
      settingsGet:        (d: any) => Promise<string | null>
      settingsSet:        (d: any) => Promise<any>
      settingsGetPharmacy:(pharmacyId: number) => Promise<any>
      settingsUpdatePharmacy:(d: any) => Promise<any>
      settingsChangePassword:(d: any) => Promise<any>
      themeToggle:        () => Promise<{ dark: boolean }>
      themeGet:           () => Promise<{ dark: boolean }>
      openUrl:            (url: string) => Promise<void>
    }
  }
}

export const api = window.api
