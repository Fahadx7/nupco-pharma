# 📥 دليل تثبيت وتشغيل بوت نوبكو فارما

## المتطلبات الأساسية
- نظام Windows 10 أو 11 (يُفضل).
- اتصال بالإنترنت لتحميل المكتبات.

## خطوة بخطوة (نصي)

### 1. تثبيت Node.js
- قم بتحميل أحدث إصدار LTS من [nodejs.org](https://nodejs.org).
- شغل المثبت، وتأكد من تفعيل خيار "Add to PATH".
- أعد تشغيل الكمبيوتر بعد التثبيت (اختياري).

### 2. تحميل المشروع
- قم إما بـ `git clone https://github.com/Fahadx7/nupco-pharma.git` أو فك ضغط المجلد.

### 3. استخراج توكن البوت
- افتح تليجرام → ابحث عن `@BotFather`.
- أرسل `/newbot`، اختر اسماً واسم مستخدم.
- انسخ الـ `API token`.

### 4. استخراج مفتاح Groq API
- اذهب إلى [console.groq.com](https://console.groq.com) وسجل الدخول.
- اختر `API Keys` → `Create API Key`، انسخ المفتاح (يبدأ بـ `gsk_`).

### 5. الحصول على Chat ID
- ابحث عن `@userinfobot` في تليجرام وأرسل `/start`، انسخ الرقم.

### 6. تشغيل سكريبت التثبيت
- افتح PowerShell داخل مجلد المشروع.
- اكتب: `.\install.ps1` ثم Enter.

### 7. إعداد التوكنات عبر المتصفح
- سيفتح المتصفح على `http://localhost:3000`.
- أدخل BOT_TOKEN، MY_CHAT_ID، GROQ_API_KEY، PHARMACY_NAME.
- اضغط حفظ.

### 8. التشغيل والتأكد
- أرسل `/start` للبوت في تليجرام.
- جرب `/scan` مع صورة فاتورة.

## ملاحظات مهمة
- لا تشارك ملف `config.json` مع أحد.
- لوحة التحكم: `http://localhost:3000`.

## 🆘 استكشاف الأخطاء
- **"node not recognized"**: ثبّت Node.js وأعد تشغيل الطرفية.
- **"cannot load install.ps1"**: نفّذ `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- **PDF لا يعمل**: ثبّت Ghostscript (رابط في README.md).
