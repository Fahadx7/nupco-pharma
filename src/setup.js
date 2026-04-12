'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const http    = require('http');

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

// ── قراءة وحفظ الإعدادات ─────────────────────────────────────────────────────

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function isConfigComplete(config) {
    return !!(config && config.BOT_TOKEN && config.MY_CHAT_ID && config.GROQ_API_KEY);
}

// ── Wizard الإعداد الأول ──────────────────────────────────────────────────────

function startSetupWizard() {
    return new Promise((resolve, reject) => {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // صفحة الإعداد
        app.get('/', (_req, res) => res.send(SETUP_HTML));

        // حفظ الإعدادات
        app.post('/save', (req, res) => {
            const { pharmacy_name, bot_token, chat_id, groq_key } = req.body;

            if (!bot_token?.trim() || !chat_id?.trim() || !groq_key?.trim()) {
                return res.json({ success: false, message: 'جميع الحقول مطلوبة' });
            }

            const config = {
                PHARMACY_NAME : (pharmacy_name || 'صيدليتي').trim(),
                BOT_TOKEN     : bot_token.trim(),
                MY_CHAT_ID    : chat_id.trim(),
                GROQ_API_KEY  : groq_key.trim(),
            };

            saveConfig(config);
            res.json({ success: true });

            // إغلاق السيرفر وتمرير الإعدادات
            setTimeout(() => { server.close(); resolve(config); }, 800);
        });

        const server = http.createServer(app);
        server.listen(3000, '127.0.0.1', () => {
            console.log('\n═══════════════════════════════════════════');
            console.log('  💊 نوبكو فارما — إعداد أولي مطلوب');
            console.log('═══════════════════════════════════════════');
            console.log('  افتح المتصفح على: http://localhost:3000');
            console.log('═══════════════════════════════════════════\n');

            // Windows: فتح المتصفح تلقائياً
            const { exec } = require('child_process');
            exec('start http://localhost:3000', (err) => {
                if (err) exec('xdg-open http://localhost:3000', () => {}); // Linux fallback
            });
        });

        server.on('error', reject);
    });
}

// ── HTML صفحة الإعداد ─────────────────────────────────────────────────────────

const SETUP_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>إعداد نوبكو فارما</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: white;
    border-radius: 20px;
    padding: 40px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  .header {
    text-align: center;
    margin-bottom: 32px;
  }
  .header .icon { font-size: 56px; display: block; margin-bottom: 12px; }
  .header h1 { font-size: 26px; color: #1e40af; font-weight: 700; }
  .header p { color: #6b7280; font-size: 14px; margin-top: 6px; }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #1e40af;
    background: #eff6ff;
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-right: 4px solid #2563eb;
  }
  .field { margin-bottom: 18px; }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: #374151;
  }
  label .optional {
    font-weight: 400;
    color: #9ca3af;
    font-size: 12px;
  }
  input {
    width: 100%;
    padding: 11px 14px;
    border: 1.5px solid #d1d5db;
    border-radius: 9px;
    font-size: 14px;
    direction: ltr;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #fafafa;
  }
  input:focus {
    outline: none;
    border-color: #2563eb;
    background: white;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
  }
  .hint {
    font-size: 12px;
    color: #6b7280;
    margin-top: 5px;
    line-height: 1.5;
  }
  .hint a { color: #2563eb; text-decoration: none; }
  .hint a:hover { text-decoration: underline; }
  .btn {
    width: 100%;
    padding: 13px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 8px;
  }
  .btn:hover  { background: #1d4ed8; }
  .btn:active { transform: scale(0.99); }
  .btn:disabled { background: #93c5fd; cursor: not-allowed; }
  .success { display: none; text-align: center; padding: 10px 0; }
  .success .big { font-size: 64px; margin-bottom: 12px; }
  .success h2 { color: #16a34a; font-size: 22px; margin-bottom: 8px; }
  .success p { color: #6b7280; font-size: 14px; line-height: 1.6; }
  .divider { height: 1px; background: #f3f4f6; margin: 24px 0; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <span class="icon">💊</span>
    <h1>نوبكو فارما</h1>
    <p>إعداد البوت — مرة واحدة فقط ✓</p>
  </div>

  <div id="form-wrap">
    <div class="section-title">⚙️ إعدادات الصيدلية والبوت</div>
    <form id="form" autocomplete="off">

      <div class="field">
        <label>اسم الصيدلية <span class="optional">(اختياري)</span></label>
        <input type="text" name="pharmacy_name" placeholder="مثال: صيدلية مستشفى الملك فهد">
      </div>

      <div class="divider"></div>

      <div class="field">
        <label>توكن البوت <code>(BOT_TOKEN)</code></label>
        <input type="text" name="bot_token" placeholder="110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" required>
        <p class="hint">
          1. افتح تليجرام وابحث عن <strong>@BotFather</strong><br>
          2. أرسل <code>/newbot</code> واتبع التعليمات<br>
          3. انسخ التوكن والصقه هنا
        </p>
      </div>

      <div class="field">
        <label>Chat ID الخاص بك</label>
        <input type="text" name="chat_id" placeholder="123456789" required>
        <p class="hint">
          افتح تليجرام وأرسل أي رسالة لـ <strong>@userinfobot</strong> — سيردّ برقم ID الخاص بك
        </p>
      </div>

      <div class="divider"></div>

      <div class="field">
        <label>مفتاح Groq AI <code>(API Key)</code></label>
        <input type="text" name="groq_key" placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required>
        <p class="hint">
          سجّل مجاناً على <a href="https://console.groq.com" target="_blank">console.groq.com</a> ← API Keys ← Create new key
        </p>
      </div>

      <button type="submit" class="btn" id="submit-btn">🚀 ابدأ البوت</button>
    </form>
  </div>

  <div class="success" id="success">
    <div class="big">✅</div>
    <h2>تم الإعداد بنجاح!</h2>
    <p>
      البوت يعمل الآن.<br>
      افتح تليجرام وأرسل <strong>/start</strong> للبوت الخاص بك.
    </p>
  </div>
</div>

<script>
document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.textContent = '⏳ جاري الحفظ...';
  btn.disabled = true;

  try {
    const body = new URLSearchParams(new FormData(e.target));
    const res  = await fetch('/save', { method: 'POST', body });
    const json = await res.json();

    if (json.success) {
      document.getElementById('form-wrap').style.display = 'none';
      document.getElementById('success').style.display   = 'block';
    } else {
      alert('⚠️ ' + json.message);
      btn.textContent = '🚀 ابدأ البوت';
      btn.disabled = false;
    }
  } catch {
    alert('❌ حدث خطأ. تأكد أن البرنامج يعمل وأعد المحاولة.');
    btn.textContent = '🚀 ابدأ البوت';
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;

module.exports = { loadConfig, saveConfig, isConfigComplete, startSetupWizard, CONFIG_PATH };
