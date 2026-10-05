import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { callFn, fmtDate, Icon, KEYS_AR, QTYPES, sb, Spinner, Toggle, useToast } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

const JSTATUS = { draft: ['مسودة', 'p-gray'], published: ['منشورة', 'p-green'], closed: ['مغلقة', 'p-red'] };
const COLORS = ['#C8553D', '#E0A21B', '#2F5D50', '#3B5B8C', '#8A6E4B', '#D9B3C2', '#17191C', '#6B8F71'];

export function JobsList() {
  const { canAccess, canManage, visibleDepts, isAdmin, me } = useAdmin();
  const nav = useNavigate();
  const toast = useToast();
  const [jobs, setJobs] = useState(null);
  const [counts, setCounts] = useState({});
  useEffect(() => {
    sb.from('jobs').select('*,departments(name,color)').order('created_at').then(({ data }) => setJobs((data || []).filter((j) => canAccess(j.department_id))));
    sb.from('applications').select('job_id,status').then(({ data }) => { const c = {}; (data || []).forEach((a) => { c[a.job_id] = c[a.job_id] || { t: 0, p: 0 }; c[a.job_id].t++; if (a.status !== 'applied' && a.status !== 'failed') c[a.job_id].p++; }); setCounts(c); });
  }, []);
  const manageable = visibleDepts.filter((d) => canManage(d.id));
  const create = async () => {
    const dep = manageable[0];
    if (!dep) return;
    const { data, error } = await sb.from('jobs').insert({ title: 'وظيفة جديدة', department_id: dep.id, status: 'draft', code: `JOB-${Math.floor(Math.random() * 900 + 100)}` }).select('id').single();
    if (error) return toast(error.message, 'err');
    await sb.from('schedule_settings').insert({ job_id: data.id });
    nav(`/admin/jobs/${data.id}`);
  };
  if (!jobs) return <Spinner />;
  return (
    <>
      <div className="page-head"><div><h1>الوظائف والاختبارات</h1><p>كل وظيفة لها وصفها وشروطها وأسئلتها العشرة وبرومنت الذكاء الاصطناعي الخاص بها</p></div>
        {manageable.length > 0 && <button className="btn btn-dark" onClick={create}><Icon name="plus" />وظيفة جديدة</button>}</div>
      <div className="card flat"><div className="table-wrap"><table className="table"><thead><tr><th>الوظيفة</th><th>القسم</th><th>الحالة</th><th>المتقدمون</th><th>اجتازوا</th><th>آخر موعد</th><th></th></tr></thead><tbody>
        {jobs.map((j) => <tr key={j.id} className="click" onClick={() => nav(`/admin/jobs/${j.id}`)}>
          <td><div className="row"><span className="sw" style={{ background: j.color, width: 14, height: 14 }} /><div className="stack" style={{ gap: 0 }}><b>{j.title}</b><span className="xs muted mono">{j.code}</span></div></div></td>
          <td className="small">{j.departments?.name}</td>
          <td><span className={`pill ${JSTATUS[j.status][1]}`}>{JSTATUS[j.status][0]}</span></td>
          <td className="mono">{counts[j.id]?.t || 0}</td><td className="mono">{counts[j.id]?.p || 0}</td>
          <td className="small">{fmtDate(j.deadline)}</td>
          <td onClick={(e) => e.stopPropagation()}><div className="row" style={{ gap: 6 }}>{canManage(j.department_id) ? <Link to={`/admin/jobs/${j.id}`} className="btn btn-ghost btn-sm"><Icon name="edit" size={15} />تعديل</Link> : <Link to={`/admin/jobs/${j.id}`} className="btn btn-ghost btn-sm"><Icon name="eye" size={15} />عرض</Link>}{j.status === 'published' && <a href={`#/jobs/${j.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">صفحة الوظيفة</a>}</div></td>
        </tr>)}
        {!jobs.length && <tr><td colSpan={7} className="empty">لا توجد وظائف ضمن أقسامك</td></tr>}
      </tbody></table></div></div>
      {me.role === 'evaluator' && <div className="notice blue">صلاحيتك «عضو لجنة»: تستطيع الاطلاع على الوظائف دون تعديلها.</div>}
    </>
  );
}

const lines = (a) => (a || []).join('\n');
const toLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const blankQ = (type = 'mcq') => ({ _new: true, id: `new-${Math.random()}`, type, text: '', options: type === 'mcq' ? ['', '', '', ''] : [], unit: '', points: 10, key: { correct_option: 0, correct_number: null, tolerance_pct: 2, model_answer: '', rubric: type === 'text' ? [{ point: '', weight: 5 }, { point: '', weight: 5 }] : [] } });

export function JobEditor() {
  const { id } = useParams();
  const { canManage, visibleDepts, isAdmin } = useAdmin();
  const toast = useToast();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [qs, setQs] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [tab, setTab] = useState('info');
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(false);
  const load = async () => {
    const { data } = await sb.from('jobs').select('*').eq('id', id).single();
    const { data: q } = await sb.from('questions').select('*, question_keys(*)').eq('job_id', id).order('position');
    setJob(data ? { ...data, _tasks: lines(data.tasks), _reqs: (data.requirements || []).map((r) => `${r.k}: ${r.v}`).join('\n'), _must: lines(data.must_have), _nice: lines(data.nice_to_have), _ben: lines(data.benefits) } : false);
    setQs((q || []).map((x) => ({ ...x, key: (Array.isArray(x.question_keys) ? x.question_keys[0] : x.question_keys) || {} })));
    setRemoved([]);
  };
  useEffect(() => { load(); }, [id]);
  if (job === null) return <Spinner />;
  if (job === false) return <div className="card empty">الوظيفة غير موجودة أو لا تملك صلاحية الاطلاع عليها</div>;
  const ro = !canManage(job.department_id);
  const set = (k, v) => setJob((j) => ({ ...j, [k]: v }));
  const setQ = (k, patch) => setQs((l) => l.map((q, i) => (i === k ? { ...q, ...patch } : q)));
  const setK = (k, patch) => setQs((l) => l.map((q, i) => (i === k ? { ...q, key: { ...q.key, ...patch } } : q)));
  const rw = job.rank_weights || {};

  const saveJob = async () => {
    setBusy(true);
    const reqs = toLines(job._reqs).map((l) => { const i = l.indexOf(':'); return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : { k: 'متطلب', v: l }; });
    const patch = {
      title: job.title, code: job.code, department_id: job.department_id, city: job.city, employment_type: job.employment_type, experience: job.experience, salary_text: job.salary_text,
      description: job.description, tasks: toLines(job._tasks), requirements: reqs, must_have: toLines(job._must), nice_to_have: toLines(job._nice), benefits: toLines(job._ben),
      deadline: job.deadline || null, vacancies: Number(job.vacancies || 1), status: job.status, pass_threshold: Number(job.pass_threshold), duration_minutes: Number(job.duration_minutes),
      ai_prompt: job.ai_prompt, color: job.color, rank_weights: job.rank_weights, eval_criteria: job.eval_criteria,
    };
    const { error } = await sb.from('jobs').update(patch).eq('id', id);
    setBusy(false);
    if (error) return toast(error.message.includes('duplicate') ? 'رمز الوظيفة مستخدم مسبقاً' : error.message, 'err');
    toast('تم حفظ بيانات الوظيفة', 'ok');
  };
  const saveQuestions = async () => {
    for (const [k, q] of qs.entries()) {
      if (!q.text.trim()) return toast(`اكتب نص السؤال ${k + 1}`, 'err');
      if (q.type === 'mcq' && q.options.filter((o) => o.trim()).length < 2) return toast(`أضف خيارين على الأقل للسؤال ${k + 1}`, 'err');
      if (q.type === 'number' && (q.key.correct_number === null || q.key.correct_number === '' || isNaN(Number(q.key.correct_number)))) return toast(`حدد الإجابة الصحيحة للسؤال ${k + 1}`, 'err');
    }
    setBusy(true);
    try {
      for (const rid of removed) await sb.from('questions').delete().eq('id', rid);
      for (const [k, q] of qs.entries()) {
        const row = { job_id: id, position: k + 1, type: q.type, text: q.text.trim(), options: q.type === 'mcq' ? q.options.map((o) => o.trim()).filter(Boolean) : [], unit: q.unit || null, points: Number(q.points || 10) };
        let qid = q.id;
        if (q._new) { const { data, error } = await sb.from('questions').insert(row).select('id').single(); if (error) throw error; qid = data.id; }
        else { const { error } = await sb.from('questions').update(row).eq('id', qid); if (error) throw error; }
        const key = { question_id: qid, correct_option: q.type === 'mcq' ? Number(q.key.correct_option || 0) : null, correct_number: q.type === 'number' ? Number(q.key.correct_number) : null, tolerance_pct: Number(q.key.tolerance_pct ?? 2), model_answer: q.key.model_answer || null, rubric: q.type === 'text' ? (q.key.rubric || []).filter((r) => r.point?.trim()).map((r) => ({ point: r.point.trim(), weight: Number(r.weight || 1) })) : [] };
        const { error: e2 } = await sb.from('question_keys').upsert(key, { onConflict: 'question_id' }); if (e2) throw e2;
      }
      toast('تم حفظ الأسئلة', 'ok'); await load();
    } catch (x) { toast(x.message, 'err'); }
    setBusy(false);
  };
  const generate = async () => {
    setGen(true);
    try {
      const r = await callFn('staff', { action: 'generate_questions', job_id: id });
      const mapped = (r.questions || []).slice(0, 10).map((g) => ({ ...blankQ(g.type), type: ['mcq', 'text', 'number', 'upload'].includes(g.type) ? g.type : 'text', text: g.text || '', options: g.type === 'mcq' ? (g.options || []).slice(0, 4) : [], unit: g.unit || '', key: { correct_option: Number(g.correct_option || 0), correct_number: g.correct_number ?? null, tolerance_pct: 2, model_answer: g.model_answer || '', rubric: g.rubric || [] } }));
      if (!mapped.length) throw new Error('لم يُرجع النموذج أسئلة');
      setRemoved((r0) => [...r0, ...qs.filter((q) => !q._new).map((q) => q.id)]);
      setQs(mapped); toast('تم توليد الأسئلة — راجعها ثم اضغط حفظ', 'ok');
    } catch (x) { toast(x.message, 'err'); }
    setGen(false);
  };
  const move = (k, dir) => setQs((l) => { const n = [...l]; const t = n[k + dir]; if (!t) return l; n[k + dir] = n[k]; n[k] = t; return n; });
  const del = async () => {
    if (!confirm('حذف الوظيفة نهائياً مع كل طلباتها؟')) return;
    const { error } = await sb.from('jobs').delete().eq('id', id);
    if (error) return toast(error.message, 'err');
    nav('/admin/jobs');
  };
  const F = ({ label, k, type = 'text', ltr, ...p }) => <label className="field"><span className="label">{label}</span><input className={`input ${ltr ? 'ltr' : ''}`} type={type} value={job[k] ?? ''} disabled={ro} onChange={(e) => set(k, e.target.value)} {...p} /></label>;
  const T = ({ label, k, rows = 4, hint }) => <label className="field"><span className="label">{label}</span><textarea className="textarea" rows={rows} value={job[k] ?? ''} disabled={ro} onChange={(e) => set(k, e.target.value)} />{hint && <span className="hint">{hint}</span>}</label>;

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ gap: 14 }}><span style={{ width: 46, height: 46, borderRadius: 14, background: job.color }} /><div><h1>{job.title}</h1><p><span className="mono">{job.code}</span> · <span className={`pill ${JSTATUS[job.status][1]}`}>{JSTATUS[job.status][0]}</span> {ro && <span className="pill p-blue">عرض فقط</span>}</p></div></div>
        <div className="row wrap"><Link to="/admin/jobs" className="btn btn-ghost">كل الوظائف</Link>{job.status === 'published' && <a className="btn btn-ghost" href={`#/jobs/${id}`} target="_blank" rel="noreferrer"><Icon name="eye" />معاينة كمتقدّم</a>}
          {!ro && (tab === 'questions' ? <button className="btn btn-dark" disabled={busy} onClick={saveQuestions}>{busy ? <span className="spinner" /> : 'حفظ الأسئلة'}</button> : <button className="btn btn-dark" disabled={busy} onClick={saveJob}>{busy ? <span className="spinner" /> : 'حفظ التغييرات'}</button>)}</div>
      </div>
      <div className="tabs">{[['info', 'بيانات الوظيفة'], ['questions', `الأسئلة (${qs.length})`], ['ai', 'برومنت الذكاء الاصطناعي'], ['rank', 'التقييم والأوزان']].map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'info' && <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gridColumn: 'span 2', gap: 16 }}>
          <div className="grid2">{F({ label: 'المسمى الوظيفي', k: 'title' })}{F({ label: 'رمز الوظيفة', k: 'code', ltr: true })}</div>
          <div className="grid2">
            <label className="field"><span className="label">القسم</span><select className="select" value={job.department_id} disabled={ro} onChange={(e) => set('department_id', e.target.value)}>{visibleDepts.filter((d) => canManage(d.id) || d.id === job.department_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            {F({ label: 'المدينة', k: 'city' })}
          </div>
          <div className="grid2">{F({ label: 'نوع الدوام', k: 'employment_type' })}{F({ label: 'الخبرة', k: 'experience' })}</div>
          <div className="grid2">{F({ label: 'الراتب (اختياري)', k: 'salary_text' })}{F({ label: 'عدد الشواغر', k: 'vacancies', type: 'number', ltr: true })}</div>
          {T({ label: 'الوصف الوظيفي', k: 'description', rows: 4 })}
          {T({ label: 'المهام والمسؤوليات', k: '_tasks', rows: 6, hint: 'كل مهمة في سطر' })}
          {T({ label: 'الشروط والمتطلبات (تظهر للمتقدم)', k: '_reqs', rows: 6, hint: 'كل سطر بالشكل — العنوان: القيمة' })}
          <div className="grid2">{T({ label: 'متطلبات إلزامية (يطابقها الذكاء الاصطناعي مع السيرة)', k: '_must', rows: 4, hint: 'كل متطلب في سطر' })}{T({ label: 'متطلبات مفضّلة', k: '_nice', rows: 4, hint: 'كل متطلب في سطر' })}</div>
          {T({ label: 'المزايا', k: '_ben', rows: 3, hint: 'كل ميزة في سطر' })}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card stack">
            <b>النشر</b>
            <div className="seg" style={{ alignSelf: 'flex-start' }}>{Object.entries(JSTATUS).map(([k, [l]]) => <button key={k} disabled={ro} className={job.status === k ? 'on' : ''} onClick={() => set('status', k)}>{l}</button>)}</div>
            {F({ label: 'آخر موعد للتقديم', k: 'deadline', type: 'date', ltr: true })}
            <span className="label">لون الوظيفة</span>
            <div className="row wrap" style={{ gap: 8 }}>{COLORS.map((c) => <button key={c} disabled={ro} aria-label={c} onClick={() => set('color', c)} style={{ width: 34, height: 34, borderRadius: 10, background: c, border: job.color === c ? '3px solid var(--gold)' : '1px solid var(--line)', cursor: 'pointer' }} />)}</div>
          </div>
          <div className="card stack">
            <b>الاختبار</b>
            <div className="grid2">{F({ label: 'المدة (دقيقة)', k: 'duration_minutes', type: 'number', ltr: true, min: 5 })}{F({ label: 'حد الاجتياز %', k: 'pass_threshold', type: 'number', ltr: true, min: 0, max: 100 })}</div>
            <span className="hint">أقل من حد الاجتياز = رسالة اعتذار، وما فوقه = «سيتم التواصل معك».</span>
          </div>
          {isAdmin && <button className="btn btn-danger" onClick={del}><Icon name="trash" />حذف الوظيفة</button>}
        </div>
      </div>}

      {tab === 'questions' && <div className="stack" style={{ gap: 14 }}>
        {!ro && <div className="row wrap between"><div className="row wrap"><span className="small muted">إضافة:</span>{Object.entries(QTYPES).map(([t, l]) => <button key={t} className="btn btn-ghost btn-sm" onClick={() => setQs((x) => [...x, blankQ(t)])}><Icon name="plus" size={14} />{l}</button>)}</div>
          <button className="btn btn-gold" disabled={gen} onClick={generate}><Icon name="spark" />{gen ? 'جارٍ التوليد…' : 'توليد 10 أسئلة بالذكاء الاصطناعي'}</button></div>}
        {qs.length !== 10 && <div className="notice amber">عدد الأسئلة الحالي {qs.length} — الموصى به 10 أسئلة.</div>}
        {qs.map((q, k) => (
          <div key={q.id} className="card stack" style={{ gap: 12 }}>
            <div className="row between wrap"><div className="row"><span className="avatar mono">{k + 1}</span>
              <select className="select" style={{ width: 190, minHeight: 38 }} value={q.type} disabled={ro} onChange={(e) => { const t = e.target.value; setQ(k, { type: t, options: t === 'mcq' ? (q.options.length ? q.options : ['', '', '', '']) : q.options, key: { ...q.key, rubric: t === 'text' && !(q.key.rubric || []).length ? [{ point: '', weight: 5 }, { point: '', weight: 5 }] : q.key.rubric } }); }}>{Object.entries(QTYPES).map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select></div>
              {!ro && <div className="row" style={{ gap: 4 }}><button className="btn btn-ghost icon-btn" aria-label="أعلى" onClick={() => move(k, -1)}>↑</button><button className="btn btn-ghost icon-btn" aria-label="أسفل" onClick={() => move(k, 1)}>↓</button><button className="btn btn-danger icon-btn" aria-label="حذف السؤال" onClick={() => { if (!q._new) setRemoved((r) => [...r, q.id]); setQs((l) => l.filter((_, i) => i !== k)); }}><Icon name="trash" size={16} /></button></div>}</div>
            <textarea className="textarea" style={{ minHeight: 60 }} placeholder="نص السؤال" value={q.text} disabled={ro} onChange={(e) => setQ(k, { text: e.target.value })} />
            {q.type === 'mcq' && <div className="stack" style={{ gap: 8 }}>{q.options.map((o, oi) => <div key={oi} className="row"><label className="row small" style={{ gap: 6, width: 90 }}><input type="radio" name={`c-${q.id}`} checked={Number(q.key.correct_option) === oi} disabled={ro} onChange={() => setK(k, { correct_option: oi })} />{KEYS_AR[oi]} {Number(q.key.correct_option) === oi && <span className="pill p-green">صحيح</span>}</label><input className="input" value={o} disabled={ro} onChange={(e) => setQ(k, { options: q.options.map((x, i) => (i === oi ? e.target.value : x)) })} placeholder={`الخيار ${KEYS_AR[oi]}`} /></div>)}{!ro && q.options.length < 6 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setQ(k, { options: [...q.options, ''] })}>+ خيار</button>}</div>}
            {q.type === 'number' && <div className="grid3"><label className="field"><span className="label">الإجابة الصحيحة</span><input className="input ltr mono" value={q.key.correct_number ?? ''} disabled={ro} onChange={(e) => setK(k, { correct_number: e.target.value })} /></label><label className="field"><span className="label">الوحدة</span><input className="input" value={q.unit || ''} disabled={ro} onChange={(e) => setQ(k, { unit: e.target.value })} /></label><label className="field"><span className="label">هامش التسامح %</span><input className="input ltr mono" type="number" value={q.key.tolerance_pct ?? 2} disabled={ro} onChange={(e) => setK(k, { tolerance_pct: e.target.value })} /></label></div>}
            {(q.type === 'text' || q.type === 'number' || q.type === 'upload') && <label className="field"><span className="label">{q.type === 'text' ? 'الإجابة النموذجية' : q.type === 'number' ? 'طريقة الحل (للجنة)' : 'ما المتوقع إرفاقه'}</span><textarea className="textarea" style={{ minHeight: 60 }} value={q.key.model_answer || ''} disabled={ro} onChange={(e) => setK(k, { model_answer: e.target.value })} /></label>}
            {q.type === 'text' && <div className="stack" style={{ gap: 8 }}><span className="label">نقاط التصحيح (Rubric) — يصحّح بها الذكاء الاصطناعي</span>{(q.key.rubric || []).map((r, ri) => <div key={ri} className="row"><input className="input" value={r.point} disabled={ro} placeholder="نقطة يجب أن تذكرها الإجابة" onChange={(e) => setK(k, { rubric: q.key.rubric.map((x, i) => (i === ri ? { ...x, point: e.target.value } : x)) })} /><input className="input ltr mono" style={{ width: 90 }} type="number" aria-label="الوزن" value={r.weight} disabled={ro} onChange={(e) => setK(k, { rubric: q.key.rubric.map((x, i) => (i === ri ? { ...x, weight: e.target.value } : x)) })} />{!ro && <button className="btn btn-ghost icon-btn" aria-label="حذف" onClick={() => setK(k, { rubric: q.key.rubric.filter((_, i) => i !== ri) })}><Icon name="x" size={16} /></button>}</div>)}{!ro && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setK(k, { rubric: [...(q.key.rubric || []), { point: '', weight: 2 }] })}>+ نقطة</button>}</div>}
          </div>
        ))}
      </div>}

      {tab === 'ai' && <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gridColumn: 'span 2', background: 'var(--dark)', borderColor: 'var(--dark)', color: '#fff' }}>
          <div className="row between"><b className="row"><Icon name="spark" color="#F2C14E" />برومنت الوظيفة</b><Link to="/admin/settings" className="pill" style={{ background: 'var(--dark3)', color: 'var(--gold)', textDecoration: 'none' }}>النموذج: حسب الإعدادات</Link></div>
          <textarea className="textarea" style={{ minHeight: 260, background: 'var(--dark2)', color: '#E6E4DF', borderColor: 'var(--dark3)', fontSize: 14 }} value={job.ai_prompt || ''} disabled={ro} onChange={(e) => set('ai_prompt', e.target.value)} placeholder="مثال: أنت خبير توظيف في... ركّز على..." />
          <span className="small" style={{ color: '#B9BCC1', lineHeight: 1.8 }}>هذا النص يُضاف تلقائياً إلى سياق الوظيفة (الوصف، المهام، المتطلبات الإلزامية والمفضّلة) في كل عملية تحليل: توليد الأسئلة، تصحيح الإجابات النصية، تقييم المرفقات، تحليل السيرة الذاتية، واقتراح أسئلة المقابلة.</span>
        </div>
        <div className="card stack"><b>ماذا يستلم النموذج؟</b>
          {['المسمى والوصف والمهام', 'المتطلبات الإلزامية والمفضّلة', 'الإجابة النموذجية ونقاط التصحيح لكل سؤال نصي', 'نص السيرة بعد إخفاء الاسم والجوال والبريد', 'هذا البرومنت'].map((t) => <div key={t} className="row small" style={{ alignItems: 'flex-start' }}><span className="check"><Icon name="check" size={13} stroke={2.6} color="#A8412B" /></span>{t}</div>)}
          <div className="notice amber xs">الأسئلة الاختيارية والرقمية تُصحّح آلياً بدون ذكاء اصطناعي وبدقة 100%.</div>
        </div>
      </div>}

      {tab === 'rank' && <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <div className="row between"><b>أوزان الترتيب النهائي</b><Toggle label="تفعيل الأوزان" on={rw.enabled} onChange={(v) => !ro && set('rank_weights', { ...rw, enabled: v })} /></div>
          <span className="small muted" style={{ lineHeight: 1.8 }}>{rw.enabled ? 'الدرجة النهائية = مجموع (كل مكوّن × وزنه) ÷ مجموع الأوزان المتوفرة.' : 'الأوزان متوقفة: الدرجة النهائية = متوسط درجة الاختبار وتقييم اللجنة بالتساوي.'}</span>
          {rw.enabled && <div className="grid3">{[['test', 'الاختبار'], ['cv', 'السيرة الذاتية'], ['committee', 'اللجنة']].map(([k, l]) => <label key={k} className="field"><span className="label">{l} %</span><input className="input ltr mono" type="number" min="0" max="100" disabled={ro} value={rw[k] ?? 0} onChange={(e) => set('rank_weights', { ...rw, [k]: Number(e.target.value) })} /></label>)}</div>}
        </div>
        <div className="card stack">
          <div className="row between"><b>معايير تقييم اللجنة (1–5)</b><span className="row small" style={{ gap: 8 }}>موزونة<Toggle label="معايير موزونة" on={rw.criteria_weighted} onChange={(v) => !ro && set('rank_weights', { ...rw, criteria_weighted: v })} /></span></div>
          {(job.eval_criteria || []).map((c, k) => <div key={k} className="row"><input className="input" value={c.label} disabled={ro} onChange={(e) => set('eval_criteria', job.eval_criteria.map((x, i) => (i === k ? { ...x, label: e.target.value } : x)))} />{rw.criteria_weighted && <input className="input ltr mono" style={{ width: 90 }} type="number" aria-label="الوزن" value={c.weight} disabled={ro} onChange={(e) => set('eval_criteria', job.eval_criteria.map((x, i) => (i === k ? { ...x, weight: Number(e.target.value) } : x)))} />}{!ro && <button className="btn btn-ghost icon-btn" aria-label="حذف" onClick={() => set('eval_criteria', job.eval_criteria.filter((_, i) => i !== k))}><Icon name="x" size={16} /></button>}</div>)}
          {!ro && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('eval_criteria', [...(job.eval_criteria || []), { key: `c${Date.now()}`, label: '', weight: 10 }])}>+ معيار</button>}
        </div>
      </div>}
    </>
  );
}
