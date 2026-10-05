import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ago, callFn, displayPhone, downloadCSV, evalPercent, finalScore, fmtDate, fmtDateTime, Icon, initial, KEYS_AR, openSigned, Pill, QTYPES, REC, sb, Spinner, STATUS, useToast, waLink, fillTemplate, bookingLink } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

export function Candidates() {
  const { canAccess, canManage } = useAdmin();
  const nav = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [apps, setApps] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());
  const job = sp.get('job') || '';
  const status = sp.get('status') || '';
  const review = sp.get('review') === '1';
  const load = async () => {
    const [a, j] = await Promise.all([
      sb.from('applications').select('id,job_id,full_name,phone,email,status,test_score,cv_match,created_at,submitted_at,ai_status,ai_report->recommendation,ai_report->needs_review,ai_report->integrity_flags,interviews(starts_at,status)').order('created_at', { ascending: false }).limit(3000),
      sb.from('jobs').select('id,title,code,color,department_id').order('created_at'),
    ]);
    setApps(a.data || []); setJobs((j.data || []).filter((x) => canAccess(x.department_id)));
  };
  useEffect(() => { load(); }, []);
  const jobsById = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const list = useMemo(() => (apps || []).filter((a) => jobsById[a.job_id] && (!job || a.job_id === job) && (!status || a.status === status) && (!review || a.needs_review) && (!q || `${a.full_name} ${a.phone} ${a.email}`.toLowerCase().includes(q.trim().toLowerCase()))), [apps, job, status, review, q, jobs]);
  const setParam = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const bulk = async (st) => {
    const ids = [...sel].filter((id) => { const a = apps.find((x) => x.id === id); return a && canManage(jobsById[a.job_id]?.department_id); });
    if (!ids.length) return toast('لا تملك صلاحية تعديل المحددين', 'err');
    const { error } = await sb.from('applications').update({ status: st }).in('id', ids);
    if (error) return toast(error.message, 'err');
    toast(`تم تحديث ${ids.length} مرشح`, 'ok'); setSel(new Set()); load();
  };
  const exportCsv = () => downloadCSV('candidates.csv', [['الاسم', 'الجوال', 'البريد', 'الوظيفة', 'درجة الاختبار', 'مطابقة السيرة', 'الحالة', 'تاريخ التقديم'], ...list.map((a) => [a.full_name, displayPhone(a.phone), a.email, jobsById[a.job_id]?.title, a.test_score ?? '', a.cv_match ?? '', STATUS[a.status]?.l, fmtDate(a.created_at)])]);
  if (!apps) return <Spinner />;
  return (
    <>
      <div className="page-head"><div><h1>المرشحون</h1><p>{list.length} مرشحاً — من وظائف أقسامك فقط</p></div><button className="btn btn-ghost" onClick={exportCsv}><Icon name="download" />تصدير Excel</button></div>
      <div className="card row wrap" style={{ padding: 14, gap: 10 }}>
        <div className="row grow" style={{ minWidth: 220 }}><Icon name="search" color="#5E6166" /><input className="input" style={{ border: 0, minHeight: 40 }} placeholder="بحث بالاسم أو الجوال أو البريد" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 200 }} value={job} onChange={(e) => setParam('job', e.target.value)} aria-label="الوظيفة"><option value="">كل الوظائف</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="الحالة"><option value="">كل الحالات</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
        <button className={`chip ${review ? 'on' : ''}`} onClick={() => setParam('review', review ? '' : '1')}>يحتاج مراجعة</button>
      </div>
      {sel.size > 0 && <div className="card row wrap" style={{ padding: 12, background: 'var(--amber-bg)', borderColor: '#EBD9A8' }}><b className="small">محدد: {sel.size}</b><span className="small muted">تغيير الحالة إلى:</span>{['passed', 'interviewed', 'offer', 'hired', 'rejected'].map((st) => <button key={st} className="btn btn-ghost btn-sm" onClick={() => bulk(st)}>{STATUS[st].l}</button>)}<button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>إلغاء</button></div>}
      <div className="card flat"><div className="table-wrap"><table className="table"><thead><tr><th style={{ width: 36 }}><input type="checkbox" aria-label="تحديد الكل" checked={sel.size > 0 && sel.size === list.length} onChange={(e) => setSel(e.target.checked ? new Set(list.map((a) => a.id)) : new Set())} /></th><th>المرشح</th><th>الوظيفة</th><th>الاختبار</th><th>السيرة</th><th>التوصية</th><th>الحالة</th><th>المقابلة</th></tr></thead><tbody>
        {list.map((a) => { const iv = (a.interviews || [])[0] || (a.interviews && !Array.isArray(a.interviews) ? a.interviews : null); return (
          <tr key={a.id} className="click" onClick={() => nav(`/admin/candidates/${a.id}`)}>
            <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="تحديد" checked={sel.has(a.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(a.id) : n.delete(a.id); setSel(n); }} /></td>
            <td><div className="row"><span className="avatar">{initial(a.full_name)}</span><div className="stack" style={{ gap: 0 }}><b className="small">{a.full_name}</b><span className="xs muted mono" dir="ltr" style={{ textAlign: 'right' }}>{displayPhone(a.phone)}</span></div></div></td>
            <td className="small"><span className="row" style={{ gap: 6 }}><span className="sw" style={{ background: jobsById[a.job_id]?.color }} />{jobsById[a.job_id]?.title}</span><span className="xs muted">{ago(a.created_at)}</span></td>
            <td>{a.test_score != null ? <div className="row" style={{ gap: 8 }}><span className="mono small" style={{ width: 46, fontWeight: 600 }}>{a.test_score}%</span><div className="bar" style={{ width: 70, height: 6 }}><span style={{ width: `${a.test_score}%`, background: a.status === 'failed' ? '#B8B2A8' : 'var(--green)' }} /></div></div> : <span className="xs muted">لم يكمل</span>}</td>
            <td className="mono small">{a.cv_match != null ? `${a.cv_match}%` : '—'}</td>
            <td>{a.recommendation ? <span className={`pill ${REC[a.recommendation]?.c}`}>{REC[a.recommendation]?.l}</span> : '—'}{a.needs_review && <span className="pill p-amber" style={{ marginInlineStart: 4 }}>مراجعة</span>}{(a.integrity_flags || []).length > 0 && <span className="pill p-red" style={{ marginInlineStart: 4 }} title={(a.integrity_flags || []).join('\n')}>!</span>}</td>
            <td><Pill status={a.status} /></td>
            <td className="xs">{iv ? fmtDateTime(iv.starts_at) : '—'}</td>
          </tr>); })}
        {!list.length && <tr><td colSpan={8} className="empty">لا توجد نتائج</td></tr>}
      </tbody></table></div></div>
    </>
  );
}

