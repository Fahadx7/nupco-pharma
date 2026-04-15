import { useEffect, useState } from 'react'
import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

export default function TelegramSettings() {
  const { user } = useAuth()
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId]     = useState('')
  const [enabled, setEnabled]   = useState(true)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!user) return
    api.telegramGet(user.pharmacyId).then(data => {
      if (data) {
        setBotToken(data.bot_token || '')
        setChatId(data.chat_id || '')
        setEnabled(data.enabled !== false)
      }
      setLoading(false)
    })
  }, [user])

  async function test() {
    if (!botToken || !chatId) { setError('أدخل التوكن والـ Chat ID أولاً'); return }
    setTesting(true); setError(''); setTestResult(null)
    const res = await api.telegramTest({ botToken, chatId })
    setTesting(false)
    setTestResult(res.ok
      ? { ok: true,  msg: '✅ تم إرسال رسالة اختبار بنجاح!' }
      : { ok: false, msg: `❌ فشل الاتصال: ${res.error || 'تحقق من التوكن والـ Chat ID'}` }
    )
  }

  async function save() {
    if (!botToken || !chatId) { setError('التوكن والـ Chat ID مطلوبان'); return }
    setSaving(true); setError(''); setSaved(false)
    await api.telegramSave({ pharmacyId: user!.pharmacyId, botToken, chatId, enabled })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">⏳ جاري التحميل...</div>

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">إعدادات تيليجرام</h1>
        <p className="text-slate-400 text-sm mt-1">ربط البوت لإرسال التنبيهات والتقارير اليومية</p>
      </div>

      {/* Status card */}
      <div className={`card border ${botToken && chatId ? 'border-emerald-700/50 bg-emerald-900/10' : 'border-slate-700'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${botToken && chatId ? 'bg-emerald-500' : 'bg-slate-600'}`} />
          <span className={`font-medium ${botToken && chatId ? 'text-emerald-400' : 'text-slate-400'}`}>
            {botToken && chatId ? 'البوت متصل ونشط' : 'البوت غير مُهيأ'}
          </span>
          {botToken && chatId && (
            <label className="mr-auto flex items-center gap-2 cursor-pointer">
              <span className="text-slate-400 text-sm">تفعيل</span>
              <div
                className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                onClick={() => setEnabled(e => !e)}
              >
                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="card bg-blue-900/10 border-blue-800/40">
        <h3 className="text-sm font-semibold text-blue-300 mb-3">📋 كيفية الإعداد</h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">1.</span>
            <div>
              <p className="font-medium">إنشاء البوت</p>
              <p className="text-slate-400 mt-0.5">افتح تيليجرام → ابحث عن <strong className="text-white">@BotFather</strong> → أرسل <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">/newbot</code> → اتبع التعليمات → انسخ التوكن</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold shrink-0">2.</span>
            <div>
              <p className="font-medium">الحصول على Chat ID</p>
              <p className="text-slate-400 mt-0.5">أرسل رسالة لبوتك الجديد، ثم افتح:</p>
              <code className="block bg-slate-800 px-2 py-1 rounded text-xs mt-1 text-slate-300 break-all">
                https://api.telegram.org/bot{'<TOKEN>'}/getUpdates
              </code>
              <p className="text-slate-400 mt-1">ابحث عن <code className="bg-slate-800 px-1 rounded text-xs">chat.id</code> في النتيجة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">⚙️ بيانات الاتصال</h3>

        {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">⚠️ {error}</div>}

        <div>
          <label className="label">Bot Token</label>
          <input
            className="input font-mono text-xs"
            placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
            value={botToken}
            onChange={e => { setBotToken(e.target.value); setTestResult(null) }}
          />
        </div>
        <div>
          <label className="label">Chat ID</label>
          <input
            className="input font-mono"
            placeholder="123456789"
            value={chatId}
            onChange={e => { setChatId(e.target.value); setTestResult(null) }}
          />
        </div>

        {testResult && (
          <div className={`rounded-lg px-3 py-2 text-sm ${testResult.ok ? 'bg-emerald-900/30 border border-emerald-700 text-emerald-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
            {testResult.msg}
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn-secondary px-4 py-2" onClick={test} disabled={testing || saving}>
            {testing ? '⏳ جاري الاختبار...' : '🔌 اختبار الاتصال'}
          </button>
          <button className="btn-primary flex-1 py-2" onClick={save} disabled={saving}>
            {saving ? '⏳ جاري الحفظ...' : saved ? '✅ تم الحفظ!' : '💾 حفظ الإعدادات'}
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">📣 ما يرسله البوت تلقائياً</h3>
        <div className="space-y-2 text-sm">
          {[
            { icon: '🌅', label: 'تقرير يومي', desc: 'ملخص المخزون والمبيعات كل صباح الساعة 9' },
            { icon: '📦', label: 'تنبيه مخزون منخفض', desc: 'عند نقص أي صنف عن الحد الأدنى' },
            { icon: '❌', label: 'تنبيه انتهاء الصلاحية', desc: 'قبل 30 يوم من انتهاء صلاحية الأدوية' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
              <span className="text-lg">{f.icon}</span>
              <div>
                <div className="font-medium text-white text-xs">{f.label}</div>
                <div className="text-slate-500 text-xs">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
