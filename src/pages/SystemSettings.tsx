import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

export default function SystemSettings() {
  const { user, logout } = useAuth()

  // Pharmacy info
  const [pharmacy, setPharmacy]   = useState({ name: '', address: '', phone: '', licenseNumber: '' })
  const [pharmacySaving, setPharmacySaving] = useState(false)
  const [pharmacySaved, setPharmacySaved]   = useState(false)

  // Password
  const [pwForm, setPwForm]       = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving]   = useState(false)
  const [pwError, setPwError]     = useState('')
  const [pwSaved, setPwSaved]     = useState(false)

  // Theme
  const [isDark, setIsDark]       = useState(true)

  const [loadingPharmacy, setLoadingPharmacy] = useState(true)

  useEffect(() => {
    if (!user) return
    api.settingsGetPharmacy(user.pharmacyId).then(data => {
      if (data) {
        setPharmacy({
          name:          data.name || '',
          address:       data.address || '',
          phone:         data.phone || '',
          licenseNumber: data.license_number || '',
        })
      }
      setLoadingPharmacy(false)
    })
    api.themeGet().then(d => setIsDark(d.dark))
  }, [user])

  async function savePharmacy() {
    if (!pharmacy.name.trim()) return
    setPharmacySaving(true); setPharmacySaved(false)
    await api.settingsUpdatePharmacy({
      pharmacyId:    user!.pharmacyId,
      name:          pharmacy.name.trim(),
      address:       pharmacy.address.trim() || null,
      phone:         pharmacy.phone.trim() || null,
      licenseNumber: pharmacy.licenseNumber.trim() || null,
    })
    setPharmacySaving(false)
    setPharmacySaved(true)
    setTimeout(() => setPharmacySaved(false), 3000)
  }

  async function changePassword() {
    if (!pwForm.current)         { setPwError('كلمة المرور الحالية مطلوبة'); return }
    if (!pwForm.next)            { setPwError('كلمة المرور الجديدة مطلوبة'); return }
    if (pwForm.next.length < 6)  { setPwError('كلمة المرور 6 أحرف على الأقل'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('كلمتا المرور غير متطابقتين'); return }
    setPwSaving(true); setPwError(''); setPwSaved(false)
    const res = await api.settingsChangePassword({
      userId:      user!.id,
      pharmacyId:  user!.pharmacyId,
      currentPassword: pwForm.current,
      newPassword:     pwForm.next,
    })
    setPwSaving(false)
    if (res?.ok) {
      setPwSaved(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwSaved(false), 3000)
    } else {
      setPwError(res?.error || 'كلمة المرور الحالية غير صحيحة')
    }
  }

  async function toggleTheme() {
    const res = await api.themeToggle()
    setIsDark(res.dark)
    document.documentElement.classList.toggle('dark', res.dark)
  }

  if (loadingPharmacy) return <div className="flex items-center justify-center h-64 text-slate-400">⏳ جاري التحميل...</div>

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">الإعدادات</h1>
        <p className="text-slate-400 text-sm mt-1">إعدادات الصيدلية والحساب</p>
      </div>

      {/* Pharmacy Info */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">🏥 بيانات الصيدلية</h3>
        <div>
          <label className="label">اسم الصيدلية *</label>
          <input className="input" value={pharmacy.name} onChange={e => setPharmacy(p => ({...p, name: e.target.value}))} />
        </div>
        <div>
          <label className="label">العنوان</label>
          <input className="input" value={pharmacy.address} onChange={e => setPharmacy(p => ({...p, address: e.target.value}))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">رقم الهاتف</label>
            <input className="input" value={pharmacy.phone} onChange={e => setPharmacy(p => ({...p, phone: e.target.value}))} />
          </div>
          <div>
            <label className="label">رقم الترخيص</label>
            <input className="input" value={pharmacy.licenseNumber} onChange={e => setPharmacy(p => ({...p, licenseNumber: e.target.value}))} />
          </div>
        </div>
        <button className="btn-primary px-5 py-2" onClick={savePharmacy} disabled={pharmacySaving}>
          {pharmacySaving ? '⏳ جاري الحفظ...' : pharmacySaved ? '✅ تم الحفظ!' : '💾 حفظ البيانات'}
        </button>
      </div>

      {/* Change Password */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">🔐 تغيير كلمة المرور</h3>
        {pwError && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">⚠️ {pwError}</div>}
        {pwSaved && <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-300 text-sm">✅ تم تغيير كلمة المرور بنجاح!</div>}
        <div>
          <label className="label">كلمة المرور الحالية</label>
          <input className="input" type="password" value={pwForm.current} onChange={e => setPwForm(f => ({...f, current: e.target.value}))} autoComplete="current-password" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">كلمة المرور الجديدة</label>
            <input className="input" type="password" value={pwForm.next} onChange={e => setPwForm(f => ({...f, next: e.target.value}))} autoComplete="new-password" />
          </div>
          <div>
            <label className="label">تأكيد كلمة المرور</label>
            <input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} autoComplete="new-password" />
          </div>
        </div>
        <button className="btn-secondary px-5 py-2" onClick={changePassword} disabled={pwSaving}>
          {pwSaving ? '⏳ جاري التغيير...' : '🔐 تغيير كلمة المرور'}
        </button>
      </div>

      {/* Appearance */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">🎨 المظهر</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">الوضع الداكن</p>
            <p className="text-slate-500 text-xs">الوضع الافتراضي للتطبيق</p>
          </div>
          <div
            className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${isDark ? 'bg-blue-600' : 'bg-slate-700'}`}
            onClick={toggleTheme}
          >
            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">👤 الحساب الحالي</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold">
            {user?.name?.[0] || '?'}
          </div>
          <div>
            <p className="text-white font-medium">{user?.name}</p>
            <p className="text-slate-400 text-xs">{user?.role === 'admin' ? 'مدير' : user?.role === 'pharmacist' ? 'صيدلاني' : 'كاشير'} — {user?.pharmacyName}</p>
          </div>
          <button className="btn-danger mr-auto px-4 py-1.5 text-sm" onClick={logout}>
            ↩ تسجيل الخروج
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="card text-center text-slate-600 text-xs space-y-1">
        <p>نوبكو فارما v4.0</p>
        <p>صُنع بـ❤️ فهد A</p>
      </div>
    </div>
  )
}
