import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const CATEGORIES = ['رواتب', 'إيجار', 'فواتير', 'صيانة', 'مشتريات', 'تسويق', 'نقل', 'أخرى']
const EMPTY = { amount: '', category: 'أخرى', description: '', date: new Date().toISOString().split('T')[0] }

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#6b7280']

export default function Expenses() {
  const { user } = useAuth()
  const [list, setList]           = useState<any[]>([])
  const [summary, setSummary]     = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('الكل')
  const [monthFilter, setMonth]   = useState(() => new Date().toISOString().slice(0, 7))
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    if (!user) return
    setLoading(true)
    const [rows, sumRows] = await Promise.all([
      api.expensesList({ pharmacyId: user.pharmacyId, month: monthFilter }),
      api.expensesSummary({ pharmacyId: user.pharmacyId, month: monthFilter }),
    ])
    setList(rows)
    setSummary(sumRows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user, monthFilter])

  const filtered = list.filter(e => {
    const matchSearch = !search || (e.description || '').includes(search) || e.category.includes(search)
    const matchCat    = catFilter === 'الكل' || e.category === catFilter
    return matchSearch && matchCat
  })

  const totalMonth = list.reduce((s, e) => s + Number(e.amount), 0)

  async function save() {
    if (!form.amount || isNaN(Number(form.amount))) { setError('المبلغ مطلوب'); return }
    if (!form.date) { setError('التاريخ مطلوب'); return }
    setSaving(true); setError('')
    await api.expensesAdd({
      pharmacyId:  user!.pharmacyId,
      amount:      parseFloat(form.amount),
      category:    form.category,
      description: form.description.trim() || null,
      date:        form.date,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ ...EMPTY })
    load()
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">المصروفات</h1>
          <p className="text-slate-400 text-sm mt-0.5">إجمالي الشهر: <span className="text-red-400 font-semibold">{totalMonth.toFixed(2)} ر.س</span></p>
        </div>
        <button className="btn-primary px-5 py-2" onClick={() => { setForm({ ...EMPTY }); setError(''); setShowForm(true) }}>💸 إضافة مصروف</button>
      </div>

      {/* Summary chart */}
      {summary.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">📊 توزيع المصروفات — {monthFilter}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={summary} layout="vertical">
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)} ر.س`, '']}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {summary.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="month"
          className="input w-44"
          value={monthFilter}
          onChange={e => setMonth(e.target.value)}
        />
        <select className="input w-44" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option>الكل</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <input
          className="input w-56"
          placeholder="🔍 بحث..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-slate-500 text-sm mr-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-right py-3 px-4 font-medium">التاريخ</th>
              <th className="text-right py-3 px-4 font-medium">الفئة</th>
              <th className="text-right py-3 px-4 font-medium">الوصف</th>
              <th className="text-right py-3 px-4 font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-16 text-slate-500">⏳ جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-16 text-slate-500">لا توجد مصروفات في هذه الفترة</td></tr>
            ) : filtered.map(e => (
              <tr key={e.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 text-slate-400 text-xs">{e.date}</td>
                <td className="py-3 px-4">
                  <span className="badge badge-blue text-xs">{e.category}</span>
                </td>
                <td className="py-3 px-4 text-slate-300">{e.description || '—'}</td>
                <td className="py-3 px-4 font-semibold text-red-400">{Number(e.amount).toFixed(2)} ر.س</td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-700">
                <td colSpan={3} className="py-3 px-4 text-slate-400 text-sm font-medium">الإجمالي</td>
                <td className="py-3 px-4 font-bold text-red-400">{filtered.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)} ر.س</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">💸 إضافة مصروف</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">المبلغ (ر.س) *</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" />
                </div>
                <div>
                  <label className="label">التاريخ *</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">الفئة</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">الوصف</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="مثال: إيجار شهر أبريل..." />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : '💸 إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
