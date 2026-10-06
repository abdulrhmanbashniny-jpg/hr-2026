import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { callFn, Icon, initial, Modal, ROLES, sb, Spinner, Toggle, useToast } from '../lib.jsx';
import { useAdmin } from './Auth.jsx';

const genPw = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(10)); r.forEach((x) => { s += c[x % c.length]; }); return `Hr#${s}`; };

// ======================= المستخدمون والصلاحيات =======================
export function Users() {
  const { isAdmin, depts, me } = useAdmin();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newDept, setNewDept] = useState('');
  const [shown, setShown] = useState(null);
  const load = () => sb.from('profiles').select('*, profile_departments(department_id)').order('created_at').then(({ data }) => setUsers(data || []));
  useEffect(() => { load(); }, []);
  if (!isAdmin) return <Navigate to="/admin" replace />;
  if (!users) return <Spinner />;
  const deptName = Object.fromEntries(depts.map((d) => [d.id, d]));
  const save = async () => {
    setBusy(true);
    try {
      if (!edit.full_name?.trim()) throw new Error('اكتب اسم المستخدم');
      if (edit.role !== 'admin' && !edit.department_ids.length) throw new Error('اختر قسماً واحداً على الأقل — المستخدم لا يرى إلا أقسامه');
      if (edit.id) await callFn('staff', { action: 'update_user', id: edit.id, full_name: edit.full_name, role: edit.role, active: edit.active, department_ids: edit.department_ids });
      else { await callFn('staff', { action: 'create_user', email: edit.email, password: edit.password, full_name: edit.full_name, role: edit.role, department_ids: edit.department_ids }); setShown({ email: edit.email, password: edit.password }); }
      toast('تم الحفظ', 'ok'); setEdit(null); load();
    } catch (x) { toast(x.message, 'err'); }
    setBusy(false);
  };
  const reset = async (u) => { const pw = genPw(); try { await callFn('staff', { action: 'reset_password', id: u.id, password: pw }); setShown({ email: u.email, password: pw }); } catch (x) { toast(x.message, 'err'); } };
  const remove = async (u) => { if (!confirm(`حذف حساب ${u.full_name} نهائياً؟`)) return; try { await callFn('staff', { action: 'delete_user', id: u.id }); toast('تم الحذف', 'ok'); load(); } catch (x) { toast(x.message, 'err'); } };
  const toggleActive = async (u, v) => { try { await callFn('staff', { action: 'update_user', id: u.id, active: v }); load(); } catch (x) { toast(x.message, 'err'); } };
  const addDept = async () => { if (!newDept.trim()) return; const { error } = await sb.from('departments').insert({ name: newDept.trim(), sort: depts.length + 1 }); if (error) return toast(error.message, 'err'); toast('تمت إضافة القسم — أعد تحميل الصفحة', 'ok'); setNewDept(''); };
  return (
    <>
      <div className="page-head"><div><h1>المستخدمون والصلاحيات</h1><p>كل مستخدم يرى فقط وظائف ومرشحي أقسامه — الحماية مطبّقة داخل قاعدة البيانات نفسها</p></div>
        <button className="btn btn-dark" onClick={() => setEdit({ full_name: '', email: '', password: genPw(), role: 'evaluator', active: true, department_ids: [] })}><Icon name="plus" />مستخدم جديد</button></div>
      <div className="grid3">{Object.entries(ROLES).map(([k, l]) => <div key={k} className="card stack" style={{ gap: 6 }}><b>{l}</b><span className="small muted" style={{ lineHeight: 1.8 }}>{k === 'admin' ? 'كل الأقسام وكل الصلاحيات: المستخدمون، الإعدادات، القوالب، الحذف.' : k === 'manager' ? 'داخل أقسامه فقط: إدارة الوظائف والأسئلة، تغيير الحالات، ترتيب المواعيد، إعادة التحليل، والتقييم.' : 'داخل أقسامه فقط: الاطلاع على المرشحين، تقييمهم، وإرسال رسائل واتساب.'}</span></div>)}</div>
      <div className="card flat"><div className="table-wrap"><table className="table"><thead><tr><th>المستخدم</th><th>الصلاحية</th><th>الأقسام</th><th>مفعّل</th><th></th></tr></thead><tbody>
        {users.map((u) => <tr key={u.id}>
          <td><div className="row"><span className="avatar">{initial(u.full_name)}</span><div className="stack" style={{ gap: 0 }}><b className="small">{u.full_name}</b><span className="xs muted" dir="ltr" style={{ textAlign: 'right' }}>{u.email}</span></div></div></td>
          <td><span className={`pill ${u.role === 'admin' ? 'p-dark' : u.role === 'manager' ? 'p-blue' : 'p-gray'}`}>{ROLES[u.role]}</span></td>
          <td><div className="row wrap" style={{ gap: 4 }}>{u.role === 'admin' ? <span className="xs muted">كل الأقسام</span> : (u.profile_departments || []).map((p) => <span key={p.department_id} className="pill p-gray"><span className="sw" style={{ background: deptName[p.department_id]?.color }} />{deptName[p.department_id]?.name}</span>)}</div></td>
          <td><Toggle label="تفعيل" on={u.active} onChange={(v) => u.id !== me.id && toggleActive(u, v)} /></td>
          <td><div className="row" style={{ gap: 6 }}><button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...u, department_ids: (u.profile_departments || []).map((p) => p.department_id) })}><Icon name="edit" size={15} />تعديل</button><button className="btn btn-ghost btn-sm" onClick={() => reset(u)}>كلمة مرور جديدة</button>{u.id !== me.id && <button className="btn btn-danger icon-btn" aria-label="حذف" onClick={() => remove(u)}><Icon name="trash" size={16} /></button>}</div></td>
        </tr>)}
      </tbody></table></div></div>
      <div className="card stack"><b>الأقسام</b><div className="row wrap" style={{ gap: 6 }}>{depts.map((d) => <span key={d.id} className="pill p-gray"><span className="sw" style={{ background: d.color }} />{d.name}</span>)}</div>
        <div className="row"><input className="input" style={{ maxWidth: 280 }} placeholder="اسم قسم جديد" value={newDept} onChange={(e) => setNewDept(e.target.value)} /><button className="btn btn-ghost" onClick={addDept}>إضافة قسم</button></div></div>

      {edit && <Modal title={edit.id ? 'تعديل مستخدم' : 'مستخدم جديد'} onClose={() => setEdit(null)} footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>إلغاء</button><button className="btn btn-dark" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'حفظ'}</button></>}>
        <label className="field"><span className="label">الاسم الكامل</span><input className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></label>
        {!edit.id && <div className="grid2"><label className="field"><span className="label">البريد (اسم الدخول)</span><input className="input ltr" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></label><label className="field"><span className="label">كلمة المرور</span><div className="row" style={{ gap: 6 }}><input className="input ltr mono" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /><button type="button" className="btn btn-ghost icon-btn" aria-label="توليد" onClick={() => setEdit({ ...edit, password: genPw() })}><Icon name="refresh" size={16} /></button></div></label></div>}
        <div className="field"><span className="label">الصلاحية</span><div className="seg">{Object.entries(ROLES).map(([k, l]) => <button key={k} className={edit.role === k ? 'on' : ''} onClick={() => setEdit({ ...edit, role: k })}>{l}</button>)}</div></div>
        {edit.role !== 'admin' && <div className="field"><span className="label">الأقسام التي يراها</span><div className="row wrap" style={{ gap: 6 }}>{depts.map((d) => { const on = edit.department_ids.includes(d.id); return <button key={d.id} type="button" className={`chip ${on ? 'on' : ''}`} onClick={() => setEdit({ ...edit, department_ids: on ? edit.department_ids.filter((x) => x !== d.id) : [...edit.department_ids, d.id] })}><span className="sw" style={{ background: d.color }} />{d.name}</button>; })}</div></div>}
      </Modal>}
      {shown && <Modal title="بيانات الدخول" onClose={() => setShown(null)} footer={<button className="btn btn-dark" onClick={() => { navigator.clipboard?.writeText(`الرابط: ${window.location.origin}${window.location.pathname}#/admin\nالبريد: ${shown.email}\nكلمة المرور: ${shown.password}`); toast('تم النسخ', 'ok'); }}>نسخ</button>}>
        <div className="notice amber">احفظ كلمة المرور الآن — لن تظهر مرة أخرى. يستطيع المستخدم تغييرها من «حسابي».</div>
        <div className="code">{`${shown.email}\n${shown.password}`}</div>
      </Modal>}
    </>
  );
}

