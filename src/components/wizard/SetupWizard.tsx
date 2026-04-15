import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/ipc'
import { useAuth } from '../../stores/auth'

type Step = 1 | 2 | 3 | 4

export default function SetupWizard() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [step, setStep]             = useState<Step>(1)
  const [pharmacyId, setPharmacyId] = useState<number | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  // Step 1: Pharmacy profile
  const [pharmacy, setPharmacy] = useState({ name: '', address: '', phone: '', licenseNumber: '' })

  // Step 2: Telegram
  const [tg, setTg]           = useState({ botToken: '', chatId: '' })
  const [tgTested, setTgTested] = useState(false)
  const [tgSkipped, setTgSkipped] = useState(false)

  // Step 3: Admin credentials
  const [admin, setAdmin] = useState({ name: '', username: '', password: '', confirm: '' })

  async function step1Submit() {
    if (!pharmacy.name.trim()) { setError('اسم الصيدلية مطلوب'); return }
    setLoading(true); setError('')
    const res = await api.createPharmacy({ name: pharmacy.name, address: pharmacy.address, phone: pharmacy.phone, licenseNumber: pharmacy.licenseNumber })
    setLoading(false)
    if (res.ok) { setPharmacyId(res.pharmacyId); setStep(2) }
    else setError(res.error || 'خطأ في الحفظ')
  }

  async function testTelegram() {
    if (!tg.botToken || !tg.chatId) { setError('أدخل التوكن والـ Chat ID أولاً'); return }
    setLoading(true); setError('')
    const res = await api.testTelegram({ botToken: tg.botToken, chatId: tg.chatId })
    setLoading(false)
    if (res.ok) { setTgTested(true); setError('') }
    else setError(res.error || 'فشل الاتصال — تحقق من التوكن والـ Chat ID')
  }

  async function step2Submit(skip = false) {
    if (skip) { setTgSkipped(true); setStep(3); return }
    if (!tg.botToken || !tg.chatId) { setError('أدخل بيانات التيليجرام أو تخطَّ هذه الخطوة'); return }
    setLoading(true); setError('')
    await api.saveTelegram({ pharmacyId: pharmacyId!, botToken: tg.botToken, chatId: tg.chatId })
    setLoading(false)
    setStep(3)
  }

  async function step3Submit() {
    if (!admin.name || !admin.username || !admin.password) { setError('جميع الحقول مطلوبة'); return }
    if (admin.password !== admin.confirm) { setError('كلمتا المرور غير متطابقتين'); return }
    if (admin.password.length < 6) { setError('كلمة المرور 6 أحرف على الأقل'); return }
    setLoading(true); setError('')
    const res = await api.createAdmin({ pharmacyId: pharmacyId!, username: admin.username, password: admin.password, name: admin.name })
    if (res.ok) {
      await login(admin.username, admin.password)
      setStep(4)
    } else setError(res.error || 'خطأ في الإنشاء')
    setLoading(false)
  }

  const steps = [
    { n: 1, label: 'الصيدلية' },
    { n: 2, label: 'تيليجرام' },
    { n: 3, label: 'حساب المدير' },
    { n: 4, label: 'تم! 🎉' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-lg slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl text-2xl mb-3">💊</div>
          <h1 className="text-xl font-black text-white">إعداد نوبكو فارما</h1>
          <p className="text-slate-400 text-sm">خطوة {step} من 4</p>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map(s => (
            <div key={s.n} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${s.n <= step ? 'bg-blue-500' : 'bg-slate-700'}`} />
              <p className={`text-center text-xs mt-1 ${s.n === step ? 'text-blue-400 font-semibold' : 'text-slate-600'}`}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 shadow-2xl">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm mb-4">⚠️ {error}</div>
          )}

          {/* ── Step 1: Pharmacy ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">🏥 بيانات الصيدلية</h2>
              <div>
                <label className="label">اسم الصيدلية *</label>
                <input className="input" placeholder="مثال: صيدلية الأمين" value={pharmacy.name} onChange={e => setPharmacy(p => ({...p, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">العنوان</label>
                <input className="input" placeholder="الرياض — حي النزهة" value={pharmacy.address} onChange={e => setPharmacy(p => ({...p, address: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">رقم الهاتف</label>
                  <input className="input" placeholder="05xxxxxxxx" value={pharmacy.phone} onChange={e => setPharmacy(p => ({...p, phone: e.target.value}))} />
                </div>
                <div>
                  <label className="label">رقم الترخيص</label>
                  <input className="input" placeholder="LIC-0000" value={pharmacy.licenseNumber} onChange={e => setPharmacy(p => ({...p, licenseNumber: e.target.value}))} />
                </div>
              </div>
              <button className="btn-primary w-full py-2.5" onClick={step1Submit} disabled={loading}>
                {loading ? 'جاري الحفظ...' : 'التالي ◄'}
              </button>
            </div>
          )}

          {/* ── Step 2: Telegram ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">📱 ربط تيليجرام</h2>

              <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-blue-300">📋 كيفية الحصول على البيانات:</p>
                <div>
                  <p className="font-medium">1. Bot Token:</p>
                  <p className="text-slate-400">افتح تيليجرام → ابحث عن <strong>@BotFather</strong> → أرسل <code className="bg-slate-800 px-1 rounded">/newbot</code> → اتبع التعليمات → انسخ التوكن</p>
                </div>
                <div>
                  <p className="font-medium">2. Chat ID:</p>
                  <p className="text-slate-400">أرسل رسالة لبوتك → افتح: <code className="bg-slate-800 px-1 rounded text-xs">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> → ابحث عن <code>chat.id</code></p>
                </div>
              </div>

              <div>
                <label className="label">Bot Token</label>
                <input className="input font-mono text-xs" placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" value={tg.botToken} onChange={e => setTg(t => ({...t, botToken: e.target.value}))} />
              </div>
              <div>
                <label className="label">Chat ID</label>
                <input className="input font-mono" placeholder="123456789" value={tg.chatId} onChange={e => setTg(t => ({...t, chatId: e.target.value}))} />
              </div>

              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={testTelegram} disabled={loading}>
                  {loading ? '⏳ جاري الاختبار...' : '🔌 اختبار الاتصال'}
                </button>
                {tgTested && <div className="flex items-center text-emerald-400 text-sm px-3">✅ يعمل!</div>}
              </div>

              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => step2Submit(false)} disabled={loading}>التالي ◄</button>
                <button className="btn-ghost" onClick={() => step2Submit(true)}>تخطي</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Admin ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">👤 حساب المدير</h2>
              <div>
                <label className="label">الاسم الكامل</label>
                <input className="input" placeholder="فهد الأحمد" value={admin.name} onChange={e => setAdmin(a => ({...a, name: e.target.value}))} />
              </div>
              <div>
                <label className="label">اسم المستخدم (لتسجيل الدخول)</label>
                <input className="input" placeholder="admin" value={admin.username} onChange={e => setAdmin(a => ({...a, username: e.target.value}))} autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">كلمة المرور</label>
                  <input className="input" type="password" placeholder="6 أحرف+" value={admin.password} onChange={e => setAdmin(a => ({...a, password: e.target.value}))} />
                </div>
                <div>
                  <label className="label">تأكيد كلمة المرور</label>
                  <input className="input" type="password" placeholder="أعد كلمة المرور" value={admin.confirm} onChange={e => setAdmin(a => ({...a, confirm: e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setStep(2)}>◄ رجوع</button>
                <button className="btn-primary flex-1 py-2.5" onClick={step3Submit} disabled={loading}>
                  {loading ? 'جاري الإنشاء...' : '✅ إنشاء الحساب'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-xl font-black text-white">تم الإعداد بنجاح!</h2>
              <p className="text-slate-400">نوبكو فارما جاهز للاستخدام الآن.</p>
              <div className="text-sm text-slate-500">
                {tgSkipped ? '⚠️ يمكنك تفعيل تيليجرام لاحقاً من الإعدادات' : '✅ تيليجرام مربوط وجاهز'}
              </div>
              <button className="btn-primary w-full py-3 text-base mt-2" onClick={() => navigate('/')}>
                🚀 ابدأ الاستخدام
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">صُنع بـ❤️ فهد A</p>
      </div>
    </div>
  )
}
