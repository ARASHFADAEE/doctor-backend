const { normalizeAIResult } = require('./aiResult');

// Extract numeric metric values from AI result or description using regex heuristics
function extractMetric(aiResultStr, context, metric) {
  const ai = normalizeAIResult(aiResultStr, context || {});
  const text = [ai.raw_text, ai.summary, context?.description].filter(Boolean).join(' ');
  const lower = text.toLowerCase();
  const fa = text;

  const num = (pattern) => {
    const m = pattern.exec(text);
    return m ? Number((m[1] || m[0]).replace(/[^0-9.]/g, '')) : null;
  };

  switch (metric) {
    case 'blood_sugar': {
      // mg/dL or glucose/HbA1c patterns (fallback: HbA1c% * 28.7 - 46.7 approx eAG)
      let val = num(/(?:قند|گلوکز|glucose)[^0-9]{0,12}([0-9]{2,3})\s*(?:mg\/dL|میلی\s*گرم\s*در\s*دسی\s*لیتر)?/i);
      if (!val) {
        const hba1c = num(/(?:HbA1c|هموگلوبین\s*A1c)[^0-9]{0,8}([0-9](?:\.[0-9])?)/i);
        if (hba1c) val = Math.round((28.7 * hba1c - 46.7)); // ADA eAG approximation
      }
      return val;
    }
    case 'vitamin_d': {
      // ng/mL patterns
      const val = num(/(?:ویتامین\s*D|Vitamin\s*D)[^0-9]{0,12}([0-9]{1,3})\s*(?:ng\/mL|نان\s*گرم\/میلی\s*لیتر)?/i);
      return val;
    }
    case 'triglycerides': {
      const val = num(/(?:تری(?:‌|\s*)گلیسیرید|Triglycerides)[^0-9]{0,12}([0-9]{2,4})\s*(?:mg\/dL)?/i);
      return val;
    }
    default:
      return null;
  }
}

function aggregateMonthly(dataPoints) {
  // dataPoints: [{ date: Date|string, value: number }]
  const buckets = new Map();
  for (const p of dataPoints) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const arr = buckets.get(key) || [];
    arr.push(p.value);
    buckets.set(key, arr);
  }
  const result = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, arr]) => ({ month, avg: arr.reduce((s, v) => s + v, 0) / arr.length }));
  return result;
}

function computeTrendLine(series) {
  // series: [{ x: 0..n-1, y: number }], return slope and yhat array
  const n = series.length;
  if (n === 0) return { slope: 0, yhat: [] };
  const sumX = series.reduce((s, p) => s + p.x, 0);
  const sumY = series.reduce((s, p) => s + p.y, 0);
  const sumXY = series.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = series.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  const yhat = series.map(p => intercept + slope * p.x);
  return { slope, yhat };
}

function detectAnomalies(series, threshold = 0.2) {
  // series: [{ month, avg }]; mark indices where change > threshold vs previous
  const anomalies = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].avg;
    const cur = series[i].avg;
    if (prev && Math.abs(cur - prev) / prev >= threshold) anomalies.push(i);
  }
  return anomalies;
}

module.exports = {
  extractMetric,
  aggregateMonthly,
  computeTrendLine,
  detectAnomalies,
};