// ======================= الإعدادات والتكاملات =======================
const PRESETS = [
  { id: 'openai', name: 'OpenAI', style: 'openai', url: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic (Claude)', style: 'anthropic', url: 'https://api.anthropic.com/v1' },
  { id: 'gemini', name: 'Google Gemini', style: 'openai', url: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'deepseek', name: 'DeepSeek', style: 'openai', url: 'https://api.deepseek.com' },
  { id: 'mistral', name: 'Mistral', style: 'openai', url: 'https://api.mistral.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', style: 'openai', url: 'https://openrouter.ai/api/v1' },
  { id: 'groq', name: 'Groq', style: 'openai', url: 'https://api.groq.com/openai/v1' },
  { id: 'custom', name: 'مخصص (متوافق مع OpenAI)', style: 'openai', url: '' },
];
export function Settings() {
  const { isAdmin } = useAdmin();
  const toast = useToast();
  const [s, setS] = useState(null);
  const [hasKey, setHasKey] = useState(false);
  const [key, setKey] = useState('');
  const [test, setTest] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await sb.from('app_settings').select('*').eq('id', 1).single(); setS(data); const { data: hk } = await sb.rpc('has_ai_key'); setHasKey(!!hk); };
  useEffect(() => { load(); }, []);
  if (!isAdmin) return <Navigate to="/admin" replace />;
  if (!s) return <Spinner />;
  const set = (k, v) => setS({ ...s, [k]: v });
  // تطبيع رقم واتساب إلى الصيغة الدولية (يُبقي الأرقام غير السعودية كما هي)
  const normWa = (v) => {
    let d = String(v || '').replace(/[^\d]/g, '').replace(/^00/, '');
    if (d.startsWith('966')) return d;
    if (d.startsWith('0') && d.length === 10) return '966' + d.slice(1);
    if (d.startsWith('5') && d.length === 9) return '966' + d;
    return d;
  };
  const save = async () => {
    setBusy(true);
    const { id, updated_at, ...row } = s;
    const { error } = await sb.from('app_settings').update(row).eq('id', 1);
    if (!error && key.trim()) { const { error: e2 } = await sb.rpc('set_ai_key', { new_key: key.trim() }); if (e2) toast(e2.message, 'err'); else { setKey(''); setHasKey(true); } }
    setBusy(false);
    if (error) return toast(error.message, 'err');
    toast('تم حفظ الإعدادات', 'ok');
  };
  const runTest = async () => { setTest({ busy: true }); try { const r = await callFn('staff', { action: 'ai_test' }); setTest(r); } catch (x) { setTest({ ok: false, error: x.message }); } };
  const removeKey = async () => { if (!confirm('حذف مفتاح API؟ سيعمل التقييم المبدئي بدون ذكاء اصطناعي.')) return; await sb.rpc('set_ai_key', { new_key: '' }); setHasKey(false); };
  const enabled = hasKey && s.model_text;
  return (
    <>
      <div className="page-head"><div><h1>الإعدادات والتكاملات</h1><p>اربط أي نموذج ذكاء اصطناعي، والقاعات الافتراضية، وطريقة واتساب</p></div><button className="btn btn-dark" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'حفظ كل الإعدادات'}</button></div>

      <div className="card stack" style={{ gap: 16 }}>
        <div className="row between wrap"><div className="stack" style={{ gap: 2 }}><h2 style={{ fontSize: 19 }}>مزوّد الذكاء الاصطناعي</h2><span className="small muted">غير مرتبط بشركة معيّنة — اختر المزوّد أو أي خدمة متوافقة مع صيغة OpenAI</span></div>
          <span className={`pill ${enabled ? 'p-green' : 'p-amber'}`}>{enabled ? 'مفعّل' : 'غير مفعّل — يعمل التقييم المبدئي بالكلمات المفتاحية'}</span></div>
        <div className="row wrap" style={{ gap: 8 }}>{PRESETS.map((p) => <button key={p.id} className={`chip ${s.ai_provider === p.id ? 'on' : ''}`} onClick={() => setS({ ...s, ai_provider: p.id, ai_style: p.style, ai_base_url: p.url || s.ai_base_url })}>{p.name}</button>)}</div>
        <div className="grid3">
          <label className="field"><span className="label">عنوان الخدمة (Base URL)</span><input className="input ltr mono" value={s.ai_base_url} onChange={(e) => set('ai_base_url', e.target.value)} /></label>
          <label className="field"><span className="label">صيغة الواجهة</span><select className="select" value={s.ai_style} onChange={(e) => set('ai_style', e.target.value)}><option value="openai">متوافقة مع OpenAI (chat/completions)</option><option value="anthropic">Anthropic (messages)</option></select></label>
          <label className="field"><span className="label">مفتاح API {hasKey && <span className="pill p-green">محفوظ</span>}</span><input className="input ltr mono" type="password" autoComplete="off" placeholder={hasKey ? '•••••••• (اتركه فارغاً للإبقاء)' : 'الصق المفتاح هنا'} value={key} onChange={(e) => setKey(e.target.value)} /></label>
        </div>
        <span className="xs" style={{ color: 'var(--green-ink)' }}>المفتاح يُحفظ في مخطط محمي في قاعدة البيانات ولا يُقرأ إلا من دوال الخادم — لا يصل للمتصفح إطلاقاً.</span>
        <div className="grid4">{[['model_text', 'تصحيح الإجابات النصية (مطلوب)'], ['model_cv', 'تحليل السيرة الذاتية'], ['model_vision', 'تقييم صور الأعمال (يدعم الصور)'], ['model_generate', 'توليد الأسئلة']].map(([k, l]) => <label key={k} className="field"><span className="label">{l}</span><input className="input ltr mono" placeholder={k === 'model_text' ? 'اسم النموذج' : 'فارغ = نفس نموذج النصوص'} value={s[k] || ''} onChange={(e) => set(k, e.target.value)} /></label>)}</div>
        <div className="row wrap between">
          <span className="row small" style={{ gap: 8 }}><Toggle label="إخفاء الهوية" on={s.anonymize} onChange={(v) => set('anonymize', v)} />إخفاء الاسم والجوال والبريد من السيرة قبل إرسالها للنموذج</span>
          <div className="row">{hasKey && <button className="btn btn-danger btn-sm" onClick={removeKey}>حذف المفتاح</button>}<button className="btn btn-outline" onClick={runTest} disabled={test?.busy}>{test?.busy ? 'جارٍ الاختبار…' : 'اختبار الاتصال'}</button></div>
        </div>
        {test && !test.busy && <div className={`notice ${test.ok ? 'green' : 'red'}`}>{test.ok ? `متصل ✓ — زمن الاستجابة ${test.latency}ms` : `فشل الاتصال: ${test.error}`} {!test.ok && '(تأكد من حفظ الإعدادات قبل الاختبار)'}</div>}
      </div>

      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card stack">
          <h2 style={{ fontSize: 19 }}>القاعة الافتراضية</h2>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>{[['jitsi', 'رابط تلقائي (Jitsi)'], ['static', 'رابط ثابت'], ['none', 'بدون']].map(([k, l]) => <button key={k} className={s.meeting_provider === k ? 'on' : ''} onClick={() => set('meeting_provider', k)}>{l}</button>)}</div>
          {s.meeting_provider === 'jitsi' && <><label className="field"><span className="label">بادئة اسم القاعة (إنجليزي)</span><input className="input ltr mono" value={s.meeting_prefix} onChange={(e) => set('meeting_prefix', e.target.value)} /></label><span className="small muted" style={{ lineHeight: 1.8 }}>يُنشأ رابط فريد لكل مقابلة فور تحديد موعدها، مثل: <span className="mono" dir="ltr">meet.jit.si/{s.meeting_prefix}-a1b2c3d4e5f6</span> — مجاني ولا يحتاج حساباً للمرشح.</span></>}
          {s.meeting_provider === 'static' && <label className="field"><span className="label">رابط القاعة الثابت (Zoom / Teams / Meet)</span><input className="input ltr mono" placeholder="https://" value={s.meeting_static_url || ''} onChange={(e) => set('meeting_static_url', e.target.value)} /></label>}
          <div className="notice blue xs">ربط حساب Google Meet أو Zoom لتوليد روابط من حساب الشركة يحتاج إنشاء تطبيق OAuth من حسابكم — وهو التطوير التالي المقترح.</div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card stack">
            <h2 style={{ fontSize: 19 }}>واتساب — الرابط الهجين</h2>
            <span className="small muted">أين يفتح زر واتساب؟</span>
            <div className="seg" style={{ alignSelf: 'flex-start' }}>{[['wa', 'تلقائي (wa.me)'], ['web', 'واتساب ويب'], ['app', 'تطبيق سطح المكتب']].map(([k, l]) => <button key={k} className={s.wa_mode === k ? 'on' : ''} onClick={() => set('wa_mode', k)}>{l}</button>)}</div>
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: 19 }}>عام</h2>
            <label className="field"><span className="label">اسم الشركة (يظهر في الموقع والرسائل)</span><input className="input" value={s.company_name} onChange={(e) => set('company_name', e.target.value)} /></label>
            <label className="field"><span className="label">رقم واتساب الموارد البشرية (لاستفسارات المتقدمين)</span>
              <input className="input ltr mono" inputMode="tel" placeholder="05XXXXXXXX" value={s.hr_whatsapp || ''} onChange={(e) => set('hr_whatsapp', normWa(e.target.value))} />
              <span className="xs muted">يظهر للمتقدم في صفحة النتيجة كزر واتساب مع رقم ترشيحه. {s.hr_whatsapp ? <>سيفتح المحادثة على: <span className="mono" dir="ltr">+{String(s.hr_whatsapp).replace(/[^\d]/g, '')}</span></> : 'اتركه فارغاً لإخفاء الزر.'}</span>
            </label>
            <div className="row between small"><span>إظهار الدرجة للمتقدم في صفحة النتيجة</span><Toggle label="إظهار الدرجة" on={s.show_score_to_candidate} onChange={(v) => set('show_score_to_candidate', v)} /></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ======================= حسابي =======================
