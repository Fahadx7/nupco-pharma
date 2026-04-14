import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' }

export default function Suppliers() {
  const { user }   = useAuth()
  const [list, setList]         = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ ...EMPTY })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.suppliersList(user.pharmacyId)
    setList(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = list.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  )

  async function save() {
    if (!form.name.trim()) { setError('اسم المورد مطلوب'); return }
    setSaving(true); setError('')
    await api.suppliersAdd({
      pharmacyId:    user!.pharmacyId,
      name:          form.name.trim(),
      contactPerson: form.contactPerson.trim() || null,
      phone:         form.phone.trim() || null,
      email:         form.email.trim() || null,
      address:       form.address.trim() || null,
      notes:         form.notes.trim() || null,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ ...EMPTY })
    load()
  }

  async function doDelete(id: number) {
    await api.suppliersDelete({ id, pharmacyId: user!.pharmacyId })
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">الموردون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{list.length} مورد مسجل</p>
        </div>
        <button className="btn-primary px-5 py-2" onClick={() => { setForm({ ...EMPTY }); setError(''); setShowForm(true) }}>🏭 إضافة مورد</button>
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

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-right py-3 px-4 font-medium">المورد</th>
              <th className="text-right py-3 px-4 font-medium">المسؤول</th>
              <th className="text-right py-3 px-4 font-medium">الهاتف</th>
              <th className="text-right py-3 px-4 font-medium">البريد</th>
              <th className="text-right py-3 px-4 font-medium">العنوان</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16 text-slate-500">⏳ جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 text-slate-500">لا يوجد موردون</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-white">{s.name}</div>
                  {s.notes && <div className="text-xs text-slate-500 truncate max-w-[180px]">{s.notes}</div>}
                </td>
                <td className="py-3 px-4 text-slate-400">{s.contact_person || '—'}</td>
                <td className="py-3 px-4 text-slate-400">{s.phone || '—'}</td>
                <td className="py-3 px-4 text-slate-400 text-xs">{s.email || '—'}</td>
                <td className="py-3 px-4 text-slate-500 text-xs truncate max-w-[160px]">{s.address || '—'}</td>
                <td className="py-3 px-4">
                  <button className="text-slate-400 hover:text-red-400 text-xs transition-colors" onClick={() => setConfirmDelete(s.id)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">🏭 إضافة مورد جديد</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">اسم الشركة / المورد *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="شركة الخليج للأدوية" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">المسؤول</label>
                  <input className="input" value={form.contactPerson} onChange={e => setForm(f => ({...f, contactPerson: e.target.value}))} placeholder="أحمد الزهراني" />
                </div>
                <div>
                  <label className="label">رقم الهاتف</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="supplier@example.com" />
                </div>
                <div>
                  <label className="label">العنوان</label>
                  <input className="input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="الرياض — المنطقة الصناعية" />
                </div>
              </div>
              <div>
                <label className="label">ملاحظات</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="شروط الدفع، التخفيضات..." />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : '🏭 إضافة المورد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold mb-2">تأكيد الحذف</h3>
            <p className="text-slate-400 text-sm mb-5">سيتم حذف هذا المورد نهائياً. هل أنت متأكد؟</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirmDelete(null)}>إلغاء</button>
              <button className="btn-danger flex-1" onClick={() => doDelete(confirmDelete)}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
