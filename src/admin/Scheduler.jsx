import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingLink, DAYS, finalScore, fmtDateTime, fmtDay, fmtTime, generateSlots, daySlots, Icon, initial, minToTime, sb, Spinner, Toggle, useToast } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

const MEET = { jitsi: 'Jitsi Meet — رابط فريد تلقائي لكل مقابلة', static: 'رابط قاعة ثابت من الإعدادات', none: 'بدون رابط تلقائي' };
export default function Scheduler() {
  const { canAccess, canManage } = useAdmin();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [jobs, setJobs] = useState(null);
  const [ss, setSs] = useState(null);
  const [ivs, setIvs] = useState([]);
  const [apps, setApps] = useState([]);
  const [meet, setMeet] = useState('jitsi');
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const jobId = sp.get('job') || jobs?.[0]?.id;
  useEffect(() => {
    sb.from('jobs').select('id,title,code,color,department_id,rank_weights').order('created_at').then(({ data }) => setJobs((data || []).filter((j) => canAccess(j.department_id))));
    sb.from('app_settings').select('meeting_provider').eq('id', 1).maybeSingle().then(({ data }) => data && setMeet(data.meeting_provider));
  }, []);
  const job = jobs?.find((j) => j.id === jobId);
  const curJob = useRef(jobId); curJob.current = jobId;
  const load = async () => {
    if (!jobId) return;
    const jid = jobId;
    const [s, i, a] = await Promise.all([
      sb.from('schedule_settings').select('*').eq('job_id', jobId).maybeSingle(),
      sb.from('interviews').select('*').eq('job_id', jobId).neq('status', 'cancelled').order('starts_at'),
      sb.from('applications').select('id,full_name,phone,status,test_score,cv_match,token,evaluations(total)').eq('job_id', jobId).in('status', ['passed', 'interview', 'interviewed']),
    ]);
    if (curJob.current !== jid) return;
    setSs(s.data || { job_id: jobId, date_from: null, date_to: null, days: [0, 1, 2, 3, 4], start_min: 600, end_min: 900, duration_min: 30, break_min: 10, exclude_prayer: true, prayer_start: 720, prayer_end: 750, mode: 'committee', _new: true });
    setIvs(i.data || []); setApps(a.data || []); setDirty(false);
  };
  useEffect(() => { setSs(null); load(); setDay(null); }, [jobId]);
  const slots = useMemo(() => (ss ? generateSlots(ss) : []), [ss]);
  const perDay = ss ? daySlots(ss).length : 0;
  const dates = [...new Set(slots.map((x) => x.date))];
  const activeDay = day && dates.includes(day) ? day : dates[0];
  const taken = new Map(ivs.map((i) => [new Date(i.starts_at).toISOString(), i]));
  const appsById = Object.fromEntries(apps.map((a) => [a.id, a]));
  const ranked = useMemo(() => apps.map((a) => ({ ...a, ...finalScore(a, a.evaluations || [], job || {}) })).sort((x, y) => Number(y.final ?? 0) - Number(x.final ?? 0)).map((a, k) => ({ ...a, rank: k + 1 })), [apps, job]);
  const withIv = new Set(ivs.map((i) => i.application_id));
  const assigned = ivs.map((i) => ({ iv: i, app: appsById[i.application_id] })).filter((x) => x.app);
  const unassigned = ranked.filter((a) => !withIv.has(a.id) && a.status === 'passed');
  const future = slots.filter((x) => new Date(x.starts_at).getTime() > Date.now() + 30 * 60000 && !taken.has(x.starts_at));
  if (!jobs) return <Spinner />;
  if (!jobs.length) return <div className="card empty">لا توجد وظائف ضمن أقسامك</div>;
  const manage = job && canManage(job.department_id);
  const upd = (patch) => { setSs({ ...ss, ...patch }); setDirty(true); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const save = async () => {
    const { _new, ...row } = ss;
    if (row.date_from && row.date_to && row.date_from > row.date_to) return toast('تاريخ البداية بعد تاريخ النهاية', 'err');
    const { error } = await sb.from('schedule_settings').upsert(row, { onConflict: 'job_id' });
    if (error) return toast(error.message, 'err');
    toast('تم حفظ إعدادات المواعيد', 'ok'); setDirty(false); load();
  };
  const assign = async (app, slot) => {
    const s = slot || future[0];
    if (!s) return toast('لا توجد مواعيد متاحة — وسّع الفترة أو الوقت', 'err');
    const { error } = await sb.from('interviews').insert({ application_id: app.id, job_id: jobId, starts_at: s.starts_at, ends_at: s.ends_at });
    if (error) { toast(error.message.includes('duplicate') ? 'الموعد محجوز — أعد المحاولة' : error.message, 'err'); return false; }
    return true;
  };
  const assignOne = async (app) => { setBusy(true); if (await assign(app)) toast(`تم تحديد موعد ${app.full_name}`, 'ok'); await load(); setBusy(false); };
  const auto = async () => {
    if (dirty) return toast('احفظ الإعدادات أولاً', 'err');
    setBusy(true); let n = 0; const free = [...future];
    for (const app of unassigned) { const s = free.shift(); if (!s) break; if (await assign(app, s)) n++; }
    await load(); setBusy(false);
    toast(n ? `تم توزيع ${n} مواعيد` : 'لا توجد مواعيد متاحة كافية', n ? 'ok' : 'err');
  };
  const move = async (iv, starts) => { const s = slots.find((x) => x.starts_at === starts); if (!s) return; const { error } = await sb.from('interviews').update({ starts_at: s.starts_at, ends_at: s.ends_at }).eq('id', iv.id); if (error) return toast(error.message, 'err'); toast('تم تغيير الموعد', 'ok'); load(); };
  const cancel = async (iv) => { if (!confirm('إلغاء الموعد؟')) return; await sb.from('interviews').delete().eq('id', iv.id); await sb.from('applications').update({ status: 'passed' }).eq('id', iv.application_id).eq('status', 'interview'); load(); };
  const markDone = async (iv, st) => { await sb.from('interviews').update({ status: st }).eq('id', iv.id); if (st === 'done') await sb.from('applications').update({ status: 'interviewed' }).eq('id', iv.application_id); toast('تم التحديث', 'ok'); load(); };
  const copy = (t) => { navigator.clipboard?.writeText(bookingLink(t)); toast('تم نسخ رابط الحجز', 'ok'); };
  const Step = ({ label, value, onInc, onDec }) => <div className="field"><span className="label">{label}</span><div className="stepper"><button type="button" disabled={!manage} aria-label={`زيادة ${label}`} onClick={onInc}>+</button><span>{value}</span><button type="button" disabled={!manage} aria-label={`إنقاص ${label}`} onClick={onDec}>−</button></div></div>;

  return (
    <>
      <div className="page-head"><div><h1>ترتيب مواعيد المقابلات</h1><p>حدّد الفترة ووقت الدوام ومدة المقابلة والبريك — والنظام يولّد المواعيد وينشئ رابط القاعة لكل مقابلة</p></div><Link to="/admin/messages" className="btn btn-outline"><Icon name="wa" />إرسال الدعوات</Link></div>
      <div className="row wrap" style={{ gap: 8 }}>{jobs.map((j) => <button key={j.id} className={`chip ${j.id === jobId ? 'on' : ''}`} onClick={() => setSp({ job: j.id })}><span className="sw" style={{ background: j.color }} />{j.title}</button>)}</div>
      {!ss ? <Spinner /> : <>
        <div className="grid5" style={{ alignItems: 'start' }}>
          <div className="card stack" style={{ gridColumn: 'span 2', gap: 16 }}>
            <div className="row between"><b>إعدادات المواعيد</b>{!manage && <span className="pill p-blue">عرض فقط</span>}</div>
            <div className="field"><span className="label">طريقة الحجز</span><div className="seg">{[['committee', 'توزيع من اللجنة'], ['self', 'المرشح يختار برابط الحجز']].map(([k, l]) => <button key={k} disabled={!manage} className={ss.mode === k ? 'on' : ''} onClick={() => upd({ mode: k })}>{l}</button>)}</div>
              <span className="hint">{ss.mode === 'self' ? 'يصل المرشح رابط حجز في رسالة الدعوة، يختار منه موعداً من المواعيد المتاحة فقط.' : 'اللجنة توزّع المواعيد حسب ترتيب المرشحين، ثم تُرسل الدعوة بزر واتساب.'}</span></div>
            <div className="grid2"><label className="field"><span className="label">من تاريخ</span><input className="input ltr" type="date" disabled={!manage} value={ss.date_from || ''} onChange={(e) => upd({ date_from: e.target.value })} /></label><label className="field"><span className="label">إلى تاريخ</span><input className="input ltr" type="date" disabled={!manage} value={ss.date_to || ''} onChange={(e) => upd({ date_to: e.target.value })} /></label></div>
            <div className="field"><span className="label">أيام المقابلات</span><div className="row wrap" style={{ gap: 6 }}>{DAYS.map((n, k) => <button key={k} disabled={!manage} className={`chip ${(ss.days || []).includes(k) ? 'on' : ''}`} style={{ minHeight: 36, padding: '0 12px' }} onClick={() => upd({ days: (ss.days || []).includes(k) ? ss.days.filter((x) => x !== k) : [...(ss.days || []), k].sort() })}>{n}</button>)}</div></div>
            <div className="grid2">
              <Step label="بداية المقابلات" value={minToTime(ss.start_min)} onInc={() => upd({ start_min: clamp(ss.start_min + 30, 300, ss.end_min - 30) })} onDec={() => upd({ start_min: clamp(ss.start_min - 30, 300, ss.end_min - 30) })} />
              <Step label="نهاية المقابلات" value={minToTime(ss.end_min)} onInc={() => upd({ end_min: clamp(ss.end_min + 30, ss.start_min + 30, 1410) })} onDec={() => upd({ end_min: clamp(ss.end_min - 30, ss.start_min + 30, 1410) })} />
              <Step label="مدة المقابلة" value={`${ss.duration_min} د`} onInc={() => upd({ duration_min: clamp(ss.duration_min + 5, 10, 180) })} onDec={() => upd({ duration_min: clamp(ss.duration_min - 5, 10, 180) })} />
              <Step label="البريك بين المقابلات" value={`${ss.break_min} د`} onInc={() => upd({ break_min: clamp(ss.break_min + 5, 0, 120) })} onDec={() => upd({ break_min: clamp(ss.break_min - 5, 0, 120) })} />
            </div>
            <div className="row between small"><span>استثناء وقت صلاة الظهر ({minToTime(ss.prayer_start)} – {minToTime(ss.prayer_end)})</span><Toggle label="استثناء الصلاة" on={ss.exclude_prayer} onChange={(v) => manage && upd({ exclude_prayer: v })} /></div>
            <div className="row" style={{ padding: 12, borderRadius: 12, background: '#F8F6F2' }}><Icon name="video" /><span className="small grow">{MEET[meet]}</span><Link to="/admin/settings" className="xs">تغيير</Link></div>
            {manage && <button className="btn btn-dark" disabled={!dirty} onClick={save}>{dirty ? 'حفظ الإعدادات' : 'الإعدادات محفوظة'}</button>}
          </div>

          <div className="stack" style={{ gridColumn: 'span 3', gap: 16 }}>
            <div className="grid3" style={{ gap: 12 }}>
              <div className="card kpi" style={{ background: 'var(--dark)', color: '#fff', borderColor: 'var(--dark)' }}><span className="l" style={{ color: '#B9BCC1' }}>مواعيد في اليوم</span><span className="v" style={{ color: 'var(--gold)' }}>{perDay}</span></div>
              <div className="card kpi"><span className="l">السعة ({dates.length} أيام)</span><span className="v">{slots.length}</span><span className="xs muted">متاح {future.length}</span></div>
              <div className="card kpi"><span className="l">بانتظار موعد</span><span className="v">{unassigned.length}</span><span className="xs" style={{ color: future.length >= unassigned.length ? 'var(--green-ink)' : 'var(--red-ink)', fontWeight: 600 }}>{future.length >= unassigned.length ? 'السعة كافية' : 'السعة غير كافية'}</span></div>
            </div>
            <div className="card stack">
              <div className="row between wrap"><b>مواعيد اليوم</b><select className="select" style={{ width: 230, minHeight: 38 }} value={activeDay || ''} onChange={(e) => setDay(e.target.value)} aria-label="اليوم">{dates.map((x) => <option key={x} value={x}>{fmtDay(`${x}T12:00:00+03:00`)}</option>)}</select></div>
              {!dates.length ? <div className="empty">حدد فترة المواعيد وأيام المقابلات للبدء</div> :
                <div className="grid4" style={{ gap: 8 }}>{slots.filter((x) => x.date === activeDay).map((x) => { const iv = taken.get(x.starts_at); const a = iv && appsById[iv.application_id]; return <div key={x.starts_at} className={`slot ${iv ? 'taken' : ''}`}><b>{fmtTime(x.starts_at)}</b><span>{a ? a.full_name : iv ? 'محجوز' : 'متاح'}</span></div>; })}</div>}
              {ss.exclude_prayer && dates.length > 0 && <span className="pill p-amber" style={{ alignSelf: 'flex-start' }}>{minToTime(ss.prayer_start)} – {minToTime(ss.prayer_end)} مستثناة لصلاة الظهر</span>}
              {manage && ss.mode === 'committee' && <button className="btn btn-accent btn-lg" disabled={busy || !unassigned.length} onClick={auto}>{busy ? 'جارٍ التوزيع…' : `توزيع المواعيد تلقائياً حسب الترتيب (${unassigned.length})`}</button>}
            </div>
          </div>
        </div>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div className="card flat">
            <div className="card-head" style={{ background: 'var(--green-bg)' }}><b style={{ color: 'var(--green-ink)' }}>لديهم موعد ({assigned.length})</b></div>
            {assigned.map(({ iv, app }) => <div key={iv.id} className="stack" style={{ gap: 8, padding: '12px 18px', borderTop: '1px solid var(--line2)' }}>
              <div className="row"><span className="avatar">{initial(app.full_name)}</span><div className="stack grow" style={{ gap: 0 }}><Link to={`/admin/candidates/${app.id}`} className="small" style={{ fontWeight: 700, color: 'var(--ink)' }}>{app.full_name}</Link><span className="xs muted">{fmtDateTime(iv.starts_at)}</span></div>
                <span className={`pill ${iv.status === 'done' ? 'p-dark' : iv.status === 'no_show' ? 'p-red' : iv.room_url ? 'p-green' : 'p-amber'}`}>{iv.status === 'done' ? 'تمت' : iv.status === 'no_show' ? 'لم يحضر' : iv.room_url ? 'رابط القاعة جاهز' : 'بدون رابط'}</span></div>
              {manage && iv.status === 'scheduled' && <div className="row wrap" style={{ gap: 6 }}>
                <select className="select" style={{ width: 200, minHeight: 34, fontSize: 12 }} value="" onChange={(e) => e.target.value && move(iv, e.target.value)} aria-label="تغيير الموعد"><option value="">تغيير الموعد…</option>{future.slice(0, 80).map((x) => <option key={x.starts_at} value={x.starts_at}>{fmtDateTime(x.starts_at)}</option>)}</select>
                <button className="btn btn-ghost btn-sm" onClick={() => markDone(iv, 'done')}>تمت</button><button className="btn btn-ghost btn-sm" onClick={() => markDone(iv, 'no_show')}>لم يحضر</button><button className="btn btn-danger btn-sm" onClick={() => cancel(iv)}>إلغاء</button>
                {iv.room_url && <a className="btn btn-ghost btn-sm" href={iv.room_url} target="_blank" rel="noreferrer"><Icon name="video" size={15} />القاعة</a>}</div>}
            </div>)}
            {!assigned.length && <div className="empty">لا توجد مواعيد بعد</div>}
          </div>
          <div className="card flat">
            <div className="card-head" style={{ background: 'var(--amber-bg)' }}><b style={{ color: 'var(--amber-ink)' }}>بدون موعد ({unassigned.length})</b><span className="xs" style={{ color: 'var(--amber-ink)' }}>مرتّبون حسب الدرجة النهائية</span></div>
            {unassigned.map((a) => <div key={a.id} className="row wrap" style={{ padding: '10px 18px', borderTop: '1px solid var(--line2)' }}>
              <span className="mono xs muted" style={{ width: 26 }}>#{a.rank}</span>
              <div className="stack grow" style={{ gap: 0 }}><Link to={`/admin/candidates/${a.id}`} className="small" style={{ fontWeight: 700, color: 'var(--ink)' }}>{a.full_name}</Link><span className="xs muted">اختبار {a.test_score}% · نهائية {a.final ?? '—'}</span></div>
              {ss.mode === 'self' ? <button className="btn btn-ghost btn-sm" onClick={() => copy(a.token)}><Icon name="link" size={15} />نسخ رابط الحجز</button> : manage && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => assignOne(a)}>تعيين أقرب موعد</button>}
            </div>)}
            {!unassigned.length && <div className="empty">كل المؤهلين لديهم مواعيد</div>}
          </div>
        </div>
      </>}
    </>
  );
}
