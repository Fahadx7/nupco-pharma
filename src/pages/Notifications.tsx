import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

const TYPE_MAP: Record<string, { icon: string; cls: string }> = {
  expiry:    { icon: '❌', cls: 'text-red-400'    },
  low_stock: { icon: '📦', cls: 'text-amber-400'  },
  telegram:  { icon: '📱', cls: 'text-blue-400'   },
  system:    { icon: '⚙️', cls: 'text-slate-400'  },
  info:      { icon: 'ℹ️', cls: 'text-sky-400'    },
}

export default function Notifications() {
  const { user } = useAuth()
  const [list, setList]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('الكل')

  async function load() {
    if (!user) return
    setLoading(true)
    const rows = await api.notifList(user.pharmacyId)
    setList(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function markAllRead() {
    await api.notifReadAll(user!.pharmacyId)
    load()
  }

  const unread = list.filter(n => !n.is_read).length

  const filtered = list.filter(n => {
    if (filter === 'الكل')    return true
    if (filter === 'غير مقروءة') return !n.is_read
    if (filter === 'انتهاء صلاحية') return n.type === 'expiry'
    if (filter === 'مخزون منخفض')   return n.type === 'low_stock'
    return true
  })

  function relativeTime(ts: string) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)    return 'الآن'
    if (mins < 60)   return `منذ ${mins} دقيقة`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)    return `منذ ${hrs} ساعة`
    const days = Math.floor(hrs / 24)
    return `منذ ${days} يوم`
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">الإشعارات</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {unread > 0
              ? <span className="text-amber-400 font-semibold">{unread} إشعار غير مقروء</span>
              : 'جميع الإشعارات مقروءة'}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn-secondary px-4 py-2 text-sm" onClick={markAllRead}>
            ✓ تحديد الكل كمقروء
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {['الكل', 'غير مقروءة', 'انتهاء صلاحية', 'مخزون منخفض'].map(f => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🔔</div>
          <div className="text-slate-500">لا توجد إشعارات</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const meta = TYPE_MAP[n.type] || TYPE_MAP.info
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-3 transition-colors ${!n.is_read ? 'border-slate-600 bg-slate-800/60' : 'opacity-70'}`}
              >
                <div className={`text-xl shrink-0 mt-0.5 ${meta.cls}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-relaxed ${!n.is_read ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {n.message}
                    </p>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{relativeTime(n.created_at)}</span>
                    <span className={`text-xs ${meta.cls}`}>{n.type}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
