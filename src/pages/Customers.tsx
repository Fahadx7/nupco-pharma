import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const EMPTY = { name: '', phone: '', dateOfBirth: '', allergies: '', notes: '' }

export default function Customers() {
  const { user }   = useAuth()
  const [list, setList]         = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<any>(null)
  const [form, setForm]         = useState({ ...EMPTY })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState<any>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.customersList({ pharmacyId: user.pharmacyId })
    setList(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = list.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setError('')
    setShowForm(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      name:        item.name,
      phone:       item.phone || '',
      dateOfBirth: item.date_of_birth || '',
      allergies:   item.allergies || '',
      notes:       item.notes || '',
    })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { setError('اسم المريض مطلوب'); return }
    setSaving(true); setError('')
    const payload = {
      pharmacyId:  user!.pharmacyId,
      name:        form.name.trim(),
      phone:       form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      allergies:   form.allergies.trim() || null,
      notes:       form.notes.trim() || null,
    }
    if (editing) {
      await api.customersUpdate({ ...payload, id: editing.id })
    } else {
      await api.customersAdd(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  function age(dob: string) {
    if (!dob) return null
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000))
    return `${years} سنة`
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">المرضى</h1>
          <p className="text-slate-400 text-sm mt-0.5">{list.length} مريض مسجل</p>
        </div>
        <button className="btn-primary px-5 py-2" onClick={openAdd}>👤 إضافة مريض</button>
      </div>

      {/* Search */}
      <div className="flex gap-3 items-center">
        <input
          className="input w-72"
          placeholder="🔍 بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-slate-500 text-sm">{filtered.length} نتيجة</span>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">لا يوجد مرضى</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div
              key={c.id}
              className="card cursor-pointer hover:border-slate-600 transition-colors"
              onClick={() => setSelected(c)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{c.name}</div>
                  {c.phone && <div className="text-slate-400 text-xs mt-0.5">{c.phone}</div>}
                  <div className="text-slate-500 text-xs mt-0.5 flex gap-3">
                    {c.date_of_birth && <span>{age(c.date_of_birth)}</span>}
                    {c.allergies && <span className="text-amber-500">⚠️ حساسية</span>}
                  </div>
                </div>
                <button
                  className="text-slate-500 hover:text-blue-400 text-xs transition-colors shrink-0"
                  onClick={e => { e.stopPropagation(); openEdit(c) }}
                >تعديل</button>
              </div>
              {c.notes && <div className="mt-3 text-xs text-slate-500 border-t border-slate-700 pt-2 truncate">{c.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-lg">
                {selected.name[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                {selected.phone && <p className="text-slate-400 text-sm">{selected.phone}</p>}
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {selected.date_of_birth && (
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ الميلاد</span>
                  <span className="text-slate-300">{selected.date_of_birth} ({age(selected.date_of_birth)})</span>
                </div>
              )}
              {selected.allergies && (
                <div className="flex justify-between">
                  <span className="text-slate-500">الحساسية</span>
                  <span className="text-amber-400">{selected.allergies}</span>
                </div>
              )}
              {selected.notes && (
                <div>
                  <span className="text-slate-500">ملاحظات</span>
                  <p className="text-slate-300 mt-1">{selected.notes}</p>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600">
                <span>مسجل منذ</span>
                <span>{selected.created_at?.split('T')[0] || selected.created_at?.split(' ')[0]}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost flex-1" onClick={() => setSelected(null)}>إغلاق</button>
              <button className="btn-secondary flex-1" onClick={() => { setSelected(null); openEdit(selected) }}>✏️ تعديل</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? '✏️ تعديل بيانات المريض' : '👤 إضافة مريض جديد'}</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">الاسم الكامل *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="فهد الأحمد" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">رقم الهاتف</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="05xxxxxxxx" />
                </div>
                <div>
                  <label className="label">تاريخ الميلاد</label>
                  <input className="input" type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({...f, dateOfBirth: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">الحساسية</label>
                <input className="input" value={form.allergies} onChange={e => setForm(f => ({...f, allergies: e.target.value}))} placeholder="مثال: بنسلين، أسبرين..." />
              </div>
              <div>
                <label className="label">ملاحظات</label>
                <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="أي ملاحظات طبية..." />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : editing ? '💾 حفظ' : '👤 إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
