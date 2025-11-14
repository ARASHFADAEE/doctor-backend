const { pool } = require('../db');
const { listByPatient, getById, updateTest } = require('../models/MedicalTest');
const { extractMetric, aggregateMonthly, computeTrendLine, detectAnomalies } = require('../utils/metrics');
const { normalizeAIResult } = require('../utils/aiResult');
const { generateRecommendations } = require('../utils/recommendations');
const { inferTagsFromText, mergeTags } = require('../utils/tagging');

const ALLOWED_METRICS = ['blood_sugar', 'vitamin_d', 'triglycerides'];

async function getTrend(req, res, next) {
  try {
    const patientId = req.user.id;
    const metric = req.params.metric;
    const months = Math.min(12, Math.max(1, Number(req.query.months || 6)));
    if (!ALLOWED_METRICS.includes(metric)) return res.status(400).json({ success: false, message: 'متریک نامعتبر' });
    const [rows] = await pool.query(
      `SELECT id, description, ai_result, created_at FROM medical_tests
       WHERE patient_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       ORDER BY created_at ASC`,
      [patientId, months]
    );
    const points = [];
    for (const r of rows) {
      try {
        const val = extractMetric(r.ai_result, { description: r.description }, metric);
        if (val != null && !Number.isNaN(val)) points.push({ date: r.created_at, value: val });
      } catch (_) {}
    }
    const monthly = aggregateMonthly(points);
    const series = monthly.map((m, i) => ({ x: i, y: m.avg }));
    const { slope, yhat } = computeTrendLine(series);
    const anomalies = detectAnomalies(monthly, 0.2);
    const labels = monthly.map(m => m.month);
    const data = monthly.map(m => Math.round(m.avg * 100) / 100);
    const trendLine = yhat.map(v => Math.round(v * 100) / 100);

    // Comparison message example (first half vs second half)
    let comparison = null;
    if (data.length >= 2) {
      const mid = Math.floor(data.length / 2);
      const a = avg(data.slice(0, mid));
      const b = avg(data.slice(mid));
      const change = a ? ((b - a) / a) : 0;
      if (Math.abs(change) >= 0.2) {
        const pct = Math.round(Math.abs(change) * 100);
        const dir = change > 0 ? 'افزایش' : 'کاهش';
        const metricFa = metricLabelFa(metric);
        comparison = `${metricFa} شما ${pct}% ${dir} داشته است`;
      }
    }

    res.json({
      metric,
      months,
      chartjs: { labels, datasets: [{ label: metricLabelFa(metric), data }] },
      trend_line: trendLine,
      slope,
      anomalies,
      comparison,
    });
  } catch (e) { next(e); }
}

async function getRecommendations(req, res, next) {
  try {
    const patientId = req.user.id;
    const [rows] = await pool.query(
      `SELECT id, description, ai_result FROM medical_tests
       WHERE patient_id = ? ORDER BY created_at DESC LIMIT 20`,
      [patientId]
    );
    const items = rows.map(r => ({ ai_result: r.ai_result, context: { description: r.description } }));
    const recs = generateRecommendations(items, { age: req.user.age });
    res.json({ recommendations: recs });
  } catch (e) { next(e); }
}

async function autoTagTest(req, res, next) {
  try {
    const id = Number(req.params.id);
    const test = await getById(id);
    if (!test) return res.status(404).json({ success: false, message: 'تست یافت نشد' });
    // Access control: allow owner or admin/doctor
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.id !== test.patient_id) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز' });
    }
    const ai = normalizeAIResult(test.ai_result, { description: test.description });
    const inferred = inferTagsFromText(test.description || '', [ai.summary, ai.raw_text].filter(Boolean).join(' '));
    const merged = mergeTags(ai.extracted_tags || [], inferred);
    ai.extracted_tags = merged;
    const updated = await updateTest(id, { ai_result: JSON.stringify(ai) });
    res.json({ id: updated.id, extracted_tags: merged });
  } catch (e) { next(e); }
}

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
function metricLabelFa(m) {
  return m === 'blood_sugar' ? 'قند خون'
       : m === 'vitamin_d' ? 'ویتامین D'
       : m === 'triglycerides' ? 'تری‌گلیسیرید'
       : m;
}

module.exports = { getTrend, getRecommendations, autoTagTest };
