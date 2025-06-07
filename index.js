import express from 'express';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import clientPromise from './db.js'

dotenv.config();
//https://village-services-dxve.vercel.app

const app = express();
const PORT = process.env.PORT || 3001;

const GEMINI_API_KEY = process.env.GEMINIAI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ✅ تفعيل cors بإعدادات مناسبة
app.use(cors({
    origin: 'https://village-services-dxve.vercel.app', // عدّلها على حسب عنوان موقعك
    credentials: true,
}));

app.use(express.json());

const handleEmbeddindgVectorCreation = async (text) => {
    try {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-exp-03-07',
            contents: text,
        });

        return response.embeddings[0].values;
    } catch (error) {
        console.error('Embedding error:', error);
        throw new Error('Failed to generate embedding.');
    }
}

// فانكشن تحليل نية المستخدم
function analyzeUserIntent(userText) {
    const text = userText.toLowerCase();
    
    // كلمات تدل على البحث عن مقدم خدمة
    const seekingProviderKeywords = [
        'بدور على', 'عايز', 'محتاج', 'في', 'فين', 'عندكم', 'متوفر',
        'ابحث عن', 'أريد', 'أحتاج', 'هل يوجد'
    ];
    
    // كلمات تدل على البحث عن طالب خدمة  
    const seekingRequesterKeywords = [
        'حد محتاج', 'حد طالب', 'حد عايز', 'مين محتاج', 'في حد',
        'أحد يحتاج', 'شخص محتاج', 'يوجد أحد'
    ];
    
    const isSeekingProvider = seekingProviderKeywords.some(keyword => text.includes(keyword));
    const isSeekingRequester = seekingRequesterKeywords.some(keyword => text.includes(keyword));
    
    if (isSeekingProvider) return 'providing';
    if (isSeekingRequester) return 'request';
    
    return null; // غير واضح
}

