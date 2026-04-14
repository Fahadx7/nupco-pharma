import { useAuth } from '../stores/auth'
import { api } from '../lib/ipc'

export default function Support() {
  const { user } = useAuth()

  function openTelegram() {
    api.openUrl('https://t.me/AbuAmran2000_10')
  }

  return (
    <div className="space-y-6 fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">الدعم الفني</h1>
        <p className="text-slate-400 text-sm mt-1">نحن هنا لمساعدتك — تواصل معنا في أي وقت</p>
      </div>

      {/* Contact card */}
      <div className="card bg-gradient-to-br from-blue-900/30 to-slate-900 border-blue-700/50 text-center py-8">
        <div className="text-5xl mb-4">💬</div>
        <h2 className="text-xl font-bold text-white mb-2">تواصل مع الدعم</h2>
        <p className="text-slate-400 text-sm mb-6">للمساعدة الفورية أو الاستفسارات، راسلنا مباشرة على تيليجرام</p>
        <button
          className="btn-primary px-8 py-3 text-base mx-auto"
          onClick={openTelegram}
        >
          📱 @AbuAmran2000_10
        </button>
        <p className="text-slate-600 text-xs mt-3">يُفضَّل إرسال لقطة شاشة للمشكلة</p>
      </div>

      {/* FAQ */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">❓ أسئلة شائعة</h3>
        {[
          {
            q: 'كيف أُضيف دواءً جديداً للمخزون؟',
            a: 'اذهب إلى صفحة المخزون ← اضغط "إضافة دواء" ← أدخل البيانات ← احفظ.',
          },
          {
            q: 'لماذا لا تصلني إشعارات التيليجرام؟',
            a: 'تأكد من إدخال Bot Token وChat ID الصحيحين في صفحة إعدادات تيليجرام، واختبر الاتصال.',
          },
          {
            q: 'كيف أُضيف موظفاً جديداً؟',
            a: 'اذهب إلى صفحة الموظفون ← اضغط "إضافة موظف" (يتطلب صلاحية مدير).',
          },
          {
            q: 'هل البيانات محفوظة محلياً فقط؟',
            a: 'نعم. جميع البيانات مخزنة على جهازك فقط في قاعدة بيانات SQLite. لا يُرفع أي شيء للإنترنت.',
          },
          {
            q: 'كيف أعمل نسخة احتياطية؟',
            a: 'انسخ ملف pharmacy.db الموجود في مجلد التطبيق إلى مكان آمن.',
          },
        ].map(({ q, a }) => (
          <details key={q} className="group border border-slate-700 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-slate-200 hover:bg-slate-800/50 transition-colors list-none">
              <span>{q}</span>
              <span className="text-slate-500 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <div className="px-4 py-3 text-sm text-slate-400 border-t border-slate-700 bg-slate-800/20">
              {a}
            </div>
          </details>
        ))}
      </div>

      {/* App info */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">ℹ️ معلومات التطبيق</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'الإصدار',       value: 'v4.0.0' },
            { label: 'الصيدلية',      value: user?.pharmacyName || '—' },
            { label: 'المستخدم',      value: user?.name || '—' },
            { label: 'قاعدة البيانات', value: 'SQLite (محلي)' },
            { label: 'المطوّر',       value: 'فهد A' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-300">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-slate-600 text-xs">
        صُنع بـ❤️ فهد A — نوبكو فارما v4.0
      </div>
    </div>
  )
}
