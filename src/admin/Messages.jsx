import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ago, bookingLink, displayPhone, fillTemplate, fmtDateTime, fmtTime, Icon, initial, sb, Spinner, useInterval, useToast, waLink } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

const VARS = ['{الاسم}', '{الوظيفة}', '{الموعد}', '{رابط_الحجز}', '{رابط_القاعة}', '{الشركة}'];
export default function Messages() {
  const { me, isAdmin, canAccess, company } = useAdmin();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [d, setD] = useState(null);
  const [cur, setCur] = useState('invite');
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('queue');
  const load = async () => {
    const [t, iv, apps, logs, jobs, ss, st] = await Promise.all([
      sb.from('wa_templates').select('*').order('sort'),
      sb.from('interviews').select('*').neq('status', 'cancelled').order('starts_at'),
      sb.from('applications').select('id,full_name,phone,token,status,job_id').in('status', ['passed', 'interview', 'interviewed', 'offer', 'hired']),
      sb.from('wa_logs').select('*, profiles(full_name)').order('sent_at', { ascending: false }).limit(500),
      sb.from('jobs').select('id,title,department_id'),
      sb.from('schedule_settings').select('job_id,mode'),
      sb.from('app_settings').select('wa_mode').eq('id', 1).maybeSingle(),
    ]);
    setD({ tpl: t.data || [], iv: iv.data || [], apps: apps.data || [], logs: logs.data || [], jobs: Object.fromEntries((jobs.data || []).filter((j) => canAccess(j.department_id)).map((j) => [j.id, j])), modes: Object.fromEntries((ss.data || []).map((s) => [s.job_id, s.mode])), waMode: st.data?.wa_mode || 'wa' });
  };
  useEffect(() => { load(); }, []);
  useInterval(load, 60000);
  const tasks = useMemo(() => {
    if (!d) return [];
    const now = Date.now();
    const sent = (appId, key) => d.logs.some((l) => l.application_id === appId && l.template_key === key);
    const appsById = Object.fromEntries(d.apps.map((a) => [a.id, a]));
    const out = [];
    for (const iv of d.iv) {
      const a = appsById[iv.application_id]; if (!a || !d.jobs[a.job_id]) continue;
      const t = new Date(iv.starts_at).getTime();
      if (iv.status === 'scheduled' && t - now < 15 * 60000 && t - now > -40 * 60000) out.push({ key: 'room', a, iv, due: iv.starts_at, urgent: true, done: sent(a.id, 'room') });
      if (iv.status === 'scheduled' && t > now) out.push({ key: 'invite', a, iv, due: iv.starts_at, done: sent(a.id, 'invite') });
      if (iv.status === 'scheduled' && t > now && t - now < 26 * 3600000 && t - now > 60 * 60000 && sent(a.id, 'invite')) out.push({ key: 'reminder', a, iv, due: iv.starts_at, done: sent(a.id, 'reminder') });
      if (iv.status === 'done') out.push({ key: 'thanks', a, iv, due: iv.starts_at, done: sent(a.id, 'thanks') });
    }
    const withIv = new Set(d.iv.map((i) => i.application_id));
    for (const a of d.apps) if (d.jobs[a.job_id] && a.status === 'passed' && !withIv.has(a.id) && d.modes[a.job_id] === 'self') out.push({ key: 'invite', a, iv: null, due: null, done: sent(a.id, 'invite'), booking: true });
    return out.sort((x, y) => (x.done - y.done) || (y.urgent ? 1 : 0) - (x.urgent ? 1 : 0) || String(x.due || '').localeCompare(String(y.due || '')));
  }, [d]);
  if (!d) return <Spinner />;
  const tplByKey = Object.fromEntries(d.tpl.map((t) => [t.key, t]));
  const textFor = (key, a, iv) => fillTemplate(tplByKey[key]?.body, { name: a.full_name.split(' ')[0], job: d.jobs[a.job_id]?.title, when: iv ? fmtDateTime(iv.starts_at) : '', booking: bookingLink(a.token), room: iv?.room_url, company });
  const open = async (task) => {
    const url = waLink(task.a.phone, textFor(task.key, task.a, task.iv), d.waMode);
    window.open(url, '_blank', 'noopener');
    const { error } = await sb.from('wa_logs').insert({ application_id: task.a.id, template_key: task.key, sent_by: me.id });
    if (error) toast(error.message, 'err'); else load();
  };
  const pending = tasks.filter((t) => !t.done);
  const urgent = tasks.filter((t) => t.urgent && !t.done);
  const t = tplByKey[cur];
  const body = draft ?? t?.body ?? '';
  const sample = fillTemplate(body, { name: 'محمد', job: 'مندوب مبيعات', when: 'الأحد 4 أكتوبر · 10:40', booking: bookingLink('…'), room: 'https://meet.jit.si/interview-…', company });
  const saveTpl = async () => { const { error } = await sb.from('wa_templates').update({ body }).eq('key', cur); if (error) return toast(error.message, 'err'); toast('تم حفظ القالب', 'ok'); setDraft(null); load(); };
  const LABEL = { invite: 'دعوة المقابلة', reminder: 'تذكير', room: 'رابط القاعة', thanks: 'شكر ومتابعة', confirm: 'تأكيد الموعد' };
  return (
    <>
      <div className="page-head"><div><h1>رسائل واتساب</h1><p>رابط هجين: الزر يفتح واتساب الخاص بك والرسالة مكتوبة جاهزة من القالب — تضغط إرسال فقط</p></div><Link to="/admin/schedule" className="btn btn-outline"><Icon name="calendar" />ترتيب المواعيد</Link></div>
      {urgent.map((task) => <div key={task.iv.id} className="alert-dark" style={sp.get('room') === task.iv.id ? { outline: '3px solid var(--gold)' } : undefined}>
        <span style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clock" color="#fff" size={24} /></span>
        <div className="stack grow" style={{ gap: 4 }}><span className="xs" style={{ color: 'var(--gold)', fontWeight: 600 }}>حان موعد المقابلة · {fmtTime(task.iv.starts_at)}</span><b className="display" style={{ fontSize: 19 }}>{task.a.full_name} — {d.jobs[task.a.job_id]?.title}</b><span className="small" style={{ color: '#CFD2D6' }}>رابط القاعة: <span dir="ltr" className="mono" style={{ color: '#fff' }}>{task.iv.room_url || 'غير متوفر'}</span></span></div>
        <button className="btn btn-gold btn-lg" onClick={() => open(task)}><Icon name="wa" />فتح واتساب وإرسال رابط القاعة</button>
      </div>)}
      <div className="tabs">{[['queue', `طابور الإرسال (${pending.length})`], ['templates', 'القوالب'], ['log', 'السجل']].map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'queue' && <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="card flat" style={{ gridColumn: 'span 2' }}>
          <div className="table-wrap"><table className="table"><thead><tr><th>المرشح</th><th>الرسالة</th><th>الموعد</th><th></th><th>الحالة</th></tr></thead><tbody>
            {tasks.map((task, k) => <tr key={k}>
              <td><div className="row"><span className="avatar">{initial(task.a.full_name)}</span><div className="stack" style={{ gap: 0 }}><Link to={`/admin/candidates/${task.a.id}`} className="small" style={{ fontWeight: 700, color: 'var(--ink)' }}>{task.a.full_name}</Link><span className="xs muted mono" dir="ltr" style={{ textAlign: 'right' }}>{displayPhone(task.a.phone)}</span></div></div></td>
              <td className="small">{LABEL[task.key]}{task.booking && <span className="xs muted"> (برابط حجز)</span>}</td>
              <td className="xs">{task.iv ? fmtDateTime(task.iv.starts_at) : 'يختاره المرشح'}</td>
              <td><button className="btn btn-wa btn-sm" onClick={() => open(task)}><Icon name="wa" size={15} />فتح واتساب</button></td>
              <td>{task.done ? <span className="pill p-green">أُرسلت ✓</span> : <span className={`pill ${task.urgent ? 'p-red' : 'p-amber'}`}>{task.urgent ? 'الآن' : 'لم تُرسل'}</span>}</td>
            </tr>)}
            {!tasks.length && <tr><td colSpan={5} className="empty">لا توجد رسائل مستحقة — حدّد مواعيد المقابلات أولاً</td></tr>}
          </tbody></table></div>
        </div>
        <div className="card stack"><b>كيف يعمل الرابط الهجين</b>
          {['تضغط «فتح واتساب» بجانب المرشح.', 'النظام يعبّي القالب ببياناته ويبني رابط wa.me برقمه.', 'يفتح واتساب الخاص بك على محادثته والرسالة مكتوبة.', 'تضغط إرسال، ويتسجّل في اللوحة مع الوقت واسم المُرسِل.'].map((x, k) => <div key={k} className="row small" style={{ alignItems: 'flex-start' }}><span className="avatar mono" style={{ width: 26, height: 26, borderRadius: 8 }}>{k + 1}</span><span style={{ lineHeight: 1.8 }}>{x}</span></div>)}
          <div className="notice green xs">بدون اشتراك WhatsApp Business API — الرسالة تخرج من رقمك أنت.</div>
        </div>
      </div>}

      {tab === 'templates' && <div className="grid3" style={{ alignItems: 'start' }}>
        <div className="card stack" style={{ gridColumn: 'span 2' }}>
          <div className="row wrap" style={{ gap: 6 }}>{d.tpl.map((x) => <button key={x.key} className={`chip ${cur === x.key ? 'on' : ''}`} onClick={() => { setCur(x.key); setDraft(null); }}>{x.title}</button>)}</div>
          <div className="row wrap" style={{ gap: 6 }}>{VARS.map((v) => <button key={v} disabled={!isAdmin} className="pill p-amber mono" style={{ border: 0, cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => setDraft(body + v)}>{v}</button>)}</div>
          <textarea className="textarea" style={{ minHeight: 220 }} value={body} disabled={!isAdmin} onChange={(e) => setDraft(e.target.value)} />
          {isAdmin ? <button className="btn btn-dark" disabled={draft === null} onClick={saveTpl}>حفظ القالب</button> : <span className="xs muted">تعديل القوالب لمدير النظام</span>}
        </div>
        <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
          <div className="phone"><div className="scr"><div className="top"><span className="avatar" style={{ background: '#A9C7BC' }}>م</span><span className="stack" style={{ gap: 0 }}><b className="small">محمد</b><span className="xs" dir="ltr" style={{ color: '#C9DCD5' }}>+966 5X XXX XXXX</span></span></div><div className="grow" /><div className="row" style={{ padding: 10, alignItems: 'flex-end' }}><div className="bubble grow">{sample}</div><span style={{ width: 38, height: 38, borderRadius: '50%', background: '#1F6B55', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="send" color="#fff" size={16} /></span></div></div></div>
          <span className="xs muted center">هكذا تفتح في واتساب المُرسِل — الرسالة جاهزة في خانة الكتابة</span>
        </div>
      </div>}

      {tab === 'log' && <div className="card flat"><div className="table-wrap"><table className="table"><thead><tr><th>المرشح</th><th>الرسالة</th><th>أرسلها</th><th>الوقت</th></tr></thead><tbody>
        {d.logs.map((l) => { const a = d.apps.find((x) => x.id === l.application_id); return <tr key={l.id}><td className="small">{a?.full_name || '—'}</td><td className="small">{tplByKey[l.template_key]?.title || l.template_key}</td><td className="small">{l.profiles?.full_name || '—'}</td><td className="xs">{fmtDateTime(l.sent_at)} · {ago(l.sent_at)}</td></tr>; })}
        {!d.logs.length && <tr><td colSpan={4} className="empty">لا توجد رسائل مرسلة بعد</td></tr>}
      </tbody></table></div></div>}
    </>
  );
}
