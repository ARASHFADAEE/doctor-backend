function inferTagsFromText(description = '', text = '') {
  const str = `${description} ${text}`.toLowerCase();
  const tags = new Set();
  const addIf = (kw, tag) => { if (str.includes(kw)) tags.add(tag); };
  addIf('تیروئید', 'تیروئید');
  addIf('thyroid', 'تیروئید');
  addIf('قند', 'قند خون');
  addIf('glucose', 'قند خون');
  addIf('hba1c', 'قند خون');
  addIf('ویتامین d', 'ویتامین D');
  addIf('vitamin d', 'ویتامین D');
  addIf('triglyceride', 'تری‌گلیسیرید');
  addIf('تری‌گلیسیرید', 'تری‌گلیسیرید');
  addIf('هموگلوبین', 'HbA1c');
  addIf('hormone', 'هورمون');
  return Array.from(tags);
}

function mergeTags(existing = [], inferred = []) {
  const s = new Set([...(existing || []), ...(inferred || [])]);
  return Array.from(s);
}

module.exports = { inferTagsFromText, mergeTags };
