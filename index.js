import express from 'express';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


const MONGO_URI = process.env.MONGO_URI;

const client = new MongoClient(MONGO_URI)

const GEMINI_API_KEY = process.env.GEMINIAI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ✅ تفعيل cors بإعدادات مناسبة
app.use(cors({
    origin: 'http://localhost:3001', // عدّلها على حسب عنوان موقعك
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

// ✅ إنشاء نقطة نهاية لتوليد embedding

app.post('/embed', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required in request body.' });
        }

        // 1. توليد embedding من النص
        const embedding = await handleEmbeddindgVectorCreation(text);
        res.json({ embedding });


    } catch (error) {
        console.error('Embedding error:', error);
        res.status(500).json({ error: 'Failed to generate embedding.' });
    }
});


// ✅ إنشاء نقطة نهاية لاستعلام فيكتور سيرش على MongoDB

app.post('/ask', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }
        // 1. توليد embedding من النص
        const queryVector = await handleEmbeddindgVectorCreation(text);

        await client.connect();
        const db = client.db('village');
        const collection = db.collection('providingservices');
        const MIN_SCORE_THRESHOLD = 0.75;

        // 1. استعلام فيكتور سيرش على MongoDB
        const results = await collection.aggregate([
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
                    description: 1,
                    category: 1,
                    phone: 1,
                    whatsapp: 1,
                    email: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]).toArray();

        if (results.length === 0) {
            return res.json({
                answer: `لم أجد أي خدمات شبيهة بخدمة ${text}.`
            });
        }
        // ✅ التحقق من وجود نتائج قريبة كفاية
        const hasRelevantResults = results.some(r => r.score >= MIN_SCORE_THRESHOLD);

        if (!hasRelevantResults) {
            return res.json({
                answer: `مافيش خدمات شبيهة بخدمة "${text}" بشكل كافي حاليًا. جرب توصفها بطريقة مختلفة ❤️`
            });
        }


        // 2. تجهيز البيانات بشكل منظم
        const formattedData = results.map((item, i) => {
            const createdAt = new Date(item.createdAt || Date.now());
            const date = `${createdAt.getDate()}/${createdAt.getMonth() + 1}/${createdAt.getFullYear()}`;

            const contacts = [];
            if (item.phone) contacts.push(`📞 موبايل: ${item.phone}`);
            if (item.whatsapp) contacts.push(`📱 واتساب: ${item.whatsapp}`);
            if (item.email) contacts.push(`📧 بريد إلكتروني: ${item.email}`);


            return `🔹 خدمة ${i + 1}:
- الفئة: ${item.category || "غير محددة"}
- التفاصيل: ${item.description || "مفيش وصف"}
- تاريخ الإضافة: ${date}
- وسائل التواصل: ${contacts.length > 0 ? contacts.join(" | ") : "مفيش"}`
        }).join('\n\n');

        // 3. طلب رد من Gemini بصيغة عامية
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{
                role: "user",
                parts: [{
                    text: `
إنت دلوقتي عندك شوية خدمات بالمعلومات دي:
لاز ترفق كل وسائل التواصل المتوفرة لكل خدمة، لو مفيش وسيلة تواصل متوفرة، اكتب "مفيش". وكمان رد باسلوب راقي ومحترم وكمان لو تقدر تبسطله التاريق لو في نفس الاسبوع عرفه موافق يوم كام في الاسبوع
${formattedData}

من فضلك جاوب على السؤال التالي: "${text}"
بطريقة عامية مصرية، ورد بس بالمعلومات اللي فوق من غير ما تزود حاجة من عندك، وخلّي الرد بسيط وطبيعي كأنك بتشرح لحد بيستفسر عن الخدمه .
ولو فهمت من كلامي اني وصلت للي انا محتاجه انهي النقاش بطريقة مهذبة وبدون تكرار الكلام. "اكتب الرد بأسلوب جذاب مع إيموجي مناسب لكل نقطة."

"رتب الرد بشكل منسق وواضح.
متحطش الرمز * في بداية كل سطر.
استخدم الرمز ده في بدايه كل نقطه 🔹 
وخلي العنوان مميز بخط عريض.
استخدم الرموز التعبيرية المناسبة لكل نقطة.
                    `

                }]
            }]
        });

        res.json({ answer: response.text });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        await client.close();
    }
});


app.get('/',  async ()=>{
    try{

        res.json({ answer: "hello" });

    } catch (error) {
        console.error('Error:', error);
      
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
