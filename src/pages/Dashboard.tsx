import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (user) api.dashboardStats(user.pharmacyId).then(setStats)
  }, [user])

  if (!stats) return <div className="flex items-center justify-center h-64 text-slate-400">⏳ جاري التحميل...</div>

  const cards = [
    { label: 'إجمالي المخزون',    value: stats.totalInv,   color: 'text-blue-400',    icon: '💊', to: '/inventory' },
    { label: 'مبيعات اليوم',      value: `${stats.salesToday.toFixed(0)} ر.س`, color: 'text-emerald-400', icon: '💰', to: null },
    { label: 'مبيعات الشهر',      value: `${stats.salesMonth.toFixed(0)} ر.س`, color: 'text-violet-400',  icon: '📈', to: null },
    { label: 'وصفات معلقة',       value: stats.rxPending,  color: 'text-amber-400',   icon: '📋', to: '/prescriptions' },
    { label: 'منتهية الصلاحية',   value: stats.expired,    color: 'text-red-400',     icon: '❌', to: '/inventory' },
    { label: 'تنتهي خلال 7 أيام', value: stats.critical,   color: 'text-orange-400',  icon: '⚠️', to: '/inventory' },
    { label: 'مخزون منخفض',       value: stats.lowStock,   color: 'text-yellow-400',  icon: '📦', to: '/inventory' },
    { label: 'إجمالي المرضى',     value: stats.customers,  color: 'text-sky-400',     icon: '👥', to: '/customers' },
  ]

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">لوحة التحكم</h1>
        <p className="text-slate-400 text-sm mt-1">مرحباً {user?.name} 👋 — {new Date().toLocaleDateString('ar-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <div
            key={c.label}
            className={`stat-card ${c.to ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''}`}
            onClick={() => c.to && navigate(c.to)}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl">{c.icon}</span>
              <span className="text-xs text-slate-500">{c.label}</span>
            </div>
            <div className={`stat-num ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Sales chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">📈 مبيعات آخر 7 أيام (ر.س)</h3>
        {stats.chartData?.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                formatter={(v: any) => [`${Number(v).toFixed(2)} ر.س`, 'المبيعات']}
              />
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-slate-500 text-sm">لا توجد مبيعات خلال الأسبوع الماضي</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">⚡ إجراءات سريعة</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'إضافة دواء',     icon: '➕', to: '/inventory' },
            { label: 'وصفة جديدة',     icon: '📋', to: '/prescriptions' },
            { label: 'عميل جديد',      icon: '👤', to: '/customers' },
            { label: 'تقرير المصروفات', icon: '💰', to: '/expenses' },
          ].map(a => (
            <button key={a.label} onClick={() => navigate(a.to)} className="btn-secondary py-3 flex-col gap-1 h-auto">
              <span className="text-xl">{a.icon}</span>
              <span className="text-xs">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
