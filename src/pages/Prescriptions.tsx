import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'معلقة',    cls: 'badge-yellow' },
  dispensed:  { label: 'صُرفت',   cls: 'badge-green'  },
  cancelled:  { label: 'ملغية',   cls: 'badge-red'    },
}

const EMPTY_FORM = { customerName: '', doctorName: '', notes: '', diagnosis: '' }

export default function Prescriptions() {
  const { user } = useAuth()
  const [rxList, setRxList]     = useState<any[]>([])
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatus] = useState('الكل')
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.rxList({ pharmacyId: user.pharmacyId })
    setRxList(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = rxList.filter(rx => {
    const matchSearch = !search ||
      (rx.customer_name || '').includes(search) ||
      (rx.doctor_name || '').includes(search) ||
      String(rx.id).includes(search)
    const matchStatus = statusFilter === 'الكل' || STATUS_MAP[rx.status]?.label === statusFilter
    return matchSearch && matchStatus
  })

  async function addRx() {
    if (!form.customerName.trim()) { setError('اسم المريض مطلوب'); return }
    setSaving(true); setError('')
    await api.rxAdd({
      pharmacyId:   user!.pharmacyId,
      customerName: form.customerName.trim(),
      doctorName:   form.doctorName.trim() || null,
      notes:        form.notes.trim() || null,
      diagnosis:    form.diagnosis.trim() || null,
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ ...EMPTY_FORM })
    load()
  }

  async function updateStatus(id: number, status: string) {
    await api.rxUpdateStatus({ id, status, pharmacyId: user!.pharmacyId })
    load()
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">الوصفات الطبية</h1>
          <p className="text-slate-400 text-sm mt-0.5">{rxList.filter(r => r.status === 'pending').length} وصفة معلقة</p>
        </div>
        <button className="btn-primary px-5 py-2" onClick={() => { setShowAdd(true); setError('') }}>➕ وصفة جديدة</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="input w-64"
          placeholder="🔍 بحث برقم أو اسم المريض..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['الكل', 'معلقة', 'صُرفت', 'ملغية'].map(s => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              onClick={() => setStatus(s)}
            >{s}</button>
          ))}
        </div>
        <span className="text-slate-500 text-sm mr-auto">{filtered.length} وصفة</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-right py-3 px-4 font-medium">رقم</th>
              <th className="text-right py-3 px-4 font-medium">المريض</th>
              <th className="text-right py-3 px-4 font-medium">الطبيب</th>
              <th className="text-right py-3 px-4 font-medium">التاريخ</th>
              <th className="text-right py-3 px-4 font-medium">الحالة</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16 text-slate-500">⏳ جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 text-slate-500">لا توجد وصفات</td></tr>
            ) : filtered.map(rx => (
              <>
                <tr
                  key={rx.id}
                  className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === rx.id ? null : rx.id)}
                >
                  <td className="py-3 px-4 text-slate-400 text-xs font-mono">#{rx.id}</td>
                  <td className="py-3 px-4 font-medium text-white">{rx.customer_name}</td>
                  <td className="py-3 px-4 text-slate-400">{rx.doctor_name || '—'}</td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{rx.created_at?.split('T')[0] || rx.created_at?.split(' ')[0]}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${STATUS_MAP[rx.status]?.cls || 'badge-gray'}`}>
                      {STATUS_MAP[rx.status]?.label || rx.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {rx.status === 'pending' && (
                      <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                          onClick={() => updateStatus(rx.id, 'dispensed')}
                        >صرف ✓</button>
                        <button
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          onClick={() => updateStatus(rx.id, 'cancelled')}
                        >إلغاء</button>
                      </div>
                    )}
                  </td>
                </tr>
                {expanded === rx.id && (
                  <tr key={`${rx.id}-detail`} className="bg-slate-800/30">
                    <td colSpan={6} className="px-4 py-3 text-sm text-slate-300">
                      {rx.diagnosis && <div><span className="text-slate-500 ml-2">التشخيص:</span>{rx.diagnosis}</div>}
                      {rx.notes && <div className="mt-1"><span className="text-slate-500 ml-2">ملاحظات:</span>{rx.notes}</div>}
                      {!rx.diagnosis && !rx.notes && <span className="text-slate-600">لا توجد تفاصيل إضافية</span>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">📋 وصفة طبية جديدة</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">اسم المريض *</label>
                <input className="input" value={form.customerName} onChange={e => setForm(f => ({...f, customerName: e.target.value}))} placeholder="فهد الأحمد" />
              </div>
              <div>
                <label className="label">اسم الطبيب</label>
                <input className="input" value={form.doctorName} onChange={e => setForm(f => ({...f, doctorName: e.target.value}))} placeholder="د. سعد العمري" />
              </div>
              <div>
                <label className="label">التشخيص</label>
                <input className="input" value={form.diagnosis} onChange={e => setForm(f => ({...f, diagnosis: e.target.value}))} placeholder="اختياري" />
              </div>
              <div>
                <label className="label">ملاحظات</label>
                <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="أي ملاحظات إضافية..." />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={addRx} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : '📋 إضافة الوصفة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
