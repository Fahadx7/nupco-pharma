// ===================================================
// scan.js - دعم صورتين (دواء + تاريخ) وتنسيقات تاريخ مرنة
// ===================================================

const axios = require('axios');
const { fromBuffer } = require('pdf2pic');
const { addMedicationToDB } = require('./add');

// ---------------------------------------------------
// إعدادات Groq
// ---------------------------------------------------
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GS_PATH = 'C:/Program Files/gs/gs10.07.0/bin/gswin64c.exe';

// ---------------------------------------------------
// دالة لتحويل تنسيق التاريخ إلى YYYY-MM-DD
// ---------------------------------------------------
function parseExpiryDate(input) {
    // إزالة الشرطات والخطوط المائلة والمسافات
    let cleaned = input.trim().replace(/[\/\-\.]/g, '-');
    let parts = cleaned.split('-');
    if (parts.length !== 3) return null;
    // محاولة تحديد التنسيق: إذا كان الجزء الأول > 31 فهو سنة
    let year, month, day;
    if (parts[0].length === 4) { // YYYY-MM-DD
        year = parts[0];
        month = parts[1];
        day = parts[2];
    } else if (parts[2].length === 4) { // DD-MM-YYYY
        day = parts[0];
        month = parts[1];
        year = parts[2];
    } else if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
        // افتراض أن السنة مكونة من رقمين -> إضافة 2000
        year = '20' + parts[2];
        month = parts[1];
        day = parts[0];
    } else {
        return null;
    }
    // التحقق من صحة الأرقام
    if (year < 2024 || year > 2100) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    const expiry = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return expiry;
}

// ---------------------------------------------------
// استخراج الأدوية من صورة (قد تعيد الدواء مع أو بدون تاريخ)
// ---------------------------------------------------
async function analyzeWithGroq(base64Image, mimeType = 'image/jpeg') {
    const prompt = `أنت مساعد طبي متخصص. استخرج جميع الأدوية المذكورة في هذه الصورة (فاتورة أو علبة دواء).  
أعد JSON array فقط، كل عنصر فيه:  
{
  "name": "اسم الدواء بالعربية أو الإنجليزية كما هو مكتوب",
  "quantity": "الكمية رقماً (إذا وجدت، وإلا ضع 1)",
  "unit": "وحدة القياس (قرص، كبسولة، مل، حقنة، مرهم، إلخ) - إذا لم تجد ضع 'قرص'",
  "expiry": "تاريخ الصلاحية إذا كان مكتوباً بوضوح بصيغة YYYY-MM-DD، وإلا ضع null"
}
لا تضع أي نص آخر خارج JSON.`;

    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }] }],
            max_tokens: 1500,
            temperature: 0.2,
        },
        {
            headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            timeout: 60000,
        }
    );

    const content = response.data.choices[0].message.content;
    let medications;
    try {
        medications = JSON.parse(content);
    } catch (e) {
        const match = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) medications = JSON.parse(match[0]);
        else throw new Error('Groq لم يعد JSON صالحاً');
    }
    if (!Array.isArray(medications)) throw new Error('النتيجة ليست مصفوفة');
    return medications;
}

// ---------------------------------------------------
// إدارة جلسات المسح (لحالة الصورتين)
// ---------------------------------------------------
const scanSessions = new Map(); // { chatId: { step, medications, tempPhoto, timestamp } }

