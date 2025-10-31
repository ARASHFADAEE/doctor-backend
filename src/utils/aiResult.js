function isPersian(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}

function detectUrgent(text, description) {
  const s = `${text || ''}\n${description || ''}`;
  return /(فوری|اورژانسی|اورژانس|urgent)/i.test(s);
}

function extractSection(text, keyFa, keyEn) {
  const regexFa = new RegExp(`${keyFa}\s*[:：]\s*([^\n]+)`, 'i');
  const regexEn = new RegExp(`${keyEn}\s*[:：]\s*([^\n]+)`, 'i');
  const mFa = text.match(regexFa);
  const mEn = text.match(regexEn);
  return (mFa?.[1] || mEn?.[1] || '').trim();
}

function splitList(str) {
  return (str || '')
    .split(/[,،\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeFromFreeText(text, { description, age }) {
  const diagnosisLine = extractSection(text, 'تشخیص', 'Diagnosis');
  const recommendationsLine = extractSection(text, 'توصیه', 'Recommendations');
  const urgent = detectUrgent(text, description);

  const potentialDiagnoses = splitList(diagnosisLine).map(name => ({ name, confidence: null, notes: null }));
  const recommendations = splitList(recommendationsLine);

  const severity = urgent ? 'high' : (recommendations.length ? 'medium' : 'low');

  return {
    schema_version: '1.0',
    language: isPersian(text) ? 'fa-IR' : 'en',
    summary: diagnosisLine || (text || '').split('\n')[0] || null,
    potential_diagnoses: potentialDiagnoses,
    urgent,
    severity,
    recommendations,
    confidence: null,
    reasoning: null,
    extracted_tags: [],
    raw_text: text || '',
    patient_context: {
      age: age ?? null,
      description: description || null,
    },
  };
}

function ensureShape(obj, fallbackContext) {
  const base = normalizeFromFreeText(obj?.raw_text || '', fallbackContext);
  return {
    schema_version: obj?.schema_version || '1.0',
    language: obj?.language || base.language,
    summary: obj?.summary ?? base.summary,
    potential_diagnoses: Array.isArray(obj?.potential_diagnoses) ? obj.potential_diagnoses : base.potential_diagnoses,
    urgent: typeof obj?.urgent === 'boolean' ? obj.urgent : base.urgent,
    severity: obj?.severity || base.severity,
    recommendations: Array.isArray(obj?.recommendations) ? obj.recommendations : base.recommendations,
    confidence: typeof obj?.confidence === 'number' ? obj.confidence : base.confidence,
    reasoning: obj?.reasoning ?? base.reasoning,
    extracted_tags: Array.isArray(obj?.extracted_tags) ? obj.extracted_tags : base.extracted_tags,
    raw_text: obj?.raw_text || base.raw_text,
    patient_context: obj?.patient_context || base.patient_context,
  };
}

function normalizeAIResult(text, { description, age }) {
  // Try JSON first
  try {
    const parsed = JSON.parse(text);
    return ensureShape(parsed, { description, age });
  } catch (_) {}
  // Fallback to free-text parsing
  return normalizeFromFreeText(text, { description, age });
}

module.exports = {
  normalizeAIResult,
};