// ✅ إنشاء نقطة نهاية لاستعلام فيكتور سيرش على MongoDB
app.post('/ask', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        // 1. توليد embedding من النص
        const queryVector = await handleEmbeddindgVectorCreation(text);
        const client = await clientPromise;
        const db = client.db('village');
        const collection_providing = db.collection('providingservices');
        const collection_request = db.collection('helprequests');
        const MIN_SCORE_THRESHOLD = 0.75;

        const [results, results_request] = await Promise.all([
            collection_providing.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 5
                    }
                },
                {
                    $project: {
                        type: 1,
                        createdAt: 1,
                        description: 1,
                        category: 1,
                        phone: 1,
                        whatsapp: 1,
                        email: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ]).toArray(),
            collection_request.aggregate([
                {
                    $vectorSearch: {
                        index: "request_index",
                        path: "embedding",
                        queryVector: queryVector,
                        numCandidates: 100,
                        limit: 5
                    }
                },
                {
                    $project: {
                        type: 1,
                        createdAt: 1,
                        description: 1,
                        category: 1,
                        phone: 1,
                        whatsapp: 1,
                        email: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ]).toArray()
        ]);

        if (results.length === 0 && results_request.length === 0) {
            return res.json({
                answer: `لم أجد أي خدمات او طلب شبيهة بال ${text}.`
            });
        }

        const allResults = [...results, ...results_request];
        // ✅ إعادة الترتيب بحسب المعدل
        const sortedResults = allResults.sort((a, b) => b.score - a.score);

        // ✅ تحليل نية المستخدم وفلترة البيانات
        const userIntent = analyzeUserIntent(text);
        let filteredResults = sortedResults;

        if (userIntent) {
            filteredResults = sortedResults.filter(item => {
                if (userIntent === 'providing') {
                    return item.type === 'providing';
                } else if (userIntent === 'request') {
                    return item.type === 'request';
                }
                return true;
            });

            if (filteredResults.length === 0) {
                const serviceType = userIntent === 'providing' ? 'مقدمي خدمة' : 'طالبي خدمة';
                return res.json({
                    answer: `معلش، مفيش ${serviceType} متاحين للخدمة دي دلوقتي. جرب تسأل عن خدمة تانية ❤️`
                });
            }
        }

        // ✅ اختيار الأكثر قريبة
        const closestResult = filteredResults[0];

        if (closestResult.score < MIN_SCORE_THRESHOLD) {
            return res.json({
                answer: `لم أجد أي خدمات او طلب شبيهة بال ${text}.`
            });
        }

        // 2. تجهيز البيانات بشكل منظم
        const formattedData = filteredResults.map((item, i) => {
            const createdAt = new Date(item.createdAt || Date.now());
            const date = `${createdAt.getDate()}/${createdAt.getMonth() + 1}/${createdAt.getFullYear()}`;

            const contacts = [];
            if (item.phone) contacts.push(`📞 موبايل: ${item.phone}`);
            if (item.whatsapp) contacts.push(`📱 واتساب: ${item.whatsapp}`);
            if (item.email) contacts.push(`📧 بريد إلكتروني: ${item.email}`);

            return `🔹 خدمة ${i + 1}:
- الفئة: ${item.category || "غير محددة"}
- نوع الطلب: ${item.type == "request" ? "ده واحد طالب خدمه" : "ده واحد مقدم خدمه"}
- التفاصيل: ${item.description || "مفيش وصف"}
- تاريخ الإضافة: ${date}
- وسائل التواصل: ${contacts.length > 0 ? contacts.join(" | ") : "مفيش"}`
        }).join('\n\n');

        // 3. طلب رد من Gemini بصيغة عامية محسنة
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{
                role: "user",
                parts: [{
                    text: `
أنت مساعد ذكي لخدمات القرية. مهمتك تحليل طلب المستخدم وعرض البيانات المناسبة فقط.

📋 البيانات المتاحة:
${formattedData}

🎯 سؤال المستخدم: "${text}"

🔍 تعليمات التحليل والرد:

1️⃣ **تحليل نوع الطلب:**
   - إذا كان السؤال يبحث عن مقدم خدمة (مثل: "بدور على كهربائي" أو "عايز نجار" أو "في سباك؟") 
     → اعرض فقط البيانات التي نوعها "ده واحد مقدم خدمه"
   
   - إذا كان السؤال يبحث عن طالب خدمة (مثل: "حد محتاج كهربائي؟" أو "في حد طالب نجار؟")
     → اعرض فقط البيانات التي نوعها "ده واحد طالب خدمه"

2️⃣ **فلترة حسب نوع الخدمة:**
   - اعرض فقط البيانات المتعلقة بنوع الخدمة المطلوبة
   - لو السؤال عن "كهربائي" → اعرض بس خدمات الكهرباء
   - لو السؤال عن "نجار" → اعرض بس خدمات النجارة
   - وهكذا...

3️⃣ **أسلوب الرد:**
   - استخدم العامية المصرية بطريقة ودودة ومحترمة
   - ابدأ برد مناسب حسب نوع الطلب:
     * للبحث عن مقدم خدمة: "لقيتلك [عدد] مقدم خدمة متاح..."
     * للبحث عن طالب خدمة: "في [عدد] شخص طالب الخدمة دي..."
   
   - اعرض كل خدمة بالشكل ده:
   🔹 **[رقم الخدمة]**
   📂 **الفئة:** [الفئة]
   📝 **التفاصيل:** [الوصف]
   📅 **التاريخ:** [التاريخ]
   📞 **التواصل:** [وسائل التواصل]

4️⃣ **حالات خاصة:**
   - لو مفيش بيانات مناسبة للطلب، قول: "معلش، مفيش [نوع الخدمة] متاح دلوقتي. ممكن تجرب تدور على خدمة تانية أو تسأل بعدين ❤️"
   - لو مفيش تطابق في نوع الخدمة، قول: "الخدمة دي مش متوفرة حالياً، بس ممكن تشوف الخدمات التانية المتاحة"

⚠️ **مهم جداً:**
- متعرضش بيانات غلط (لا تخلط بين مقدمي ومطالبي الخدمة)
- متشرحش العملية، رد بالنتيجة مباشرة
- لو مش متأكد من نوع الطلب، اسأل المستخدم يوضح أكتر
- استخدم نفس التنسيق الموجود في البيانات

رد دلوقتي بناءً على التحليل ده:
                    `
                }]
            }]
        });

        res.json({ answer: response.text });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        // await client.close();
    }
});

app.get('/', async (req, res) => {
    res.json({ message: 'hi' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 