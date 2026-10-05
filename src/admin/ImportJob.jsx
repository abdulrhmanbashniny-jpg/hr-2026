import React, { useState } from 'react';
import { callFn } from '../lib.jsx';

export default function ImportJob() {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const doImport = async () => {
    setError(''); setResult(null);
    let payload;
    try { payload = JSON.parse(raw); } catch (e) { setError('صيغة JSON غير صحيحة: ' + e.message); return; }
    if (!payload || !payload.job) { setError('الملف يجب أن يحتوي على كائن "job".'); return; }
    setBusy('import');
    try { const r = await callFn('staff', { action: 'import_job', payload }); setResult(r); }
    catch (x) { setError(x.message); }
    setBusy('');
  };

  const refreshPrompt = async () => {
    setError(''); setBusy('prompt');
    try { const r = await callFn('staff', { action: 'build_intake_prompt' }); setPrompt(r.prompt || ''); }
    catch (x) { setError(x.message); }
    setBusy('');
  };

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const okBox = { background: '#e8f6ef', border: '1px solid #1e6f5c', color: '#14503f', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-wrap' };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 10 }}>
        <b>استيراد وظيفة من ملف JSON</b>
        <span className="muted small">الصق مخرجات وكيل الذكاء الاصطناعي (كائن فيه job و questions). يُنشأ القسم تلقائياً إن كان جديداً، وتُملأ القيم الافتراضية لأي خانة ناقصة، وأي خانة غير معروفة تُذكر لك.</span>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} dir="ltr" rows={12} placeholder='{ "job": { ... }, "questions": [ ... ] }' style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-dark" disabled={busy === 'import' || !raw.trim()} onClick={doImport}>{busy === 'import' ? 'جارٍ الاستيراد…' : 'استيراد الوظيفة'}</button>
          <button className="btn" disabled={!!busy} onClick={() => { setRaw(''); setResult(null); setError(''); }}>مسح</button>
        </div>
        {error && <div className="notice red" role="alert">{error}</div>}
        {result && (
          <div style={okBox}>
            {`تم استيراد الوظيفة «${result.title}» بنجاح.\nالقسم: ${result.department}${result.created_department ? ' (أُنشئ حديثاً)' : ''}\nالأسئلة المُدخلة: ${result.questions_inserted}`}
            {result.new_fields && result.new_fields.length ? `\nخانات جديدة غير معروفة (تم تجاهلها): ${result.new_fields.join('، ')}` : ''}
            {result.question_errors && result.question_errors.length ? `\nتنبيهات الأسئلة: ${result.question_errors.join(' | ')}` : ''}
          </div>
        )}
        {result && result.job_id && <a className="btn" href={`#/admin/jobs/${result.job_id}`}>فتح الوظيفة المستوردة ←</a>}
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <b>برومبت إدخال الوظائف (محدّث بالأقسام الحالية)</b>
        <span className="muted small">اضغط «تحديث البرومبت» ثم انسخ النص وأعطه لأي وكيل ذكاء اصطناعي؛ سيحاورك ويُخرج ملف JSON جاهز للصقه في الأعلى.</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-dark" disabled={busy === 'prompt'} onClick={refreshPrompt}>{busy === 'prompt' ? 'جارٍ التحديث…' : 'تحديث البرومبت'}</button>
          {prompt && <button className="btn" onClick={copyPrompt}>{copied ? 'تم النسخ ✓' : 'نسخ'}</button>}
        </div>
        {prompt && <textarea readOnly value={prompt} dir="rtl" rows={16} style={{ width: '100%', fontSize: 13 }} />}
      </div>
    </div>
  );
}
