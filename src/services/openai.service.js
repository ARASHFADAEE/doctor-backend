const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Prefer Liara (Gemini) if configured; otherwise fallback to OpenAI
const liaraBaseURL = process.env.LIARA_BASE_URL;
const liaraApiKey = process.env.LIARA_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

let client = null;
let defaultModel = null;
if (liaraBaseURL && liaraApiKey) {
  client = new OpenAI({ baseURL: liaraBaseURL, apiKey: liaraApiKey });
  defaultModel = 'google/gemini-2.5-flash';
} else if (openaiApiKey) {
  client = new OpenAI({ apiKey: openaiApiKey });
  defaultModel = 'gpt-4o-mini';
}

const aiModel = process.env.AI_MODEL || defaultModel || null;
const { normalizeAIResult } = require('../utils/aiResult');

function fileToDataURI(filePath) {
  try {
    const abs = path.resolve(filePath);
    const data = fs.readFileSync(abs);
    const base64 = data.toString('base64');
    const ext = path.extname(abs).replace('.', '') || 'jpeg';
    return `data:image/${ext};base64,${base64}`;
  } catch (e) {
    return null;
  }
}

async function analyzeImage({ imagePath, description, age }) {
  const prompt = `شما یک دستیار هوش مصنوعی پزشکی هستید. تصویر آپلود شده مربوط به بررسی پزشکی است.
  اطلاعات بیمار: سن ${age ?? 'نامشخص'}.
  شرح بیمار: ${description || 'ندارد'}.
  لطفاً فقط یک شیء JSON معتبر مطابق اسکیمای زیر برگردانید و هیچ متن اضافی ننویسید:
  {
    "schema_version": "1.0",
    "language": "fa-IR",
    "summary": "خلاصه کوتاه",
    "potential_diagnoses": [ { "name": "...", "confidence": 0.0, "notes": "..." } ],
    "urgent": true,
    "severity": "low|medium|high",
    "recommendations": ["...", "..."],
    "confidence": 0.0,
    "reasoning": "...",
    "extracted_tags": ["..."],
    "raw_text": "",
    "patient_context": { "age": ${age ?? 'null'}, "description": "${(description || '').replace(/"/g, '\\"')}" }
  }`;

  if (!client || !aiModel) {
    // Fallback mock
    const mock = `تشخیص: احتمال گلوکوم.
توصیه: مراجعه به چشم پزشک.
فوری: ${/تار|درد|خون|vision|blur/i.test(description || '') ? 'بله' : 'خیر'}`;
    return normalizeAIResult(mock, { description, age });
  }

  const imageDataURI = fileToDataURI(imagePath);
  try {
    // Use Chat Completions for Liara/OpenAI compatibility
    const completion = await client.chat.completions.create({
      model: aiModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            imageDataURI
              ? { type: 'image_url', image_url: { url: imageDataURI } }
              : { type: 'text', text: '(بدون تصویر قابل خواندن)' },
          ],
        },
      ],
      temperature: 0.3,
    });

    const text = completion?.choices?.[0]?.message?.content || '';
    const structured = normalizeAIResult(text || 'نتیجه‌ای از هوش مصنوعی دریافت نشد', { description, age });
    return structured;
  } catch (e) {
    console.error('AI error:', e.message);
    return normalizeAIResult('خطا در تحلیل هوش مصنوعی', { description, age });
  }
}

module.exports = {
  analyzeImage,
};
