import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ago, fmtTime, Icon, initial, Pill, riyadhDate, sb, Spinner, useInterval } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

export default function Overview() {
  const { me, visibleDepts, isAdmin } = useAdmin();
  const nav = useNavigate();
  const [range, setRange] = useState(30);
  const [d, setD] = useState(null);
  const load = async () => {
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [apps, jobs, ivs] = await Promise.all([
      sb.from('applications').select('id,job_id,full_name,status,test_score,cv_match,created_at,submitted_at,ai_status').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
      sb.from('jobs').select('id,title,code,color,status,department_id'),
      sb.from('interviews').select('id,starts_at,status,room_url,application_id,applications(full_name,job_id)').gte('starts_at', new Date(Date.now() - 3 * 3600000).toISOString()).order('starts_at').limit(50),
    ]);
    setD({ apps: apps.data || [], jobs: jobs.data || [], ivs: ivs.data || [] });
  };
  useEffect(() => {
    load();
    const ch = sb.channel('overview').on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);
  useInterval(load, 60000);
  const stats = useMemo(() => {
    if (!d) return null;
    const from = Date.now() - range * 86400000;
    const prevFrom = from - range * 86400000;
    const cur = d.apps.filter((a) => new Date(a.created_at).getTime() >= from);
    const prev = d.apps.filter((a) => { const t = new Date(a.created_at).getTime(); return t >= prevFrom && t < from; });
    const done = cur.filter((a) => a.submitted_at);
    const passed = cur.filter((a) => ['passed', 'interview', 'interviewed', 'offer', 'hired'].includes(a.status));
    const interview = cur.filter((a) => ['interview', 'interviewed', 'offer', 'hired'].includes(a.status));
    const offers = cur.filter((a) => ['offer', 'hired'].includes(a.status));
    const avg = done.length ? Math.round(done.reduce((s, a) => s + Number(a.test_score || 0), 0) / done.length) : 0;
    const days = [];
    for (let k = 13; k >= 0; k--) { const day = riyadhDate(Date.now() - k * 86400000); days.push({ day, n: d.apps.filter((a) => riyadhDate(a.created_at) === day).length }); }
    const hist = Array.from({ length: 10 }, (_, k) => ({ k, n: done.filter((a) => Math.min(9, Math.floor(Number(a.test_score || 0) / 10)) === k).length }));
    const delta = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : a ? 'جديد' : '—');
    return { cur, done, passed, interview, offers, avg, days, hist, delta: delta(cur.length, prev.length) };
  }, [d, range]);
  if (!d || !stats) return <Spinner />;
  const jobsById = Object.fromEntries(d.jobs.map((j) => [j.id, j]));
  const maxDay = Math.max(1, ...stats.days.map((x) => x.n));
  const maxHist = Math.max(1, ...stats.hist.map((x) => x.n));
  const funnel = [['تقديم', stats.cur.length], ['أكملوا الاختبار', stats.done.length], ['اجتازوا', stats.passed.length], ['مقابلة', stats.interview.length], ['عرض وظيفي', stats.offers.length]];
  const today = riyadhDate(Date.now());
  const todays = d.ivs.filter((i) => riyadhDate(i.starts_at) === today && i.status !== 'cancelled');
  const due = d.ivs.filter((i) => { const t = new Date(i.starts_at).getTime() - Date.now(); return t < 15 * 60000 && t > -30 * 60000 && i.status === 'scheduled'; });
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date()));
  const perJob = d.jobs.map((j) => { const list = d.apps.filter((a) => a.job_id === j.id); return { j, total: list.length, passed: list.filter((a) => ['passed', 'interview', 'interviewed', 'offer', 'hired'].includes(a.status)).length, pending: list.filter((a) => a.status === 'passed').length }; }).filter((x) => x.j.status !== 'draft' || x.total);
  return (
    <>
      <div className="page-head">
        <div><h1>{hour < 12 ? 'صباح الخير' : 'مساء الخير'}، {me.full_name?.split(' ')[0]}</h1><p>{isAdmin ? 'تشاهد بيانات كل الأقسام' : `تشاهد بيانات: ${visibleDepts.map((x) => x.name).join('، ') || '—'}`} · تحديث مباشر</p></div>
        <div className="seg">{[[7, '7 أيام'], [30, '30 يوماً'], [90, '90 يوماً']].map(([v, l]) => <button key={v} className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>)}</div>
      </div>

      {due.map((i) => (
        <div key={i.id} className="alert-dark">
          <span style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" color="#fff" size={24} /></span>
          <div className="stack grow" style={{ gap: 4 }}><span className="xs" style={{ color: 'var(--gold)', fontWeight: 600 }}>حان موعد المقابلة · {fmtTime(i.starts_at)}</span><b className="display" style={{ fontSize: 18 }}>{i.applications?.full_name} — {jobsById[i.applications?.job_id]?.title}</b></div>
          <Link to={`/admin/messages?room=${i.id}`} className="btn btn-gold"><Icon name="wa" />إرسال رابط القاعة</Link>
        </div>
      ))}

      <div className="grid4">
        {[['المتقدمون', stats.cur.length, `${stats.delta} عن الفترة السابقة`], ['اجتازوا الاختبار', stats.passed.length, stats.done.length ? `${Math.round((stats.passed.length / stats.done.length) * 100)}% من المختبَرين` : '—'], ['مقابلات قادمة', d.ivs.filter((i) => i.status === 'scheduled' && new Date(i.starts_at) > new Date()).length, `${todays.length} اليوم`], ['متوسط درجة الاختبار', `${stats.avg}%`, `${stats.done.length} اختبار مكتمل`]].map(([l, v, sub]) => (
          <div key={l} className="card kpi"><span className="l">{l}</span><span className="v">{v}</span><span className="xs muted">{sub}</span></div>
        ))}
      </div>

      <div className="grid5" style={{ alignItems: 'stretch' }}>
        <div className="card stack" style={{ gridColumn: 'span 3' }}>
          <div className="row between"><b>الطلبات اليومية</b><span className="xs muted">آخر 14 يوماً</span></div>
          <div className="bars" role="img" aria-label="الطلبات اليومية">{stats.days.map((x, k) => <div key={x.day} className="b"><span className="tip">{x.day}: {x.n}</span><i style={{ height: `${(x.n / maxDay) * 160}px`, background: k === 13 ? 'var(--saffron)' : undefined, minHeight: x.n ? 4 : 0 }} /></div>)}</div>
          <div className="row between xs muted mono"><span>{stats.days[0].day}</span><span>اليوم</span></div>
        </div>
        <div className="card stack" style={{ gridColumn: 'span 2' }}>
          <b>مسار التوظيف</b>
          {funnel.map(([l, v]) => <div key={l} className="stack" style={{ gap: 6 }}><div className="row between small"><span>{l}</span><span className="mono" style={{ fontWeight: 600 }}>{v} <span className="muted" style={{ fontWeight: 500 }}>· {stats.cur.length ? Math.round((v / stats.cur.length) * 100) : 0}%</span></span></div><div className="bar" style={{ height: 10 }}><span style={{ width: `${stats.cur.length ? (v / stats.cur.length) * 100 : 0}%` }} /></div></div>)}
        </div>
      </div>

      <div className="grid5" style={{ alignItems: 'start' }}>
        <div className="card flat" style={{ gridColumn: 'span 3' }}>
          <div className="card-head"><span className="card-title">أحدث المتقدمين</span><Link to="/admin/candidates" className="small" style={{ fontWeight: 600 }}>عرض الكل</Link></div>
          {!stats.cur.length ? <div className="empty">لا توجد طلبات في هذه الفترة بعد</div> :
            <div className="table-wrap"><table className="table"><thead><tr><th>المرشح</th><th>الوظيفة</th><th>الدرجة</th><th>الحالة</th></tr></thead><tbody>
              {stats.cur.slice(0, 8).map((a) => <tr key={a.id} className="click" onClick={() => nav(`/admin/candidates/${a.id}`)}>
                <td><div className="row"><span className="avatar">{initial(a.full_name)}</span><div className="stack" style={{ gap: 0 }}><b className="small">{a.full_name}</b><span className="xs muted">{ago(a.created_at)}</span></div></div></td>
                <td className="small">{jobsById[a.job_id]?.title}</td>
                <td>{a.test_score != null ? <div className="row" style={{ gap: 8 }}><span className="mono small" style={{ width: 44, fontWeight: 600 }}>{a.test_score}%</span><div className="bar" style={{ width: 80, height: 6 }}><span style={{ width: `${a.test_score}%`, background: a.status === 'failed' ? '#B8B2A8' : 'var(--green)' }} /></div></div> : <span className="xs muted">—</span>}</td>
                <td><Pill status={a.status} /></td></tr>)}
            </tbody></table></div>}
        </div>
        <div className="stack" style={{ gridColumn: 'span 2', gap: 16 }}>
          <div className="card stack">
            <div className="row between"><b>توزيع درجات الاختبار</b><span className="xs muted">{stats.done.length} اختباراً</span></div>
            <div className="bars" style={{ height: 120, gap: 4 }}>{stats.hist.map((x) => <div key={x.k} className="b"><span className="tip">{x.k * 10}–{x.k * 10 + 10}%: {x.n}</span><i style={{ maxWidth: 'none', height: `${(x.n / maxHist) * 110}px`, background: x.k >= 6 ? 'var(--green)' : '#CFC8BC', minHeight: x.n ? 3 : 0 }} /></div>)}</div>
            <div className="row between xs muted mono"><span>0%</span><span style={{ color: 'var(--ink)', fontWeight: 600 }}>حد الاجتياز 60%</span><span>100%</span></div>
            <div className="row xs" style={{ gap: 16, color: 'var(--ink2)' }}><span className="row" style={{ gap: 6 }}><span className="sw" style={{ background: 'var(--green)' }} />اجتاز</span><span className="row" style={{ gap: 6 }}><span className="sw" style={{ background: '#CFC8BC' }} />لم يجتز</span></div>
          </div>
          <div className="card stack" style={{ background: 'var(--dark)', color: '#fff', borderColor: 'var(--dark)' }}>
            <div className="row between"><b>مقابلات اليوم</b><Link to="/admin/schedule" className="small" style={{ color: 'var(--gold)' }}>الجدول</Link></div>
            {!todays.length ? <span className="small" style={{ color: '#B9BCC1' }}>لا توجد مقابلات اليوم</span> : todays.map((i) => <div key={i.id} className="row" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--dark2)' }}><span className="mono" style={{ color: 'var(--gold)', width: 50 }}>{fmtTime(i.starts_at)}</span><span className="stack grow small" style={{ gap: 0 }}><b>{i.applications?.full_name}</b><span className="xs" style={{ color: '#9DA1A7' }}>{jobsById[i.applications?.job_id]?.title}</span></span></div>)}
          </div>
        </div>
      </div>

      <div className="card flat">
        <div className="card-head"><span className="card-title">الوظائف</span><Link to="/admin/jobs" className="small" style={{ fontWeight: 600 }}>إدارة الوظائف</Link></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>الوظيفة</th><th>المتقدمون</th><th>اجتازوا</th><th>بانتظار موعد</th><th></th></tr></thead><tbody>
          {perJob.map(({ j, total, passed, pending }) => <tr key={j.id}><td><div className="row"><span className="sw" style={{ background: j.color, width: 12, height: 12 }} /><b className="small">{j.title}</b><span className="xs muted mono">{j.code}</span></div></td><td className="mono">{total}</td><td className="mono">{passed}</td><td className="mono">{pending}</td><td><Link to={`/admin/ranking?job=${j.id}`} className="small">الترتيب</Link></td></tr>)}
        </tbody></table></div>
      </div>
    </>
  );
}