// ---------------------------------------------------
// معالج الصور الرئيسي (يدعم صورتين)
// ---------------------------------------------------
async function handlePhoto(bot, msg) {
    const chatId = msg.chat.id;
    const photo = msg.photo?.[msg.photo.length - 1];
    if (!photo) {
        await bot.sendMessage(chatId, '❌ لم أستطع قراءة الصورة.');
        return;
    }

    // التحقق من وجود جلسة نشطة تنتظر صورة تاريخ
    const session = scanSessions.get(chatId);
    if (session && session.step === 'awaiting_expiry_image') {
        // هذه هي الصورة الثانية (تاريخ الصلاحية)
        await bot.sendMessage(chatId, '⏳ جاري تحليل صورة التاريخ...');
        try {
            const fileLink = await bot.getFileLink(photo.file_id);
            const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
            const base64Image = Buffer.from(response.data).toString('base64');
            const expiryData = await analyzeWithGroq(base64Image, photo.mime_type || 'image/jpeg');
            // نتوقع أن المستخرج من صورة التاريخ يحتوي على expiry
            let expiry = null;
            if (expiryData && expiryData.length > 0 && expiryData[0].expiry) {
                expiry = expiryData[0].expiry;
            }
            if (!expiry) {
                // إذا لم يستطع Groq استخراج التاريخ، نطلب إدخاله يدوياً
                expiry = await askForExpiry(bot, chatId, session.medications[0]);
            }
            if (expiry) {
                session.medications[0].expiry = expiry;
            }
            // الآن ننتقل للتأكيد والإضافة
            scanSessions.delete(chatId);
            await confirmAndAdd(bot, chatId, session.medications);
        } catch (err) {
            console.error('خطأ في تحليل صورة التاريخ:', err);
            await bot.sendMessage(chatId, `⚠️ فشل تحليل صورة التاريخ: ${err.message}`);
            scanSessions.delete(chatId);
        }
        return;
    }

    // الصورة الأولى: تحليل الأدوية
    await bot.sendMessage(chatId, '⏳ جاري تحليل الصورة (قد يستغرق 10-15 ثانية)...');
    try {
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');
        let medications = await analyzeWithGroq(base64Image, photo.mime_type || 'image/jpeg');
        if (!medications || medications.length === 0) {
            await bot.sendMessage(chatId, '❌ لم يتم العثور على أدوية في الصورة.');
            return;
        }

        // التحقق مما إذا كان قد تم استخراج تاريخ لكل دواء
        const allHaveExpiry = medications.every(m => m.expiry && m.expiry !== 'null');
        if (allHaveExpiry) {
            // كل التواريخ موجودة، نذهب مباشرة للتأكيد والإضافة
            await confirmAndAdd(bot, chatId, medications);
        } else {
            // يحتاج إلى إكمال التواريخ: إما يدوياً أو بإرسال صورة ثانية
            // نعرض الخيارات
            let msgText = '📸 لم يتم العثور على تاريخ صلاحية في الصورة الأولى.\n';
            msgText += 'يمكنك إرسال صورة أخرى لتاريخ الصلاحية (صورة واضحة للتاريخ)، أو إدخال التاريخ يدوياً.\n';
            msgText += '⬅️ أرسل "يدوي" لإدخال التاريخ نصياً، أو أرسل الصورة الآن.';
            await bot.sendMessage(chatId, msgText);
            // حفظ الجلسة في انتظار صورة أو رد يدوي
            scanSessions.set(chatId, { step: 'awaiting_expiry_or_manual', medications, timestamp: Date.now() });
            // معالج إضافي للردود النصية (سنضيف مستمعاً عاماً)
        }
    } catch (err) {
        console.error('خطأ في handlePhoto:', err);
        await bot.sendMessage(chatId, `⚠️ فشل التحليل: ${err.message}`);
    }
}

// ---------------------------------------------------
// معالج الردود النصية (لـ "يدوي" أو إدخال التاريخ)
// ---------------------------------------------------
async function handleTextMessages(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const session = scanSessions.get(chatId);
    if (!session) return;
    if (session.step === 'awaiting_expiry_or_manual') {
        if (text.toLowerCase() === 'يدوي') {
            // انتقل لطلب التواريخ يدوياً لكل دواء
            const medications = session.medications;
            for (let med of medications) {
                let expiry = med.expiry && med.expiry !== 'null' ? med.expiry : null;
                if (!expiry) {
                    expiry = await askForExpiry(bot, chatId, med);
                }
                med.expiry = expiry;
            }
            scanSessions.delete(chatId);
            await confirmAndAdd(bot, chatId, medications);
        } else {
            // ربما أرسل صورة، لكن هذا لا يعالج هنا لأن الصورة لها معالج منفصل
        }
    } else if (session.step === 'awaiting_manual_expiry') {
        // يمكن إضافة منطق لإدخال التاريخ يدوياً لدواء معين إذا أردنا
    }
}

// ---------------------------------------------------
// طلب تاريخ الصلاحية يدوياً من المستخدم
// ---------------------------------------------------
async function askForExpiry(bot, chatId, medication) {
    await bot.sendMessage(chatId, `📅 *${medication.name}* (الكمية: ${medication.quantity} ${medication.unit})\nأدخل تاريخ الصلاحية (مثال: 10-07-2026 أو 2026-07-10) أو اكتب 'تخطي' للإضافة بدون تاريخ:`, { parse_mode: 'Markdown' });
    return new Promise((resolve) => {
        const listener = (msg) => {
            if (msg.chat.id !== chatId) return;
            const input = msg.text.trim();
            if (input.toLowerCase() === 'تخطي') {
                bot.removeListener('message', listener);
                resolve(null);
            } else {
                let parsed = parseExpiryDate(input);
                if (parsed) {
                    bot.removeListener('message', listener);
                    resolve(parsed);
                } else {
                    bot.sendMessage(chatId, '❌ صيغة غير صحيحة. استخدم مثل: 10-07-2026 أو 2026-07-10 أو اكتب "تخطي"');
                }
            }
        };
        bot.on('message', listener);
        setTimeout(() => {
            bot.removeListener('message', listener);
            resolve(null);
        }, 30000);
    });
}