const ST_ICON = { met: ['مطابق', 'p-green'], partial: ['جزئي', 'p-amber'], missing: ['غير موجود', 'p-red'] };

export function CandidateView() {
  const { id } = useParams();
  const { me, canManage, isAdmin, company } = useAdmin();
  const toast = useToast();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [my, setMy] = useState({ scores: {}, notes: '' });
  const [busy, setBusy] = useState('');
  const [ovr, setOvr] = useState({});
  const load = async () => {
    const { data: app } = await sb.from('applications').select('*, jobs(*)').eq('id', id).maybeSingle();
    if (!app) return setD(false);
    const [qs, ans, evs, iv, logs, tpl, st] = await Promise.all([
      sb.from('questions').select('*, question_keys(*)').eq('job_id', app.job_id).order('position'),
      sb.from('answers').select('*').eq('application_id', id),
      sb.from('evaluations').select('*, profiles(full_name)').eq('application_id', id),
      sb.from('interviews').select('*').eq('application_id', id).maybeSingle(),
      sb.from('wa_logs').select('*, profiles(full_name)').eq('application_id', id).order('sent_at', { ascending: false }),
      sb.from('wa_templates').select('*').order('sort'),
      sb.from('app_settings').select('wa_mode').eq('id', 1).maybeSingle(),
    ]);
    const mine = (evs.data || []).find((e) => e.evaluator_id === me.id);
    setMy({ scores: mine?.scores || {}, notes: mine?.notes || '' });
    setD({ app, job: app.jobs, qs: qs.data || [], ans: Object.fromEntries((ans.data || []).map((a) => [a.question_id, a])), evs: evs.data || [], iv: iv.data, logs: logs.data || [], tpl: tpl.data || [], waMode: st.data?.wa_mode || 'wa' });
  };
  useEffect(() => { load(); }, [id]);
  if (d === null) return <Spinner />;
  if (d === false) return <div className="card empty">المرشح غير موجود أو لا تملك صلاحية الاطلاع عليه</div>;
  const { app, job } = d;
  const manage = canManage(job.department_id);
  const rep = app.ai_report || {};
  const cv = rep.cv || {};
  const crit = job.eval_criteria || [];
  const weighted = !!job.rank_weights?.criteria_weighted;
  const myPct = evalPercent({ scores: my.scores }, crit, weighted);
  const fs = finalScore(app, d.evs, job);
  const setStatus = async (st) => { const { error } = await sb.from('applications').update({ status: st }).eq('id', id); if (error) return toast(error.message, 'err'); toast('تم تحديث الحالة', 'ok'); load(); };
  const saveEval = async () => {
    if (myPct == null) return toast('قيّم معياراً واحداً على الأقل', 'err');
    setBusy('eval');
    const { error } = await sb.from('evaluations').upsert({ application_id: id, evaluator_id: me.id, scores: my.scores, total: myPct, notes: my.notes }, { onConflict: 'application_id,evaluator_id' });
    setBusy('');
    if (error) return toast(error.message, 'err');
    toast('تم اعتماد تقييمك', 'ok'); load();
  };
  const reanalyze = async () => { setBusy('ai'); try { const r = await callFn('staff', { action: 'reanalyze', application_id: id }); toast(`أُعيد التحليل: ${r.testScore}%`, 'ok'); load(); } catch (x) { toast(x.message, 'err'); } setBusy(''); };
  const override = async (qid, max) => {
    const v = Number(ovr[qid]); if (isNaN(v) || v < 0 || v > max) return toast(`الدرجة بين 0 و ${max}`, 'err');
    const { error } = await sb.from('answers').update({ score: v, overridden: true, reason: `عدّلها ${me.full_name}` }).eq('application_id', id).eq('question_id', qid);
    if (error) return toast(error.message, 'err');
    const { data: all } = await sb.from('answers').select('score,max_score').eq('application_id', id);
    const sum = (all || []).reduce((s, a) => s + Number(a.score || 0), 0); const mx = (all || []).reduce((s, a) => s + Number(a.max_score || 0), 0);
    const ts = mx ? Math.round((sum / mx) * 1000) / 10 : 0;
    const patch = { test_score: ts };
    if (['passed', 'failed'].includes(app.status)) patch.status = ts >= job.pass_threshold ? 'passed' : 'failed';
    await sb.from('applications').update(patch).eq('id', id);
    await sb.from('audit_log').insert({ actor: me.id, action: 'override_score', entity: 'application', entity_id: id, data: { question_id: qid, score: v } });
    toast('تم تعديل الدرجة', 'ok'); setOvr({}); load();
  };
  const openFile = async (bucket, path, dl) => { try { const u = await openSigned(bucket, path, dl); window.open(u, '_blank', 'noopener'); } catch (x) { toast('تعذّر فتح الملف: ' + x.message, 'err'); } };
  const sendWa = async (t) => {
    const text = fillTemplate(t.body, { name: app.full_name.split(' ')[0], job: job.title, when: d.iv ? fmtDateTime(d.iv.starts_at) : '', booking: bookingLink(app.token), room: d.iv?.room_url, company });
    window.open(waLink(app.phone, text, d.waMode), '_blank', 'noopener');
    await sb.from('wa_logs').insert({ application_id: id, template_key: t.key, sent_by: me.id }); load();
  };
  const del = async () => { if (!confirm('حذف المرشح نهائياً؟')) return; const { error } = await sb.from('applications').delete().eq('id', id); if (error) return toast(error.message, 'err'); nav('/admin/candidates'); };
  const answerText = (q, a) => {
    if (!a) return <span className="muted">لم يُجب</span>;
    if (q.type === 'mcq') return a.value_option != null ? `${KEYS_AR[a.value_option]}) ${q.options[a.value_option] ?? ''}` : <span className="muted">لم يُجب</span>;
    if (q.type === 'number') return a.value_number != null ? <span className="mono">{a.value_number} {q.unit}</span> : <span className="muted">لم يُجب</span>;
    if (q.type === 'text') return a.value_text ? <span style={{ whiteSpace: 'pre-wrap' }}>{a.value_text}</span> : <span className="muted">لم يُجب</span>;
    return (a.files || []).length ? <div className="row wrap" style={{ gap: 6 }}>{a.files.map((f, k) => <button key={f} className="btn btn-ghost btn-sm" onClick={() => openFile('portfolios', f)}><Icon name="image" size={15} />ملف {k + 1}</button>)}</div> : <span className="muted">لم يُرفق</span>;
  };

  return (
    <>
      <div className="card row wrap" style={{ gap: 18, padding: '20px 24px' }}>
        <span className="avatar display" style={{ width: 60, height: 60, borderRadius: 18, background: job.color, color: '#fff', fontSize: 24 }}>{initial(app.full_name)}</span>
        <div className="stack grow" style={{ gap: 6 }}>
          <div className="row wrap"><h1 style={{ fontSize: 24 }}>{app.full_name}</h1><Pill status={app.status} />{rep.recommendation && <span className={`pill ${REC[rep.recommendation]?.c}`}>{REC[rep.recommendation]?.l}</span>}</div>
          <span className="small muted">{job.title} · {job.code} · قدّم {fmtDate(app.created_at)} · <span dir="ltr" className="mono">{displayPhone(app.phone)}</span> · {app.email}</span>
        </div>
        <div className="row wrap">
          {manage && <select className="select" style={{ width: 170 }} value={app.status} onChange={(e) => setStatus(e.target.value)} aria-label="تغيير الحالة">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>}
          <Link className="btn btn-outline" to={`/admin/schedule?job=${job.id}`}><Icon name="calendar" />الموعد</Link>
          {isAdmin && <button className="btn btn-danger icon-btn" aria-label="حذف المرشح" onClick={del}><Icon name="trash" /></button>}
        </div>
      </div>

      <div className="grid5" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gridColumn: 'span 3', gap: 20 }}>
          <div className="card stack" style={{ gap: 16 }}>
            <div className="row between wrap"><b className="row"><Icon name="spark" color="#9A6A08" />التحليل الذكي</b>
              <div className="row"><Link to="/admin/settings" className="xs muted">{rep.model?.text ? `النموذج: ${rep.model.text}` : 'تقييم مبدئي بدون مزوّد ذكاء اصطناعي'}</Link>{manage && app.submitted_at && <button className="btn btn-ghost btn-sm" disabled={busy === 'ai'} onClick={reanalyze}><Icon name="refresh" size={15} />{busy === 'ai' ? 'جارٍ التحليل…' : 'إعادة التحليل'}</button>}</div></div>
            {!app.submitted_at ? <div className="notice amber">لم يُكمل المرشح الاختبار بعد.</div> : <>
              <div className="grid3" style={{ gap: 10 }}>
                <div className="stack" style={{ gap: 2, padding: 16, borderRadius: 14, background: app.status === 'failed' ? 'var(--red-bg)' : 'var(--green-bg)' }}><span className="xs">درجة الاختبار (الحد {job.pass_threshold}%)</span><span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{app.test_score ?? '—'}%</span></div>
                <div className="stack" style={{ gap: 2, padding: 16, borderRadius: 14, background: '#F8F6F2' }}><span className="xs">مطابقة السيرة الذاتية</span><span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>{app.cv_match != null ? `${app.cv_match}%` : '—'}</span></div>
                <div className="stack" style={{ gap: 2, padding: 16, borderRadius: 14, background: '#F8F6F2' }}><span className="xs">الثقة في التقييم</span><span style={{ fontSize: 22, fontWeight: 700 }}>{rep.confidence === 'high' ? 'عالية' : 'متوسطة'}</span></div>
              </div>
              {rep.needs_review && <div className="notice amber">يحتاج مراجعة بشرية: {app.ai_status === 'fallback' ? 'تم جزء من التقييم آلياً بالكلمات المفتاحية (فعّل مزوّد الذكاء الاصطناعي من الإعدادات لتحليل أدق).' : 'الدرجة قريبة من حد الاجتياز.'}</div>}
              {cv.summary && <p className="small" style={{ lineHeight: 1.9, color: 'var(--ink2)' }}>{cv.summary}</p>}
              <div className="row wrap" style={{ gap: 6 }}>{(rep.strengths || []).map((s) => <span key={s} className="pill p-green">+ {s}</span>)}{(rep.gaps || []).map((s) => <span key={s} className="pill p-red">− {s}</span>)}</div>
              {(rep.interview_questions || []).length > 0 && <div className="stack" style={{ gap: 6 }}><span className="label">أسئلة مقترحة للمقابلة</span>{rep.interview_questions.map((q, k) => <div key={k} className="row small" style={{ alignItems: 'flex-start' }}><span className="mono" style={{ color: 'var(--accent-ink)' }}>{k + 1}</span><span>{q}</span></div>)}</div>}
              {(rep.integrity_flags || []).length > 0 && <div className="notice red"><Icon name="shield" style={{ flex: 'none' }} /><span><b>مؤشرات النزاهة:</b> {rep.integrity_flags.join(' · ')}</span></div>}
              {(rep.ai_errors || []).length > 0 && <div className="notice amber xs">تنبيه المزوّد: {rep.ai_errors.join(' · ')}</div>}
            </>}
          </div>

          <div className="card flat">
            <div className="card-head"><span className="card-title">الإجابات وتقييم كل سؤال</span><span className="xs muted">{app.submitted_at && app.started_at ? `${Math.round((new Date(app.submitted_at) - new Date(app.started_at)) / 60000)} دقيقة` : ''}</span></div>
            {d.qs.map((q, k) => { const a = d.ans[q.id]; const key = (Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys) || {}; const ok = a && a.score != null && Number(a.score) >= Number(a.max_score || q.points) * 0.6; return (
              <div key={q.id} className="row" style={{ alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderTop: '1px solid var(--line2)' }}>
                <span className="avatar mono" style={{ width: 30, height: 30, borderRadius: 8 }}>{k + 1}</span>
                <div className="stack grow" style={{ gap: 6 }}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}><b className="small" style={{ lineHeight: 1.7 }}>{q.text}</b><span className="pill p-gray">{QTYPES[q.type]}</span></div>
                  <div className="small" style={{ color: 'var(--ink2)', lineHeight: 1.8 }}>{answerText(q, a)}</div>
                  {q.type === 'mcq' && key.correct_option != null && <span className="xs muted">الصحيح: {KEYS_AR[key.correct_option]}) {q.options[key.correct_option]}</span>}
                  {a?.reason && <span className="xs" style={{ color: '#6B5210' }}>{a.overridden ? '✎ ' : ''}{a.reason}</span>}
                  {(a?.details?.points || []).length > 0 && <div className="stack" style={{ gap: 4, padding: 10, background: '#F8F6F2', borderRadius: 10 }}>{a.details.points.map((p, pi) => <div key={pi} className="row between xs"><span>{p.point}{p.evidence ? <span className="muted"> — «{p.evidence}»</span> : ''}</span><span className="mono" style={{ fontWeight: 700, color: Number(p.got) >= Number(p.weight) ? 'var(--green-ink)' : Number(p.got) === 0 ? 'var(--red-ink)' : 'var(--amber-ink)' }}>{p.got}/{p.weight}</span></div>)}</div>}
                  {manage && a && <div className="row" style={{ gap: 6 }}><input className="input ltr mono" style={{ width: 90, minHeight: 34 }} placeholder={String(a.score ?? '')} aria-label="درجة يدوية" value={ovr[q.id] ?? ''} onChange={(e) => setOvr({ ...ovr, [q.id]: e.target.value })} /><button className="btn btn-ghost btn-sm" disabled={ovr[q.id] === undefined || ovr[q.id] === ''} onClick={() => override(q.id, Number(a.max_score || q.points))}>تعديل الدرجة</button></div>}
                </div>
                <span className={`pill ${a?.score == null ? 'p-gray' : ok ? 'p-green' : 'p-red'} mono`}>{a?.score ?? '—'}/{a?.max_score ?? q.points}</span>
              </div>); })}
          </div>
        </div>

        <div className="stack" style={{ gridColumn: 'span 2', gap: 20 }}>
          <div className="card stack">
            <div className="row between"><b>تقييمك كعضو لجنة</b><span className="xs muted">من 1 إلى 5</span></div>
            {crit.map((c) => <div key={c.key} className="stack" style={{ gap: 6 }}><div className="row between small"><span>{c.label}</span>{weighted && <span className="xs muted">الوزن {c.weight}</span>}</div>
              <div className="grid5 crit" style={{ gap: 6 }}>{[1, 2, 3, 4, 5].map((v) => <button key={v} className={my.scores[c.key] === v ? 'on' : ''} aria-label={`${c.label} ${v}`} onClick={() => setMy({ ...my, scores: { ...my.scores, [c.key]: v } })}>{v}</button>)}</div></div>)}
            <label className="field"><span className="label">ملاحظات</span><textarea className="textarea" style={{ minHeight: 80 }} value={my.notes} onChange={(e) => setMy({ ...my, notes: e.target.value })} placeholder="انطباعك عن المرشح…" /></label>
            <div className="row between" style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--dark)', color: '#fff' }}><span className="small" style={{ color: '#CFD2D6' }}>تقييمك</span><span className="mono" style={{ fontSize: 22, color: 'var(--gold)' }}>{myPct ?? '—'}%</span></div>
            <button className="btn btn-accent" disabled={busy === 'eval'} onClick={saveEval}>اعتماد التقييم</button>
          </div>

          <div className="card stack">
            <b>تقييمات اللجنة ({d.evs.length})</b>
            {d.evs.map((e) => <div key={e.id} className="stack" style={{ gap: 2 }}><div className="row"><span className="avatar">{initial(e.profiles?.full_name || 'ع')}</span><span className="grow small" style={{ fontWeight: 600 }}>{e.profiles?.full_name || 'عضو لجنة'}</span><span className="mono" style={{ fontWeight: 600 }}>{e.total}%</span></div>{e.notes && <span className="xs muted" style={{ paddingInlineStart: 44 }}>{e.notes}</span>}</div>)}
            {!d.evs.length && <span className="small muted">لم يقيّم أحد بعد</span>}
            <div className="stack small" style={{ gap: 6, padding: 14, borderRadius: 12, background: '#F8F6F2' }}>
              <div className="row between"><span className="muted">متوسط اللجنة</span><b className="mono">{fs.committee ?? '—'}{fs.committee != null && '%'}</b></div>
              <div className="row between"><span className="muted">{job.rank_weights?.enabled ? `النهائية (أوزان: اختبار ${job.rank_weights.test}% · سيرة ${job.rank_weights.cv}% · لجنة ${job.rank_weights.committee}%)` : 'النهائية (متوسط بسيط)'}</span><b className="mono" style={{ fontSize: 16 }}>{fs.final ?? '—'}</b></div>
              <Link to={`/admin/ranking?job=${job.id}`} className="xs" style={{ fontWeight: 600 }}>عرض الترتيب</Link>
            </div>
          </div>

          <div className="card stack">
            <div className="row"><span className="file-ic">{(app.cv_name || 'CV').split('.').pop().toUpperCase().slice(0, 4)}</span><span className="stack grow" style={{ gap: 0 }}><b className="small" style={{ wordBreak: 'break-all' }}>{app.cv_name || 'السيرة الذاتية'}</b><span className="xs muted">السيرة الذاتية</span></span></div>
            <div className="grid2" style={{ gap: 8 }}><button className="btn btn-dark" disabled={!app.cv_path} onClick={() => openFile('cvs', app.cv_path)}><Icon name="eye" />عرض</button><button className="btn btn-outline" disabled={!app.cv_path} onClick={() => openFile('cvs', app.cv_path, app.cv_name || true)}><Icon name="download" />تحميل</button></div>
            {cv && (cv.requirements || []).length > 0 && <div className="stack" style={{ gap: 6, paddingTop: 10, borderTop: '1px solid var(--line2)' }}>
              <div className="row between"><span className="label">مطابقة السيرة مع المتطلبات</span>{cv.years_experience != null && <span className="pill p-gray">خبرة {cv.years_experience} سنوات</span>}</div>
              {cv.requirements.map((r, k) => <div key={k} className="row between xs" style={{ gap: 8 }}><span>{r.requirement} <span className="muted">({r.type === 'must' ? 'إلزامي' : 'مفضّل'})</span>{r.evidence ? <span className="muted"> — {r.evidence}</span> : ''}</span><span className={`pill ${ST_ICON[r.status]?.[1] || 'p-gray'}`}>{ST_ICON[r.status]?.[0] || r.status}</span></div>)}
              {(cv.red_flags || []).map((f) => <div key={f} className="notice amber xs">{f}</div>)}
            </div>}
          </div>

          <div className="card stack">
            <b>المقابلة</b>
            {d.iv ? <><span className="small">{fmtDateTime(d.iv.starts_at)}</span>{d.iv.room_url && <a href={d.iv.room_url} target="_blank" rel="noreferrer" className="small mono" dir="ltr" style={{ wordBreak: 'break-all' }}>{d.iv.room_url}</a>}</> : <span className="small muted">لم يُحدد موعد بعد</span>}
            <span className="label">إرسال رسالة واتساب</span>
            <div className="row wrap" style={{ gap: 6 }}>{d.tpl.map((t) => <button key={t.key} className="btn btn-wa btn-sm" onClick={() => sendWa(t)}><Icon name="wa" size={15} />{t.title}</button>)}</div>
            {d.logs.length > 0 && <div className="stack xs" style={{ gap: 4, paddingTop: 8, borderTop: '1px solid var(--line2)' }}>{d.logs.map((l) => <span key={l.id} className="muted">✓ {d.tpl.find((t) => t.key === l.template_key)?.title || l.template_key} — {l.profiles?.full_name || ''} · {ago(l.sent_at)}</span>)}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
