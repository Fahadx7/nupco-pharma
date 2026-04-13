'use strict';
const express  = require('express');
const http     = require('http');
const { CONFIG_PATH } = require('./setup');
const { enableAutoStart, disableAutoStart, isAutoStartEnabled } = require('./autostart');

let _startTime = Date.now();

/**
 * يشغّل لوحة التحكم على localhost:3000 بعد بدء البوت
 * @param {string} pharmacyName
 * @param {import('better-sqlite3').Database} db - للحصول على إحصائيات سريعة
 */
function startStatusServer(pharmacyName, db) {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // ── الصفحة الرئيسية ───────────────────────────────────────────────────────
    app.get('/', (_req, res) => {
        const stats = getStats(db);
        const autoStart = isAutoStartEnabled();
        const uptime = formatUptime(Date.now() - _startTime);
        res.send(buildStatusHtml(pharmacyName, stats, autoStart, uptime));
    });

    // ── API: إحصائيات سريعة (للتحديث التلقائي) ───────────────────────────────
    app.get('/api/stats', (_req, res) => {
        res.json({
            uptime   : formatUptime(Date.now() - _startTime),
            ...getStats(db),
            autoStart: isAutoStartEnabled(),
        });
    });

    // ── تفعيل/إلغاء التشغيل التلقائي ─────────────────────────────────────────
    app.post('/autostart', (req, res) => {
        const enable = req.body.enable === 'true';
        const ok = enable ? enableAutoStart() : disableAutoStart();
        res.json({ success: ok, enabled: isAutoStartEnabled() });
    });

    // ── إعادة الإعداد (حذف config + إعادة التشغيل) ───────────────────────────
    app.post('/reset', (_req, res) => {
        res.json({ success: true });
        setTimeout(() => {
            const fs = require('fs');
            if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
            process.exit(0); // عند إعادة التشغيل سيفتح Wizard تلقائياً
        }, 600);
    });

    // ── إيقاف البوت ──────────────────────────────────────────────────────────
    app.post('/stop', (_req, res) => {
        res.json({ success: true });
        setTimeout(() => process.exit(0), 600);
    });

    const server = http.createServer(app);
    server.listen(3000, '127.0.0.1', () => {
        console.log('🌐 لوحة التحكم: http://localhost:3000');
    });

    return server;
}

// ── مساعدات ───────────────────────────────────────────────────────────────────

function getStats(db) {
    try {
        const total   = db.prepare("SELECT COUNT(*) as c FROM nupco_inventory WHERE status='active'").get()?.c ?? 0;
        const today   = new Date().toISOString().split('T')[0];
        const in7     = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
        const in30    = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const expired = db.prepare("SELECT COUNT(*) as c FROM nupco_inventory WHERE status='active' AND expiry_date < ?").get(today)?.c ?? 0;
        const week    = db.prepare("SELECT COUNT(*) as c FROM nupco_inventory WHERE status='active' AND expiry_date >= ? AND expiry_date <= ?").get(today, in7)?.c ?? 0;
        const month   = db.prepare("SELECT COUNT(*) as c FROM nupco_inventory WHERE status='active' AND expiry_date > ? AND expiry_date <= ?").get(in7, in30)?.c ?? 0;
        return { total, expired, week, month };
    } catch {
        return { total: 0, expired: 0, week: 0, month: 0 };
    }
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0)  return `${h} ساعة ${m % 60} دقيقة`;
    if (m > 0)  return `${m} دقيقة`;
    return `${s} ثانية`;
}

// ── HTML لوحة التحكم ──────────────────────────────────────────────────────────