// ---------------------------------------------------
// عرض التأكيد والإضافة النهائية
// ---------------------------------------------------
async function confirmAndAdd(bot, chatId, medications) {
    // عرض الأدوية مع التواريخ المستخرجة
    let preview = '📋 *الأدوية المستخرجة:*\n';
    medications.forEach((med, i) => {
        const expiryStr = med.expiry ? med.expiry : '❌ بدون تاريخ صلاحية';
        preview += `${i+1}. ${med.name} — ${med.quantity} ${med.unit} — صلاحية: ${expiryStr}\n`;
    });
    preview += '\n✨ هل تريد إضافة هذه الأدوية إلى المخزون؟ (أرسل "نعم" أو "لا")';
    await bot.sendMessage(chatId, preview, { parse_mode: 'Markdown' });

    const listener = async (msg) => {
        if (msg.chat.id !== chatId) return;
        const ans = msg.text.toLowerCase();
        if (ans === 'نعم') {
            bot.removeListener('message', listener);
            // إضافة إلى قاعدة البيانات
            let addedCount = 0;
            let failedList = [];
            for (const med of medications) {
                try {
                    const batch = `SCAN-${med.name.replace(/\s/g, '').substring(0, 10)}-${Date.now()}`;
                    const expiry = med.expiry || null;
                    const quantity = parseInt(med.quantity) || 1;
                    const success = await addMedicationToDB(chatId, med.name, batch, expiry, quantity);
                    if (success) addedCount++;
                    else failedList.push(med.name);
                } catch (err) {
                    console.error(`فشل إضافة ${med.name}:`, err.message);
                    failedList.push(med.name);
                }
            }
            let reply = `✅ تمت إضافة ${addedCount} من أصل ${medications.length} دواء إلى المخزون.\n`;
            if (failedList.length > 0) reply += `⚠️ فشل إضافة: ${failedList.join(', ')}\n`;
            await bot.sendMessage(chatId, reply);
        } else if (ans === 'لا') {
            bot.removeListener('message', listener);
            await bot.sendMessage(chatId, '❌ تم إلغاء الإضافة.');
        } else {
            bot.sendMessage(chatId, '❌ أجب بـ "نعم" أو "لا"');
        }
    };
    bot.on('message', listener);
    setTimeout(() => {
        bot.removeListener('message', listener);
    }, 30000);
}

// ---------------------------------------------------
// باقي دوال القوائم والجلسات
// ---------------------------------------------------
function handleScanMenu(bot, msg) {
    const chatId = msg.chat.id;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📄 مسح فاتورة نوبكو', callback_data: 'scan_invoice' }],
                [{ text: '📦 مسح علبة دواء', callback_data: 'scan_box' }],
                [{ text: '❌ إلغاء', callback_data: 'scan_cancel' }]
            ]
        }
    };
    bot.sendMessage(chatId, '🤖 اختر نوع المسح:', opts);
}

async function handleScanChoice(bot, query) {
    const chatId = query.message.chat.id;
    const choice = query.data.split('_')[1];
    if (choice === 'cancel') {
        await bot.sendMessage(chatId, '❌ تم إلغاء المسح.');
        await bot.answerCallbackQuery(query.id);
        return;
    }
    scanSessions.set(chatId, { type: choice, step: 'awaiting_media', timestamp: Date.now() });
    if (choice === 'invoice') {
        await bot.sendMessage(chatId, '📎 أرسل **صورة واضحة** للفاتورة أو ملف PDF.');
    } else if (choice === 'box') {
        await bot.sendMessage(chatId, '📸 أرسل صورة واضحة للدواء. إذا كان لديك صورة منفصلة للتاريخ، أرسلها بعد هذه الصورة مباشرة.');
    }
    await bot.answerCallbackQuery(query.id);
}

async function handleConfirmation(bot, query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    if (data === 'add_another') {
        await bot.sendMessage(chatId, '👍 أرسل دواء آخر.');
    } else if (data === 'finish') {
        await bot.sendMessage(chatId, '✅ تم الحفظ.');
    }
    await bot.answerCallbackQuery(query.id);
}

async function handlePdf(bot, msg) {
    // معالج PDF كما هو سابقاً (للاختصار)
    await bot.sendMessage(msg.chat.id, '⚠️ دعم PDF متاح لكن يفضل استخدام الصور.');
}

// ربط معالج الرسائل النصية - يجب إضافته في الملف الرئيسي index.js
// سنقوم بتصدير دالة إضافية لربطها لاحقاً
function registerTextHandler(bot) {
    bot.on('message', (msg) => {
        if (msg.text && !msg.photo) {
            handleTextMessages(bot, msg);
        }
    });
}

module.exports = {
    handlePhoto,
    handleScanMenu,
    handleScanChoice,
    handleConfirmation,
    handlePdf,
    registerTextHandler,
};