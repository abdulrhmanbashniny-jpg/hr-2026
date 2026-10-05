import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadCSV, finalScore, fmtDateTime, initial, Pill, sb, Spinner, Toggle, useToast } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

const QUAL = ['passed', 'interview', 'interviewed', 'offer', 'hired'];
export default function Ranking() {
  const { canAccess, canManage } = useAdmin();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [jobs, setJobs] = useState(null);
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState('final');
  const [showAll, setShowAll] = useState(false);
  const [w, setW] = useState(null);
  const jobId = sp.get('job') || jobs?.[0]?.id;
  useEffect(() => { sb.from('jobs').select('id,title,code,color,department_id,rank_weights,eval_criteria,vacancies').order('created_at').then(({ data }) => setJobs((data || []).filter((j) => canAccess(j.department_id)))); }, []);
  const job = jobs?.find((j) => j.id === jobId);
  const load = async () => {
    if (!jobId) return;
    setRows(null);
    const { data: apps } = await sb.from('applications').select('id,full_name,status,test_score,cv_match,ai_report->recommendation,interviews(starts_at)').eq('job_id', jobId).not('submitted_at', 'is', null);
    const ids = (apps || []).map((a) => a.id);
    const { data: evs } = ids.length ? await sb.from('evaluations').select('application_id,total').in('application_id', ids) : { data: [] };
    setRows((apps || []).map((a) => ({ ...a, evs: (evs || []).filter((e) => e.application_id === a.id) })));
  };
  useEffect(() => { load(); if (job) setW(job.rank_weights || {}); }, [jobId, jobs]);
  const ranked = useMemo(() => {
    if (!rows || !job) return [];
    const jj = { ...job, rank_weights: w || job.rank_weights };
    const list = rows.filter((a) => showAll || QUAL.includes(a.status)).map((a) => ({ ...a, ...finalScore(a, a.evs, jj) }));
    const key = sort === 'test' ? 'test_score' : sort === 'committee' ? 'committee' : sort === 'cv' ? 'cv_match' : 'final';
    return list.sort((x, y) => (Number(y[key] ?? -1) - Number(x[key] ?? -1)) || (Number(y.test_score ?? 0) - Number(x.test_score ?? 0))).map((a, k) => ({ ...a, rank: k + 1 }));
  }, [rows, job, w, sort, showAll]);
  if (!jobs) return <Spinner />;
  if (!jobs.length) return <div className="card empty">لا توجد وظائف ضمن أقسامك</div>;
  const manage = job && canManage(job.department_id);
  const saveW = async () => { const { error } = await sb.from('jobs').update({ rank_weights: w }).eq('id', job.id); if (error) return toast(error.message, 'err'); setJobs(jobs.map((j) => (j.id === job.id ? { ...j, rank_weights: w } : j))); toast('تم حفظ الأوزان', 'ok'); };
  const exportCsv = () => downloadCSV(`ranking-${job.code}.csv`, [['الترتيب', 'الاسم', 'الاختبار', 'السيرة', 'اللجنة', 'عدد التقييمات', 'النهائية'], ...ranked.map((a) => [a.rank, a.full_name, a.test_score, a.cv_match ?? '', a.committee ?? '', a.evalCount, a.final ?? ''])]);
  const ww = w || {};
  return (
    <>
      <div className="page-head"><div><h1>ترتيب المرشحين</h1><p>{job?.title} · {ranked.length} مرشحاً · {job?.vacancies} شواغر</p></div><button className="btn btn-ghost" onClick={exportCsv}>تصدير Excel</button></div>
      <div className="row wrap" style={{ gap: 8 }}>{jobs.map((j) => <button key={j.id} className={`chip ${j.id === jobId ? 'on' : ''}`} onClick={() => setSp({ job: j.id })}><span className="sw" style={{ background: j.color }} />{j.title}</button>)}</div>
      <div className="card row wrap between" style={{ gap: 16 }}>
        <div className="row wrap" style={{ gap: 14 }}>
          <span className="row small" style={{ gap: 8, fontWeight: 600 }}><Toggle label="الأوزان" on={ww.enabled} onChange={(v) => setW({ ...ww, enabled: v })} />استخدام الأوزان</span>
          {ww.enabled ? [['test', 'الاختبار'], ['cv', 'السيرة'], ['committee', 'اللجنة']].map(([k, l]) => <label key={k} className="row small" style={{ gap: 6 }}>{l}<input className="input ltr mono" style={{ width: 74, minHeight: 36 }} type="number" value={ww[k] ?? 0} onChange={(e) => setW({ ...ww, [k]: Number(e.target.value) })} />%</label>)
            : <span className="small muted">الدرجة النهائية = متوسط الاختبار وتقييم اللجنة بالتساوي</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>{manage && JSON.stringify(ww) !== JSON.stringify(job?.rank_weights || {}) && <button className="btn btn-dark btn-sm" onClick={saveW}>حفظ كإعداد للوظيفة</button>}<button className={`chip ${showAll ? 'on' : ''}`} onClick={() => setShowAll(!showAll)}>إظهار غير المجتازين</button></div>
      </div>
      {!rows ? <Spinner /> : <>
        {ranked.length > 0 && <div className="grid3">{ranked.slice(0, 3).map((a, k) => <Link key={a.id} to={`/admin/candidates/${a.id}`} className={`podium ${k === 0 ? 'first' : ''}`}>
          <div className="row between"><span className="mono" style={{ fontSize: 30, fontWeight: 600 }}>#{a.rank}</span><span className="mono" style={{ fontSize: 28, fontWeight: 600, color: k === 0 ? 'var(--gold)' : 'var(--teal)' }}>{a.final ?? '—'}</span></div>
          <div className="stack" style={{ gap: 2 }}><span className="display" style={{ fontWeight: 600, fontSize: 19 }}>{a.full_name}</span><span className="small" style={{ opacity: .8 }}>اختبار {a.test_score}% · لجنة {a.committee ?? '—'}{a.committee != null && '%'} · {a.evalCount} تقييمات</span></div>
        </Link>)}</div>}
        <div className="card flat"><div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>المرشح</th>
          {[['test', 'الاختبار'], ['cv', 'السيرة'], ['committee', 'اللجنة'], ['final', 'الدرجة النهائية']].map(([k, l]) => <th key={k}><button onClick={() => setSort(k)} style={{ border: 0, background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: sort === k ? 'var(--ink)' : 'var(--muted)', padding: 0 }}>{l} {sort === k ? '↓' : ''}</button></th>)}
          <th>الحالة</th><th>المقابلة</th></tr></thead><tbody>
          {ranked.map((a) => { const iv = Array.isArray(a.interviews) ? a.interviews[0] : a.interviews; return <tr key={a.id}>
            <td className="mono" style={{ fontWeight: 600 }}>{a.rank}</td>
            <td><Link to={`/admin/candidates/${a.id}`} className="row" style={{ color: 'var(--ink)', textDecoration: 'none' }}><span className="avatar">{initial(a.full_name)}</span><b className="small">{a.full_name}</b></Link></td>
            <td className="mono">{a.test_score}%</td><td className="mono">{a.cv_match != null ? `${a.cv_match}%` : '—'}</td>
            <td className="mono">{a.committee != null ? `${a.committee}%` : '—'} <span className="xs muted">({a.evalCount})</span></td>
            <td><div className="row" style={{ gap: 8 }}><b className="mono" style={{ width: 44 }}>{a.final ?? '—'}</b><div className="bar grow" style={{ minWidth: 80 }}><span style={{ width: `${a.final || 0}%` }} /></div></div></td>
            <td><Pill status={a.status} /></td><td className="xs">{iv ? fmtDateTime(iv.starts_at) : '—'}</td></tr>; })}
          {!ranked.length && <tr><td colSpan={8} className="empty">لا يوجد مرشحون مجتازون لهذه الوظيفة بعد</td></tr>}
        </tbody></table></div></div>
      </>}
    </>
  );
}