export function Account() {
  const { me, depts } = useAdmin();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const mine = new Set((me.profile_departments || []).map((d) => d.department_id));
  const save = async () => {
    if (pw.length < 8) return toast('كلمة المرور 8 أحرف على الأقل', 'err');
    if (pw !== pw2) return toast('كلمتا المرور غير متطابقتين', 'err');
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return toast(error.message, 'err');
    setPw(''); setPw2(''); toast('تم تغيير كلمة المرور', 'ok');
  };
  return (
    <>
      <div className="page-head"><div><h1>حسابي</h1><p>{me.email}</p></div></div>
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="card stack"><div className="row"><span className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>{initial(me.full_name)}</span><div className="stack" style={{ gap: 0 }}><b>{me.full_name}</b><span className="small muted">{ROLES[me.role]}</span></div></div>
          <span className="label">الأقسام</span><div className="row wrap" style={{ gap: 6 }}>{me.role === 'admin' ? <span className="pill p-dark">كل الأقسام</span> : depts.filter((d) => mine.has(d.id)).map((d) => <span key={d.id} className="pill p-gray"><span className="sw" style={{ background: d.color }} />{d.name}</span>)}</div></div>
        <div className="card stack"><b>تغيير كلمة المرور</b>
          <label className="field"><span className="label">كلمة المرور الجديدة</span><input className="input ltr" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="field"><span className="label">تأكيدها</span><input className="input ltr" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          <button className="btn btn-dark" onClick={save}>حفظ</button></div>
      </div>
    </>
  );
}
