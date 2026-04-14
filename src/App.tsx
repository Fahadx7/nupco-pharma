import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './stores/auth'
import { api } from './lib/ipc'

import LoginPage      from './components/auth/LoginPage'
import SetupWizard    from './components/wizard/SetupWizard'
import AppLayout      from './components/layout/AppLayout'

import Dashboard        from './pages/Dashboard'
import Inventory        from './pages/Inventory'
import Prescriptions    from './pages/Prescriptions'
import Customers        from './pages/Customers'
import Suppliers        from './pages/Suppliers'
import Expenses         from './pages/Expenses'
import Staff            from './pages/Staff'
import Notifications    from './pages/Notifications'
import TelegramSettings from './pages/TelegramSettings'
import SystemSettings   from './pages/SystemSettings'
import Support          from './pages/Support'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  if (!token || !user) return <Navigate to="/login" replace />
  if (!user.setupDone)  return <Navigate to="/setup"  replace />
  return <>{children}</>
}

export default function App() {
  const { token, user, rehydrate } = useAuth()
  const [checking, setChecking] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    ;(async () => {
      await rehydrate()
      const { hasPharmacy, setupDone } = await api.setupCheck()
      setNeedsSetup(!hasPharmacy || !setupDone)
      setChecking(false)
    })()
  }, [])

  if (checking) return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">جاري التحميل...</p>
      </div>
    </div>
  )

  return (
    <HashRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          token && user && user.setupDone ? <Navigate to="/" replace /> : <LoginPage />
        } />
        <Route path="/setup" element={
          token && user && user.setupDone ? <Navigate to="/" replace />
          : needsSetup || (token && user && !user.setupDone) ? <SetupWizard />
          : <Navigate to="/login" replace />
        } />

        {/* Protected */}
        <Route path="/" element={
          <RequireAuth><AppLayout /></RequireAuth>
        }>
          <Route index                    element={<Dashboard />} />
          <Route path="inventory"         element={<Inventory />} />
          <Route path="prescriptions"     element={<Prescriptions />} />
          <Route path="customers"         element={<Customers />} />
          <Route path="suppliers"         element={<Suppliers />} />
          <Route path="expenses"          element={<Expenses />} />
          <Route path="staff"             element={<Staff />} />
          <Route path="notifications"     element={<Notifications />} />
          <Route path="telegram"          element={<TelegramSettings />} />
          <Route path="settings"          element={<SystemSettings />} />
          <Route path="support"           element={<Support />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
