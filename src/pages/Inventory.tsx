import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const CATEGORIES = ['كل الفئات', 'مضادات حيوية', 'مسكنات', 'أدوية القلب', 'أدوية السكري', 'فيتامينات', 'مضادات الحساسية', 'أدوية الجهاز الهضمي', 'أدوية العيون', 'أدوية الجلد', 'أدوية الجهاز التنفسي', 'مكملات غذائية', 'أخرى']

function expiryBadge(expiry: string) {
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0)   return <span className="badge badge-red">منتهية</span>
  if (days <= 7)  return <span className="badge badge-red">{days} يوم</span>
  if (days <= 30) return <span className="badge badge-yellow">{days} يوم</span>
  return <span className="badge badge-green">{days} يوم</span>
}

const EMPTY = { name: '', barcode: '', category: 'أخرى', batchNumber: '', expiryDate: '', quantity: '', minQuantity: '10', unitPrice: '', salePrice: '' }

export default function Inventory() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('كل الفئات')
  const [statusFilter, setStatusFilter] = useState('الكل')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.inventoryList({ pharmacyId: user.pharmacyId, search: '', category: '', status: '' })
    setItems(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const filtered = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.barcode || '').includes(search)
    const matchCat = catFilter === 'كل الفئات' || i.category === catFilter
    const days = Math.floor((new Date(i.expiry_date).getTime() - Date.now()) / 86400000)
    const matchStatus =
      statusFilter === 'الكل' ? true :
      statusFilter === 'منتهية' ? days < 0 :
      statusFilter === 'حرجة' ? days >= 0 && days <= 30 :
      statusFilter === 'منخفض' ? i.quantity <= i.min_quantity :
      true
    return matchSearch && matchCat && matchStatus
  })

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY })
    setError('')
    setShowForm(true)
  }

  function openEdit(item: any) {
    setEditing(item)
    setForm({
      name: item.name,
      barcode: item.barcode || '',
      category: item.category,
      batchNumber: item.batch_number || '',
      expiryDate: item.expiry_date,
      quantity: String(item.quantity),
      minQuantity: String(item.min_quantity),
      unitPrice: String(item.unit_price),
      salePrice: String(item.sale_price || ''),
    })
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim())     { setError('اسم الدواء مطلوب'); return }
    if (!form.expiryDate)      { setError('تاريخ الانتهاء مطلوب'); return }
    if (!form.quantity)        { setError('الكمية مطلوبة'); return }
    if (!form.unitPrice)       { setError('سعر الشراء مطلوب'); return }
    setSaving(true); setError('')
    const payload = {
      pharmacyId:  user!.pharmacyId,
      name:        form.name.trim(),
      barcode:     form.barcode.trim() || null,
      category:    form.category,
      batchNumber: form.batchNumber.trim() || null,
      expiryDate:  form.expiryDate,
      quantity:    Number(form.quantity),
      minQuantity: Number(form.minQuantity) || 10,
      unitPrice:   parseFloat(form.unitPrice),
      salePrice:   form.salePrice ? parseFloat(form.salePrice) : null,
    }
    if (editing) {
      await api.inventoryUpdate({ ...payload, id: editing.id })
    } else {
      await api.inventoryAdd(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function doDelete(id: number) {
    await api.inventoryDelete({ id, pharmacyId: user!.pharmacyId })
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">المخزون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} صنف مسجل</p>
        </div>
        <button className="btn-primary px-5 py-2" onClick={openAdd}>➕ إضافة دواء</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          ref={searchRef}
          className="input w-64"
          placeholder="🔍 بحث بالاسم أو الباركود..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-44" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="flex gap-1">
          {['الكل', 'منتهية', 'حرجة', 'منخفض'].map(s => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              onClick={() => setStatusFilter(s)}
            >{s}</button>
          ))}
        </div>
        <span className="text-slate-500 text-sm mr-auto">{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-right py-3 px-4 font-medium">الدواء</th>
              <th className="text-right py-3 px-4 font-medium">الفئة</th>
              <th className="text-right py-3 px-4 font-medium">الكمية</th>
              <th className="text-right py-3 px-4 font-medium">سعر الشراء</th>
              <th className="text-right py-3 px-4 font-medium">تاريخ الانتهاء</th>
              <th className="text-right py-3 px-4 font-medium">الحالة</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-500">⏳ جاري التحميل...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 text-slate-500">لا توجد نتائج</td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-medium text-white">{item.name}</div>
                  {item.batch_number && <div className="text-xs text-slate-500">دفعة: {item.batch_number}</div>}
                  {item.barcode && <div className="text-xs text-slate-600">{item.barcode}</div>}
                </td>
                <td className="py-3 px-4 text-slate-400 text-xs">{item.category}</td>
                <td className="py-3 px-4">
                  <span className={item.quantity <= item.min_quantity ? 'text-amber-400 font-semibold' : 'text-white'}>
                    {item.quantity}
                  </span>
                  <span className="text-slate-600 text-xs"> / {item.min_quantity}</span>
                </td>
                <td className="py-3 px-4 text-slate-300">{Number(item.unit_price).toFixed(2)} ر.س</td>
                <td className="py-3 px-4 text-slate-400 text-xs">{item.expiry_date}</td>
                <td className="py-3 px-4">{expiryBadge(item.expiry_date)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button className="text-slate-400 hover:text-blue-400 text-xs transition-colors" onClick={() => openEdit(item)}>تعديل</button>
                    <button className="text-slate-400 hover:text-red-400 text-xs transition-colors" onClick={() => setConfirmDelete(item.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? '✏️ تعديل الدواء' : '➕ إضافة دواء جديد'}</h2>
            {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>}
            <div className="space-y-3">
              <div>
                <label className="label">اسم الدواء *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="مثال: أموكسيسيلين 500 مجم" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الفئة</label>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">الباركود</label>
                  <input className="input font-mono text-sm" value={form.barcode} onChange={e => setForm(f => ({...f, barcode: e.target.value}))} placeholder="اختياري" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">رقم الدفعة</label>
                  <input className="input" value={form.batchNumber} onChange={e => setForm(f => ({...f, batchNumber: e.target.value}))} placeholder="اختياري" />
                </div>
                <div>
                  <label className="label">تاريخ الانتهاء *</label>
                  <input className="input" type="date" value={form.expiryDate} onChange={e => setForm(f => ({...f, expiryDate: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">الكمية *</label>
                  <input className="input" type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} />
                </div>
                <div>
                  <label className="label">الحد الأدنى</label>
                  <input className="input" type="number" min="0" value={form.minQuantity} onChange={e => setForm(f => ({...f, minQuantity: e.target.value}))} />
                </div>
                <div>
                  <label className="label">سعر الشراء *</label>
                  <input className="input" type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(f => ({...f, unitPrice: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="label">سعر البيع</label>
                <input className="input" type="number" step="0.01" min="0" value={form.salePrice} onChange={e => setForm(f => ({...f, salePrice: e.target.value}))} placeholder="اختياري" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>إلغاء</button>
              <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : editing ? '💾 حفظ التغييرات' : '➕ إضافة'}
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
            <p className="text-slate-400 text-sm mb-5">سيتم حذف هذا الدواء نهائياً. هل أنت متأكد؟</p>
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