function buildStatusHtml(pharmacyName, stats, autoStart, uptime) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pharmacyName} — لوحة التحكم</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; color: #1e293b; min-height: 100vh; }
  header {
    background: linear-gradient(135deg, #1e3a5f, #2563eb);
    color: white; padding: 20px 30px;
    display: flex; align-items: center; justify-content: space-between;
  }
  header h1 { font-size: 22px; font-weight: 700; }
  header h1 span { font-size: 14px; font-weight: 400; opacity: .8; margin-right: 10px; }
  .badge { background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .container { max-width: 900px; margin: 30px auto; padding: 0 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
  .card { background: white; border-radius: 14px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .card .num { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
  .card .lbl { font-size: 13px; color: #64748b; }
  .red   .num { color: #ef4444; }
  .orange .num { color: #f97316; }
  .blue  .num { color: #2563eb; }
  .green .num { color: #22c55e; }
  .section { background: white; border-radius: 14px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.07); margin-bottom: 20px; }
  .section h2 { font-size: 16px; font-weight: 700; margin-bottom: 18px; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 10px; }
  .row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  .row:last-child { border: none; }
  .row .label { font-size: 14px; color: #475569; }
  .row .val { font-size: 14px; font-weight: 600; }
  .toggle { position: relative; width: 48px; height: 26px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: #cbd5e1; border-radius: 26px; cursor: pointer; transition: .3s; }
  .slider:before { content: ''; position: absolute; width: 20px; height: 20px; right: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
  input:checked + .slider { background: #2563eb; }
  input:checked + .slider:before { transform: translateX(-22px); }
  .btn { padding: 9px 18px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: .2s; }
  .btn-danger  { background: #fee2e2; color: #dc2626; }
  .btn-danger:hover  { background: #fca5a5; }
  .btn-warn { background: #fef3c7; color: #d97706; }
  .btn-warn:hover { background: #fde68a; }
  .uptime { font-size: 12px; color: rgba(255,255,255,.7); margin-top: 4px; }
  #toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: #1e293b; color: white; padding: 10px 22px; border-radius: 10px; font-size: 14px; transition: transform .3s; opacity: 0; }
  #toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
</style>
</head>
<body>

<header>
  <div>
    <h1>💊 ${pharmacyName} <span>— بوت نوبكو</span></h1>
    <div class="uptime">يعمل منذ: ${uptime}</div>
  </div>
  <span class="badge">● يعمل</span>
</header>

<div class="container">

  <!-- إحصائيات المخزون -->
  <div class="cards">
    <div class="card blue">
      <div class="num" id="s-total">${stats.total}</div>
      <div class="lbl">إجمالي الأدوية</div>
    </div>
    <div class="card red">
      <div class="num" id="s-expired">${stats.expired}</div>
      <div class="lbl">منتهية الصلاحية</div>
    </div>
    <div class="card orange">
      <div class="num" id="s-week">${stats.week}</div>
      <div class="lbl">تنتهي خلال 7 أيام</div>
    </div>
    <div class="card green">
      <div class="num" id="s-month">${stats.month}</div>
      <div class="lbl">تنتهي خلال 30 يوم</div>
    </div>
  </div>

  <!-- الإعدادات -->
  <div class="section">
    <h2>⚙️ الإعدادات</h2>
    <div class="row">
      <span class="label">التشغيل التلقائي مع Windows</span>
      <label class="toggle">
        <input type="checkbox" id="autostart-chk" ${autoStart ? 'checked' : ''} onchange="toggleAutoStart(this.checked)">
        <span class="slider"></span>
      </label>
    </div>
    <div class="row">
      <span class="label">عنوان لوحة التحكم</span>
      <span class="val">http://localhost:3000</span>
    </div>
  </div>

  <!-- الإجراءات -->
  <div class="section">
    <h2>🛠️ إجراءات</h2>
    <div class="row">
      <span class="label">إعادة إعداد البوت (حذف الإعدادات وإعادة التشغيل)</span>
      <button class="btn btn-warn" onclick="resetConfig()">⚙️ إعادة الإعداد</button>
    </div>
    <div class="row">
      <span class="label">إيقاف البوت</span>
      <button class="btn btn-danger" onclick="stopBot()">⏹ إيقاف</button>
    </div>
  </div>

</div>

<div id="toast"></div>

<script>
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

async function toggleAutoStart(enable) {
  const res  = await fetch('/autostart', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: 'enable=' + enable });
  const json = await res.json();
  toast(json.enabled ? '✅ سيتشغل البوت تلقائياً مع Windows' : '🔕 تم إلغاء التشغيل التلقائي');
}

async function stopBot() {
  if (!confirm('هل أنت متأكد من إيقاف البوت؟')) return;
  await fetch('/stop', { method: 'POST' });
  toast('⏹ جاري الإيقاف...');
  setTimeout(() => document.body.innerHTML = '<div style="text-align:center;margin-top:120px;font-size:20px;color:#64748b">⏹ تم إيقاف البوت.</div>', 1000);
}

async function resetConfig() {
  if (!confirm('سيتم حذف الإعدادات وإعادة تشغيل الإعداد. متأكد؟')) return;
  await fetch('/reset', { method: 'POST' });
  toast('🔄 جاري إعادة التشغيل...');
}

// تحديث الإحصائيات كل 30 ثانية
setInterval(async () => {
  try {
    const data = await (await fetch('/api/stats')).json();
    document.getElementById('s-total').textContent   = data.total;
    document.getElementById('s-expired').textContent = data.expired;
    document.getElementById('s-week').textContent    = data.week;
    document.getElementById('s-month').textContent   = data.month;
  } catch {}
}, 30000);
</script>
</body>
</html>`;
}

module.exports = { startStatusServer };
