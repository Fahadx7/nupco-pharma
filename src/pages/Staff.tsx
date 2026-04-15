import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const ROLES: Record<string, string> = {
  admin:       'مدير',
  pharmacist:  'صيدلاني',
  cashier:     'كاشير',
}

const EMPTY = { name: '', username: '', password: '', role: 'pharmacist', phone: '', salary: '' }

export default function Staff() {
  const { user } = useAuth()
  const [list, setList]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<any>(null)
  const [form, setForm]         = useState({ ...EMPTY })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.staffList(user.pharmacyId)
    setList(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setError('')
    setShowForm(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      name:     item.name,
      username: item.username,
      password: '',
      role:     item.role,
      phone:    item.phone || '',
      salary:   item.salary ? String(item.salary) : '',
    })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim())     { setError('الاسم مطلوب'); return }
    if (!form.username.trim()) { setError('اسم المستخدم مطلوب'); return }
    if (!editing && !form.password) { setError('كلمة المرور مطلوبة'); return }
    if (!editing && form.password.length < 6) { setError('كلمة المرور 6 أحرف على الأقل'); return }
    setSaving(true); setError('')
    const payload: any = {
      pharmacyId: user!.pharmacyId,
      name:       form.name.trim(),
      username:   form.username.trim(),
      role:       form.role,
      phone:      form.phone.trim() || null,
      salary:     form.salary ? parseFloat(form.salary) : null,
    }
    let result: any
    if (editing) {
      if (form.password) payload.password = form.password
      result = await api.staffUpdate({ ...payload, id: editing.id })
    } else {
      payload.password = form.password
      result = await api.staffAdd(payload)
    }
    setSaving(false)
    if (result && !result.ok) {
      setError(result.error || 'حدث خطأ في الحفظ')
      return
    }
    setShowForm(false)
    load()
  }

  const roleBadge = (role: string) => {
    const cls = role === 'admin' ? 'badge-blue' : role === 'pharmacist' ? 'badge-green' : 'badge-gray'
    return <span className={`badge ${cls}`}>{ROLES[role] || role}</span>
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">الموظفون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{list.length} موظف مسجل</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn-primary px-5 py-2" onClick={openAdd}>👔 إضافة موظف</button>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">⏳ جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-slate-500">لا يوجد موظفون</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(s => (
            <div key={s.id} className="card">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold shrink-0">
                  {s.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{s.name}</span>
                    {roleBadge(s.role)}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5">@{s.username}</div>
                  {s.phone && <div className="text-slate-500 text-xs">{s.phone}</div>}
                </div>
                {user?.role === 'admin' && (
                  <button
                    className="text-slate-500 hover:text-blue-400 text-xs transition-colors shrink-0"
                    onClick={() => openEdit(s)}
                  >تعديل</button>
                )}
              </div>
              {s.salary && (
                <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-xs">
                  <span className="text-slate-500">الراتب</span>
                  <span className="text-emerald-400 font-medium">{Number(s.salary).toFixed(0)} ر.س</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? '✏️ تعديل بيانات الموظف' : '👔 إضافة موظف جديد'}</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">الاسم الكامل *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="فهد الأحمد" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">اسم المستخدم *</label>
                  <input className="input" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} placeholder="fahad" autoComplete="off" />
                </div>
                <div>
                  <label className="label">الصلاحية</label>
                  <select className="input" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                    <option value="pharmacist">صيدلاني</option>
                    <option value="cashier">كاشير</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">كلمة المرور {editing ? '(اتركها فارغة للإبقاء)' : '*'}</label>
                  <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="••••••" autoComplete="new-password" />
                </div>
                <div>
                  <label className="label">رقم الهاتف</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div>
                <label className="label">الراتب (ر.س)</label>
                <input className="input" type="number" step="0.01" min="0" value={form.salary} onChange={e => setForm(f => ({...f, salary: e.target.value}))} placeholder="اختياري" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : editing ? '💾 حفظ التغييرات' : '👔 إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
