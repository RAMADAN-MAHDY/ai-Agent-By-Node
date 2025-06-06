﻿
---

# AI Agent by Node.js 🚀

## 🌍 نظرة عامة

**AI Agent by Node.js** هو تطبيق يعمل باستخدام **Express.js** مع تكامل **Google Gemini API** لإنشاء تمثيلات فيكتورية (Embeddings) وتنفيذ **بحث فيكتوري** على **MongoDB**، مع توليد ردود ذكية باللهجة المصرية.

## ✨ المميزات

✅ توليد **Embeddings** باستخدام **Google Gemini API**  
✅ بحث **Vector Search** في **MongoDB** باستخدام `vector_index`  
✅ دعم **المصادقة** والتفاعل مع قاعدة البيانات  
✅ توليد **ردود ذكية باللهجة المصرية** عبر **Gemini**  
✅ **إعداد سهل** باستخدام متغيرات البيئة `.env`  

## ⚙️ المتطلبات

- **Node.js v18 أو أحدث**  
- **MongoDB** (محلي أو عبر **Atlas**)  
- حساب **Google Gemini API** مع مفتاح API صالح  
- ملف **.env** يحتوي على القيم التالية:
  ```plaintext
  MONGO_URI=your_mongo_uri_here
  GEMINIAI_API_KEY=your_gemini_api_key_here
  ```

## 📂 هيكل المشروع

```
ai_agent_by_node/
│── index.js         # خادم Node.js لإدارة إنشاء واستعلام embeddings باستخدام MongoDB و Gemini AI
│── package.json     # التبعيات وإعدادات التشغيل
│── .env             # متغيرات البيئة
│── README.md        # هذا الملف
```

## 🚀 تشغيل المشروع

لتشغيل التطبيق محليًا، استخدم الأوامر التالية:

```sh
git clone https://github.com/RAMADAN-MAHDY/ai_agent_by_node.git
cd ai_agent_by_node
npm install
npm run dev
```
أو استخدم `yarn dev` حسب مدير الحزم لديك.

## 🔗 نقاط الوصول (API Endpoints)

### 🏗️ إنشاء Embedding:
```http
POST /embed
```
#### الطلب:
```json
{
  "text": "النص المطلوب تحويله إلى embedding"
}
```
#### الاستجابة:
```json
{
  "embedding": [...]
}
```

### 🔎 بحث فيكتوري عن الخدمات:
```http
POST /ask
```
#### الطلب:
```json
{
  "text": "استعلام البحث عن خدمة معينة"
}
```
#### الاستجابة:
```json
{
  "answer": "الرد الذكي"
}
```

---

## 💡 إعداد البحث الفيكتوري في MongoDB

MongoDB توفر **طريقتين** لإنشاء بحث فيكتوري (**Vector Search**) على بيانات الـ embeddings، ويمكنك اختيار الأنسب لك بناءً على البيئة التي تعمل فيها:

1️⃣ **إعداد البحث الفيكتوري عبر الواجهة الرسومية (GUI)**  
✅ **الأفضل للمطورين الذين يفضلون بيئة بصرية** و**إعداد سريع بدون كتابة أكواد كثيرة**.  
✅ يتم التنفيذ عبر **MongoDB Atlas** أو **MongoDB Compass**.  

2️⃣ **إعداد البحث الفيكتوري عبر سطر الأوامر (CLI - Mongo Shell)**  
✅ **الأفضل للمطورين الذين يعملون مع بيئات سيرفرات تلقائية ويريدون مرونة أكثر في التعديلات**.  
✅ يعتمد على تنفيذ الأوامر عبر MongoDB Shell أو أي بيئة تعامل مباشرة مع قاعدة البيانات.

---

### 🖥️ **الطريقة 1: إعداد البحث الفيكتوري عبر الواجهة الرسومية (GUI)**  

**🔹 الخطوات**:  
1️⃣ افتح **MongoDB Atlas** أو **MongoDB Compass**.  
2️⃣ انتقل إلى قاعدة البيانات التي تحتوي على المجموعة (Collection) الخاصة بـ **Embeddings**.  
3️⃣ اضغط على **Indexes** ثم اختر **Create Index**.  
4️⃣ اختر **النوع: Vector**.  
5️⃣ أدخل الإعدادات التالية في قسم **Index JSON**:  

```json
{
  "key": {
    "embedding": "vector"
  },
  "options": {
    "vector": {
      "dimensions": 3072,
      "similarity": "dot_product"
    }
  }
}
```

6️⃣ اضغط **Create Index** وانتظر حتى يتم تطبيق الإعدادات.  

**🔍 تنفيذ البحث الفيكتوري عبر MongoDB Compass**:  
- انتقل إلى تبويب **Find**.  
- أدخل الاستعلام التالي في مربع البحث:  

```json
{
  "$vectorSearch": {
    "query": [0.1, 0.2, ..., 0.9],  
    "path": "embedding",
    "k": 5 
  }
}
```

- اضغط **Run Query** وستظهر **أقرب النتائج** بناءً على البحث الفيكتوري.  

---

### 🛠 **الطريقة 2: إعداد البحث الفيكتوري عبر سطر الأوامر (CLI - Mongo Shell)**  

إذا كنت بحاجة إلى **تنفيذ الإعداد تلقائيًا** داخل الكود أو على بيئة سيرفر، يمكنك إنشاء **Index** عبر **MongoDB Shell** كما يلي:

```js
db.collection.createIndex(
  { embedding: "vector" },
  {
    "vector": {
      "dimensions": 3072,
      "similarity": "cosine" // أو "l2" أو "dot_product" حسب نوع التشابه المطلوب
    }
  }
);
```

🔎 **تنفيذ البحث الفيكتوري عبر MongoDB Shell**:  
```js
db.collection.find({
  $vectorSearch: {
    query: [0.1, 0.2, ..., 0.9],  
    path: "embedding",
    k: 5 
  }
});
```

---

📌 **أي طريقة يجب أن تختار؟**  
- **إذا كنت تفضل إعدادًا سريعًا بدون كتابة أكواد كثيرة، استخدم GUI** (MongoDB Atlas أو Compass).  
- **إذا كنت بحاجة إلى تشغيل الإعداد تلقائيًا داخل التطبيق أو بيئة سيرفر، استخدم CLI**.  
- **Dot Product** مناسب عند التعامل مع بيانات كبيرة وتحتاج إلى قياس التأثير الحقيقي للمتجهات، بينما **Cosine Similarity** أكثر شيوعًا لتحليل التشابه في الاتجاه فقط.  

---


