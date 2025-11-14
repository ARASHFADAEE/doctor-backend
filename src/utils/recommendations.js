const { normalizeAIResult } = require('./aiResult');

function generateRecommendations(aiList, userProfile = {}) {
  const recs = new Set();
  for (const { ai_result, context } of aiList) {
    const ai = normalizeAIResult(ai_result, context || {});
    const tags = (ai.extracted_tags || []).map(t => t.toLowerCase());
    const diags = (ai.potential_diagnoses || []).map(d => (d.name || '').toLowerCase());
    const text = [ai.summary, ai.raw_text].filter(Boolean).join(' ').toLowerCase();

    // Vitamin D deficiency heuristics
    if (tags.includes('ویتامین d') || diags.includes('کمبود ویتامین d') || text.includes('vitamin d')) {
      recs.add('مصرف مکمل ویتامین D 2000 IU روزانه + 15 دقیقه نور آفتاب');
    }
    // High blood sugar heuristics
    if (tags.includes('قند خون') || diags.includes('دیابت') || text.includes('glucose') || text.includes('hba1c')) {
      recs.add('رژیم کم‌کربوهیدرات + پیاده‌روی روزانه 30 دقیقه');
    }
    // High triglycerides heuristics
    if (tags.includes('تری‌گلیسیرید') || text.includes('triglyceride')) {
      recs.add('مصرف ماهی دو بار در هفته + کاهش چربی‌های اشباع');
    }

    // Severity-based general advice
    if (ai.severity === 'high') recs.add('پیگیری فوری با پزشک معالج و انجام آزمایش تکمیلی');
    else if (ai.severity === 'medium') recs.add('اصلاح سبک زندگی و تکرار آزمایش طی 4-6 هفته');

    // Personalization examples
    if (userProfile.age && userProfile.age > 50) {
      recs.add('بررسی دوره‌ای فشار خون و پروفایل چربی‌ها به‌صورت ماهانه');
    }
  }
  return Array.from(recs);
}

module.exports = { generateRecommendations };
