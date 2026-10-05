import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { callFn, fileSize, fmtDate, fmtDay, fmtTime, Icon, KEYS_AR, Logo, QTYPES, safeExt, sb, ScoreRing, Spinner, uid, usePublicSettings, useInterval } from '../lib.jsx';

const inkFor = (hex) => { const h = (hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#17191C' : '#FFFFFF'; };
const tint = (hex, a) => { const h = (hex || '#000').replace('#', ''); const n = parseInt(h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const m = (c) => Math.round(c + (255 - c) * a); return `rgb(${m(r)},${m(g)},${m(b)})`; };

function Header({ company, back }) {
  return (
    <header className="site-header">
      <Logo company={company} />
      <nav className="site-nav"><a href="#/">الوظائف</a><a href="#/" onClick={(e) => { e.preventDefault(); document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }); }}>كيف أتقدم؟</a></nav>
      {back ? <Link to={back} className="btn btn-ghost btn-sm"><Icon name="arrowR" size={16} />رجوع</Link>
        : <Link to="/admin" className="btn btn-outline btn-sm"><Icon name="lock" size={16} />دخول لجنة التوظيف</Link>}
    </header>
  );
}
const Footer = ({ company }) => <footer className="site-footer"><span>© {new Date().getFullYear()} {company} — جميع الحقوق محفوظة</span><span>بياناتك محمية ولا تُستخدم إلا لأغراض التوظيف</span><span className="credit">من تصميم <strong>عبدالرحمن سالم باشنيني</strong> · <a href="tel:0599222345" dir="ltr">٠٥٩٩٢٢٢٣٤٥</a> · <a href="mailto:abdulrhman.bashniny@gmail.com">abdulrhman.bashniny@gmail.com</a></span></footer>;

// ======================= الصفحة الرئيسية =======================
export function Home() {
  const s = usePublicSettings();
  const [jobs, setJobs] = useState(null);
  const [dep, setDep] = useState('all');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  useEffect(() => {
    sb.from('jobs').select('id,code,title,city,employment_type,experience,deadline,color,vacancies,department_id,departments(name,color)').eq('status', 'published').order('created_at')
      .then(({ data }) => setJobs(data || []));
  }, []);
  const deps = useMemo(() => { const m = new Map(); (jobs || []).forEach((j) => m.set(j.department_id, j.departments)); return [...m.entries()]; }, [jobs]);
  const cities = useMemo(() => [...new Set((jobs || []).map((j) => j.city).filter(Boolean))], [jobs]);
  const list = (jobs || []).filter((j) => (dep === 'all' || j.department_id === dep) && (!city || j.city === city) && (!q || (j.title + ' ' + j.departments?.name).includes(q.trim())));
  const strips = deps.slice(0, 4);
  return (
    <>
      <Header company={s.company_name} />
      <section className="hero">
        <div className="stack" style={{ gap: 26 }}>
          <span className="badge-live"><span className="dot" />{jobs ? `${jobs.length} وظائف شاغرة · التقديم مفتوح الآن` : 'جارٍ تحميل الوظائف…'}</span>
          <h1>لوّن مسيرتك المهنية<br />مع فريق يصنع الألوان</h1>
          <p>اختر الوظيفة المناسبة، قدّم بياناتك وسيرتك الذاتية، ثم أجرِ اختبار جدارة قصيراً يُقيَّم فوراً وبعدالة وفق متطلبات كل وظيفة.</p>
          <div className="search" role="search">
            <Icon name="search" color="#5E6166" style={{ marginInlineStart: 8 }} />
            <input aria-label="ابحث عن وظيفة" placeholder="المسمى الوظيفي أو القسم" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="المدينة" value={city} onChange={(e) => setCity(e.target.value)}><option value="">كل المدن</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btn btn-dark" onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })}>ابحث</button>
          </div>
        </div>
        <div className="fan" aria-hidden="true">
          {strips.map(([id, d], i) => (
            <div key={id} className="strip" style={{ left: 30 + i * 125, top: [30, 10, 0, 26][i], height: [390, 410, 430, 410][i], transform: `rotate(${[-9, -3, 4, 10][i]}deg)` }}>
              <b style={{ background: d?.color || '#C8553D' }} /><b style={{ flex: 'none', height: 64, background: tint(d?.color, .35) }} /><b style={{ flex: 'none', height: 46, background: tint(d?.color, .65) }} />
              <small>{d?.name}</small>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="steps">
        {[['01', 'اختر الوظيفة', 'اطّلع على الوصف والمهام والشروط'], ['02', 'قدّم بياناتك', 'الاسم والجوال والبريد والسيرة الذاتية'], ['03', 'اختبار الجدارة', '10 أسئلة تُقيَّم فوراً'], ['04', 'مقابلة افتراضية', 'نرسل لك الموعد والرابط عبر واتساب']].map(([n, t, d]) => (
          <div key={n} className="row" style={{ alignItems: 'flex-start', gap: 14 }}><span className="step-n">{n}</span><div className="stack" style={{ gap: 4 }}><b>{t}</b><span className="small" style={{ color: '#B9BCC1' }}>{d}</span></div></div>
        ))}
      </section>

      <section id="jobs" className="wrap stack" style={{ paddingTop: 56, gap: 26 }}>
        <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 6 }}><h2 style={{ fontSize: 34 }}>الوظائف المتاحة</h2><span className="muted">كل وظيفة لها اختبار جدارة مصمّم خصيصاً لمهامها</span></div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className={`chip ${dep === 'all' ? 'on' : ''}`} onClick={() => setDep('all')}>الكل</button>
            {deps.map(([id, d]) => <button key={id} className={`chip ${dep === id ? 'on' : ''}`} onClick={() => setDep(id)}><span className="sw" style={{ background: d?.color }} />{d?.name}</button>)}
          </div>
        </div>
        {!jobs ? <Spinner /> : !list.length ? <div className="card empty">لا توجد وظائف مطابقة حالياً</div> : (
          <div className="grid3">
            {list.map((j) => (
              <Link key={j.id} to={`/jobs/${j.id}`} className="job-card">
                <div className="job-swatch" style={{ background: j.color, color: inkFor(j.color) }}><span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{j.code}</span><span className="small">{j.vacancies} شواغر</span></div>
                <div className="stack" style={{ padding: 22, gap: 14 }}>
                  <div className="stack" style={{ gap: 4 }}><span className="small muted">{j.departments?.name}</span><span className="display" style={{ fontWeight: 600, fontSize: 21 }}>{j.title}</span></div>
                  <div className="row wrap" style={{ gap: 8 }}><span className="tag">{j.city}</span><span className="tag">{j.employment_type}</span><span className="tag">{j.experience}</span></div>
                  <div className="row between" style={{ paddingTop: 14, borderTop: '1px solid var(--line2)' }}><span className="small muted">آخر موعد: {fmtDate(j.deadline)}</span><span className="row" style={{ gap: 6, fontWeight: 600, fontSize: 14, color: '#0F5B4B' }}>التفاصيل والتقديم<Icon name="arrowL" size={16} /></span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <Footer company={s.company_name} />
    </>
  );
}

// ======================= تفاصيل الوظيفة =======================
export function JobPage() {
  const { id } = useParams();
  const s = usePublicSettings();
  const [job, setJob] = useState(undefined);
  useEffect(() => { sb.from('jobs').select('id,code,title,department_id,city,employment_type,experience,salary_text,description,tasks,requirements,must_have,nice_to_have,benefits,deadline,vacancies,status,pass_threshold,duration_minutes,color,created_at,departments(name)').eq('id', id).maybeSingle().then(({ data }) => setJob(data || null)); }, [id]);
  if (job === undefined) return <><Header company={s.company_name} back="/" /><Spinner /></>;
  if (!job) return <><Header company={s.company_name} back="/" /><div className="wrap"><div className="card empty" style={{ marginTop: 40 }}>هذه الوظيفة غير متاحة حالياً.</div></div></>;
  const ink = inkFor(job.color);
  return (
    <>
      <Header company={s.company_name} back="/" />
      <section className="job-hero" style={{ background: job.color, color: ink }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="row small"><span className="mono glass">{job.code}</span><span>{job.departments?.name}</span></div>
          <h1>{job.title}</h1>
          <div className="row wrap" style={{ gap: 8 }}>{[job.city, job.employment_type, job.experience, job.salary_text].filter(Boolean).map((t) => <span key={t} className="glass">{t}</span>)}</div>
        </div>
        <div className="row hide-sm" style={{ gap: 6 }}>{[.25, .5, .75].map((a) => <div key={a} style={{ width: 42, height: 140, borderRadius: 10, background: tint(job.color, a) }} />)}</div>
      </section>
      <section className="wrap" style={{ paddingTop: 32 }}>
        <div className="grid3" style={{ alignItems: 'start' }}>
          <div className="stack" style={{ gridColumn: 'span 2', gap: 20 }}>
            <article className="card stack"><h2 style={{ fontSize: 22 }}>الوصف الوظيفي</h2><p style={{ lineHeight: 1.9, color: 'var(--ink2)' }}>{job.description}</p></article>
            <article className="card stack"><h2 style={{ fontSize: 22 }}>المهام والمسؤوليات</h2>
              {(job.tasks || []).map((t, i) => <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 12 }}><span className="check"><Icon name="check" size={14} stroke={2.6} color="#A8412B" /></span><span style={{ lineHeight: 1.8, color: 'var(--ink2)' }}>{t}</span></div>)}
            </article>
            <article className="card stack"><h2 style={{ fontSize: 22 }}>الشروط والمتطلبات</h2>
              <div className="grid2">{(job.requirements || []).map((r, i) => <div key={i} className="stack" style={{ gap: 2, padding: '14px 16px', background: '#F8F6F2', borderRadius: 12 }}><span className="xs muted" style={{ fontWeight: 600 }}>{r.k}</span><span style={{ fontWeight: 500 }}>{r.v}</span></div>)}</div>
            </article>
          </div>
          <aside className="stack" style={{ gap: 20, position: 'sticky', top: 96 }}>
            <div className="card stack" style={{ background: 'var(--dark)', color: '#fff', borderColor: 'var(--dark)', gap: 18 }}>
              <span className="display" style={{ fontSize: 19, fontWeight: 600 }}>اختبار الجدارة</span>
              <div className="grid3" style={{ gap: 8 }}>{[['10', 'أسئلة'], [job.duration_minutes, 'دقيقة'], [`${job.pass_threshold}%`, 'للاجتياز']].map(([v, l]) => <div key={l} className="stack center" style={{ gap: 2, padding: '12px 6px', background: 'var(--dark3)', borderRadius: 12 }}><span className="mono" style={{ fontSize: 22, color: 'var(--gold)' }}>{v}</span><span className="xs" style={{ color: '#B9BCC1' }}>{l}</span></div>)}</div>
              <span className="small" style={{ color: '#CFD2D6', lineHeight: 1.8 }}>أسئلة اختيار من متعدد، وإجابات نصية ورقمية، وإرفاق نماذج من أعمالك. يُقيَّم الاختبار وفق معايير هذه الوظيفة.</span>
              <Link to={`/apply/${job.id}`} className="btn btn-gold btn-lg btn-block">قدّم على الوظيفة الآن<Icon name="arrowL" /></Link>
            </div>
            <div className="card stack" style={{ gap: 12 }}>
              {(job.benefits || []).length > 0 && <><b>المزايا</b><span className="small" style={{ color: 'var(--ink2)', lineHeight: 1.9 }}>{job.benefits.join(' · ')}</span><div className="divider" /></>}
              <div className="row between small"><span className="muted">آخر موعد للتقديم</span><b>{fmtDate(job.deadline)}</b></div>
              <div className="row between small"><span className="muted">عدد الشواغر</span><b>{job.vacancies}</b></div>
              <div className="row between small"><span className="muted">نوع المقابلة</span><b>افتراضية أونلاين</b></div>
            </div>
          </aside>
        </div>
      </section>
      <Footer company={s.company_name} />
    </>
  );
}

// ======================= نموذج التقديم =======================
const CV_TYPES = ['pdf', 'doc', 'docx'];
export function Apply() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = usePublicSettings();
  const [job, setJob] = useState(undefined);
  const [f, setF] = useState({ full_name: '', phone: '', email: '', agree: false });
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inp = useRef();
  useEffect(() => { sb.from('jobs').select('id,title,code,city,employment_type,color,duration_minutes').eq('id', id).maybeSingle().then(({ data }) => setJob(data || null)); }, [id]);
  const phoneOk = /^(0?5\d{8}|9665\d{8})$/.test(f.phone.replace(/[\s-]/g, ''));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  const pick = (fl) => {
    if (!fl) return;
    if (!CV_TYPES.includes(safeExt(fl.name))) return setErr('الملف يجب أن يكون PDF أو Word');
    if (fl.size > 5 * 1048576) return setErr('حجم الملف يتجاوز 5 ميجابايت');
    setErr(''); setFile(fl);
  };
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.full_name.trim() || f.full_name.trim().split(/\s+/).length < 2) return setErr('اكتب اسمك الكامل (اسمان على الأقل)');
    if (!phoneOk) return setErr('رقم الجوال غير صحيح — مثال: 0551234567');
    if (!emailOk) return setErr('البريد الإلكتروني غير صحيح');
    if (!file) return setErr('أرفق سيرتك الذاتية');
    if (!f.agree) return setErr('يجب الموافقة على معالجة البيانات');
    setBusy(true);
    try {
      const ext = safeExt(file.name);
      const path = `${id}/${uid()}.${ext}`;
      const ct = ext === 'pdf' ? 'application/pdf' : ext === 'doc' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const { error } = await sb.storage.from('cvs').upload(path, file, { contentType: ct, upsert: false });
      if (error) throw new Error('تعذّر رفع السيرة الذاتية: ' + error.message);
      const r = await callFn('candidate', { action: 'apply', job_id: id, full_name: f.full_name, phone: f.phone, email: f.email, cv_path: path, cv_name: file.name });
      nav(`/test/${r.token}`);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (job === undefined) return <><Header company={s.company_name} back={`/jobs/${id}`} /><Spinner /></>;
  if (!job) return <><Header company={s.company_name} back="/" /><div className="wrap"><div className="card empty" style={{ marginTop: 40 }}>هذه الوظيفة غير متاحة للتقديم.</div></div></>;
  return (
    <>
      <Header company={s.company_name} back={`/jobs/${id}`} />
      <section className="wrap" style={{ paddingTop: 36 }}>
        <div className="grid3" style={{ alignItems: 'start' }}>
          <form className="card stack" style={{ gridColumn: 'span 2', padding: 36, gap: 22 }} onSubmit={submit} noValidate>
            <div className="stack" style={{ gap: 6 }}><h1 style={{ fontSize: 30 }}>بياناتك الأساسية</h1><span className="muted">تستغرق دقيقتين. سنستخدم رقم الجوال للتواصل معك عبر واتساب.</span></div>
            <label className="field"><span className="label">الاسم الكامل <span className="req">*</span></span><input className="input" name="full_name" autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></label>
            <div className="grid2">
              <label className="field"><span className="label">رقم الجوال (واتساب) <span className="req">*</span></span>
                <input className="input ltr mono" name="phone" inputMode="tel" autoComplete="tel" placeholder="05XXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                {f.phone && <span className={phoneOk ? 'hint' : 'error-text'} style={phoneOk ? { color: 'var(--green-ink)' } : undefined}>{phoneOk ? '✓ رقم صالح' : 'اكتب رقماً سعودياً مثل 0551234567'}</span>}
              </label>
              <label className="field"><span className="label">البريد الإلكتروني <span className="req">*</span></span><input className="input ltr" type="email" name="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            </div>
            <div className="field"><span className="label">السيرة الذاتية <span className="req">*</span></span>
              <div className={`drop ${over ? 'over' : ''}`} onClick={() => inp.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && inp.current.click()}>
                <span style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="upload" size={24} /></span>
                <span className="stack" style={{ gap: 2 }}><b>اسحب الملف هنا أو اختر من جهازك</b><span className="small muted">PDF أو Word — الحد الأقصى 5 ميجابايت</span></span>
                <input ref={inp} type="file" name="cv" accept=".pdf,.doc,.docx" hidden onChange={(e) => pick(e.target.files[0])} />
              </div>
              {file && <div className="file-row"><span className="file-ic">{safeExt(file.name).toUpperCase()}</span><span className="grow stack" style={{ gap: 2 }}><b className="small">{file.name}</b><span className="xs muted">{fileSize(file.size)}</span></span><button type="button" className="btn btn-ghost icon-btn" aria-label="حذف الملف" onClick={() => setFile(null)}><Icon name="x" /></button></div>}
            </div>
            <label className="row small" style={{ alignItems: 'flex-start', gap: 12, lineHeight: 1.7, color: 'var(--ink2)' }}><input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} style={{ width: 20, height: 20, marginTop: 3, accentColor: '#17191C' }} /><span>أوافق على معالجة بياناتي لأغراض التوظيف، وعلى التواصل معي عبر واتساب والبريد الإلكتروني.</span></label>
            {err && <div className="notice red" role="alert">{err}</div>}
            <button className="btn btn-dark btn-lg" disabled={busy}>{busy ? <><span className="spinner" />جارٍ الإرسال…</> : <>حفظ والانتقال إلى الاختبار<Icon name="arrowL" /></>}</button>
          </form>
          <aside className="stack" style={{ gap: 20 }}>
            <div className="card flat"><div style={{ height: 10, display: 'flex' }}>{[0, .4, .7].map((a) => <span key={a} style={{ flex: 1, background: tint(job.color, a) }} />)}</div>
              <div className="stack" style={{ padding: 22, gap: 4 }}><span className="small muted">تتقدّم لوظيفة</span><span className="display" style={{ fontWeight: 600, fontSize: 20 }}>{job.title}</span><span className="small muted">{job.city} · {job.employment_type} · {job.code}</span></div></div>
            <div className="card stack" style={{ gap: 14 }}><b>ماذا بعد التقديم؟</b>
              {[`اختبار من 10 أسئلة خاص بالوظيفة (${job.duration_minutes} دقيقة).`, 'تحليل فوري لإجاباتك ونتيجة مباشرة.', 'عند الاجتياز: دعوة لمقابلة افتراضية عبر واتساب.'].map((t, i) => <div key={i} className="row small" style={{ alignItems: 'flex-start', gap: 12, lineHeight: 1.7 }}><span className="mono" style={{ color: 'var(--accent-ink)' }}>0{i + 1}</span><span>{t}</span></div>)}
            </div>
            <div className="notice green"><Icon name="shield" style={{ flex: 'none' }} /><span>بياناتك وملفاتك محفوظة ومشفّرة ولا يطّلع عليها إلا فريق التوظيف.</span></div>
          </aside>
        </div>
      </section>
      <Footer company={s.company_name} />
    </>
  );
}

// ======================= النتيجة =======================
function Result({ result, job, name, token, company }) {
  const passed = result?.passed;
  const ref = String(token || '').slice(0, 8).toUpperCase();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div className="paint-bar">{['#C8553D', '#E0A21B', '#2F5D50', '#3B5B8C', '#8A6E4B'].map((c) => <i key={c} style={{ background: c }} />)}</div>
      <div className="card stack" style={{ maxWidth: 820, width: '100%', padding: '44px 48px', gap: 30, boxShadow: '0 24px 60px rgba(23,25,28,.08)' }}>
        <Logo company={company} />
        <div className="row wrap" style={{ gap: 36 }}>
          {result?.score != null && <ScoreRing value={result.score} threshold={result.threshold} label={passed ? 'درجة التقييم' : `المطلوب ${result.threshold}%`} />}
          <div className="stack grow" style={{ gap: 14, minWidth: 260 }}>
            {passed ? <>
              <span className="pill p-green" style={{ alignSelf: 'flex-start', fontSize: 13 }}><Icon name="check" size={14} stroke={2.6} />اجتزت مرحلة التقييم</span>
              <h1 style={{ fontSize: 32 }}>شكراً {name?.split(' ')[0]}، أداؤك مميّز!</h1>
              <p style={{ fontSize: 17, lineHeight: 1.9, color: 'var(--ink2)' }}>سيتم التواصل معك خلال الفترة القادمة بعد الانتهاء من فرز المرشحين، وسنرسل لك موعد المقابلة الافتراضية ورابط القاعة عبر واتساب.</p>
            </> : <>
              <span className="pill p-red" style={{ alignSelf: 'flex-start', fontSize: 13 }}>لم تتجاوز مرحلة التقييم</span>
              <h1 style={{ fontSize: 30 }}>شكراً لاهتمامك بالانضمام إلينا</h1>
              <p style={{ fontSize: 17, lineHeight: 1.9, color: 'var(--ink2)' }}>نعتذر منك، لم تتجاوز مرحلة الاختبار لهذه الوظيفة هذه المرة. نقدّر وقتك وجهدك، ونتمنى أن نراك في فرص قادمة تناسب خبراتك.</p>
            </>}
          </div>
        </div>
        {passed && <div className="grid3" style={{ gap: 10 }}>
          <div className="stack" style={{ gap: 6, padding: 18, borderRadius: 16, background: 'var(--green-bg)' }}><span className="mono small" style={{ color: 'var(--green-ink)' }}>تم</span><b>التقديم والاختبار</b></div>
          <div className="stack" style={{ gap: 6, padding: 18, borderRadius: 16, background: 'var(--amber-bg)', border: '1.5px solid var(--saffron)' }}><span className="mono small" style={{ color: 'var(--amber-ink)' }}>الآن</span><b>فرز المرشحين</b></div>
          <div className="stack" style={{ gap: 6, padding: 18, borderRadius: 16, background: 'var(--bg)' }}><span className="mono small muted">التالي</span><b>مقابلة افتراضية</b></div>
        </div>}
        <div className="row between wrap" style={{ paddingTop: 22, borderTop: '1px solid var(--line2)', gap: 16 }}>
          <div className="stack" style={{ gap: 2 }}><span className="small muted">رقم الطلب — {job?.title}</span><span className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{ref}</span></div>
          <Link to="/" className={`btn ${passed ? 'btn-outline' : 'btn-dark'}`}>{passed ? 'وظائف أخرى' : 'تصفّح الوظائف الأخرى'}</Link>
        </div>
      </div>
    </div>
  );
}

// ======================= اختبار الجدارة =======================
const UP_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
export function TestPage() {
  const { token } = useParams();
  const s = usePublicSettings();
  const [phase, setPhase] = useState('loading');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [ans, setAns] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const offset = useRef(0);
  const integ = useRef({ tab_switches: 0, pastes: 0, times: {} });
  const last = useRef(Date.now());
  const submitted = useRef(false);
  const key = `hp-ans-${token}`;

  const load = async (start) => {
    try {
      const r = await callFn('candidate', { action: 'get_test', token, start });
      setData(r);
      if (r.submitted) return setPhase('result');
      if (r.intro) return setPhase('intro');
      offset.current = new Date(r.now).getTime() - Date.now();
      try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); if (saved) { setAns(saved.ans || {}); integ.current = saved.integ || integ.current; } } catch { /* تخزين غير متاح */ }
      setPhase('test');
    } catch (x) { setErr(x.message); setPhase('error'); }
  };
  useEffect(() => { load(false); }, [token]);
  useEffect(() => { if (phase === 'test') try { localStorage.setItem(key, JSON.stringify({ ans, integ: integ.current })); } catch { /* تجاهل */ } }, [ans, phase]);
  useEffect(() => {
    const h = () => { if (document.hidden && phase === 'test') integ.current.tab_switches += 1; };
    document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h);
  }, [phase]);

  const qs = data?.questions || [];
  const q = qs[i];
  const submit = async () => {
    if (submitted.current) return; submitted.current = true;
    setConfirm(false); setPhase('submitting');
    try {
      const answers = qs.map((qq) => { const a = ans[qq.id] || {}; return { question_id: qq.id, value_option: a.value_option, value_number: a.value_number, value_text: a.value_text, files: (a.files || []).map((f) => f.path) }; });
      const r = await callFn('candidate', { action: 'submit', token, answers, integrity: integ.current });
      try { localStorage.removeItem(key); } catch { /* تجاهل */ }
      setData((d) => ({ ...d, submitted: true, result: r.result }));
      setPhase('result');
    } catch (x) { submitted.current = false; setErr(x.message); setPhase('test'); }
  };
  useInterval(() => {
    if (phase !== 'test' || !data?.started_at) return;
    const now = Date.now() + offset.current;
    const rem = Math.round((new Date(data.started_at).getTime() + data.job.duration_minutes * 60000 - now) / 1000);
    setLeft(rem);
    if (q) { const dt = Math.round((Date.now() - last.current) / 1000); integ.current.times[q.id] = (integ.current.times[q.id] || 0) + dt; }
    last.current = Date.now();
    if (rem <= 0) submit();
  }, 1000);

  const setA = (patch) => setAns((a) => ({ ...a, [q.id]: { ...(a[q.id] || {}), ...patch } }));
  const isAnswered = (qq) => { const a = ans[qq.id]; if (!a) return false; if (qq.type === 'mcq') return a.value_option != null; if (qq.type === 'number') return a.value_number !== undefined && a.value_number !== ''; if (qq.type === 'text') return (a.value_text || '').trim().length > 0; return (a.files || []).length > 0; };
  const answered = qs.filter(isAnswered).length;
  const upload = async (files) => {
    const cur = ans[q.id]?.files || [];
    const list = [...files].slice(0, 6 - cur.length);
    setUploading(true); setErr('');
    const out = [];
    for (const fl of list) {
      const ext = safeExt(fl.name);
      if (!UP_TYPES.includes(ext)) { setErr('الصيغ المسموحة: JPG و PNG و WEBP و PDF'); continue; }
      if (fl.size > 10 * 1048576) { setErr('الحد الأقصى 10 ميجابايت لكل ملف'); continue; }
      const path = `${data.job.id}/${uid()}.${ext}`;
      const ct = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const { error } = await sb.storage.from('portfolios').upload(path, fl, { contentType: ct });
      if (error) setErr('تعذّر رفع ' + fl.name); else out.push({ path, name: fl.name, size: fl.size });
    }
    setA({ files: [...cur, ...out] }); setUploading(false);
  };

  if (phase === 'loading') return <Spinner />;
  if (phase === 'error') return <div className="wrap" style={{ paddingTop: 80 }}><div className="card empty stack" style={{ alignItems: 'center' }}><b>{err || 'الرابط غير صالح'}</b><Link to="/" className="btn btn-dark">العودة للوظائف</Link></div></div>;
  if (phase === 'result') return <Result result={data.result} job={data.job} name={data.candidate?.full_name} token={token} company={s.company_name} />;
  if (phase === 'submitting') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card stack center" style={{ maxWidth: 520, alignItems: 'center', padding: 44, gap: 16 }}><span className="spinner" style={{ width: 44, height: 44, borderWidth: 4 }} /><h2 style={{ fontSize: 22 }}>جارٍ تحليل إجاباتك…</h2><span className="muted">نقيّم إجاباتك وسيرتك الذاتية وفق معايير الوظيفة. قد يستغرق ذلك دقيقة، لا تغلق الصفحة.</span></div>
    </div>
  );
  if (phase === 'intro') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div className="card stack" style={{ maxWidth: 720, width: '100%', padding: 40, gap: 22 }}>
        <Logo company={s.company_name} />
        <div className="stack" style={{ gap: 6 }}><span className="muted">مرحباً {data.candidate?.full_name}</span><h1 style={{ fontSize: 30 }}>اختبار الجدارة — {data.job.title}</h1></div>
        <div className="grid3" style={{ gap: 10 }}>{[[data.count, 'سؤال'], [data.job.duration_minutes, 'دقيقة'], [`${data.job.pass_threshold}%`, 'للاجتياز']].map(([v, l]) => <div key={l} className="stack center" style={{ gap: 2, padding: 16, background: 'var(--bg)', borderRadius: 14 }}><span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{v}</span><span className="small muted">{l}</span></div>)}</div>
        <div className="stack small" style={{ gap: 10, lineHeight: 1.8, color: 'var(--ink2)' }}>
          {['يبدأ المؤقت بمجرد الضغط على «ابدأ الاختبار» ويُرسَل الاختبار تلقائياً عند انتهاء الوقت.', 'تُحفظ إجاباتك تلقائياً، ويمكنك التنقل بين الأسئلة بحرية.', 'الأسئلة: اختيار من متعدد، إجابات نصية ورقمية، وإرفاق نماذج من أعمالك.', 'نرصد مغادرة صفحة الاختبار واللصق ضمن مؤشرات النزاهة — أجب بنفسك.'].map((t, k) => <div key={k} className="row" style={{ alignItems: 'flex-start', gap: 10 }}><span className="check"><Icon name="check" size={14} stroke={2.6} color="#A8412B" /></span><span>{t}</span></div>)}
        </div>
        <button className="btn btn-accent btn-lg" onClick={() => { setPhase('loading'); load(true); }}>ابدأ الاختبار<Icon name="arrowL" /></button>
      </div>
    </div>
  );

  const mm = left == null ? '--:--' : `${String(Math.max(0, Math.floor(left / 60))).padStart(2, '0')}:${String(Math.max(0, left % 60)).padStart(2, '0')}`;
  const a = ans[q?.id] || {};
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="site-header" style={{ background: '#fff', height: 72 }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="logo-mark"><i style={{ height: 24, background: '#C8553D' }} /><i style={{ height: 30, background: '#E0A21B' }} /><i style={{ height: 18, background: '#2F5D50' }} /></span>
          <div className="stack" style={{ gap: 0 }}><b>اختبار الجدارة — {data.job.title}</b><span className="xs muted">{data.candidate?.full_name}</span></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="xs hide-sm" style={{ color: 'var(--green-ink)' }}>✓ حُفظ تلقائياً</span>
          <span className={`timer ${left != null && left < 180 ? 'warn' : ''}`} role="timer" aria-label="الوقت المتبقي"><Icon name="clock" color="#F2C14E" /><span className="mono" style={{ fontSize: 17 }}>{mm}</span></span>
        </div>
      </header>
      <div style={{ height: 4, background: 'var(--line)', display: 'flex' }}><span style={{ width: `${(answered / Math.max(1, qs.length)) * 100}%`, background: 'var(--accent)', transition: 'width .3s' }} /></div>
      <div className="wrap" style={{ paddingTop: 30, paddingBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }} className="test-grid">
          <style>{'@media(min-width:901px){.test-grid{grid-template-columns:300px minmax(0,1fr)!important}}'}</style>
          <aside className="card stack" style={{ gap: 18, alignSelf: 'start' }}>
            <div className="row between"><b>الأسئلة</b><span className="small muted">أُجيب {answered} من {qs.length}</span></div>
            <div className="qnav">{qs.map((qq, k) => <button key={qq.id} className={k === i ? 'cur' : isAnswered(qq) ? 'done' : ''} aria-label={`السؤال ${k + 1}`} onClick={() => setI(k)}>{k + 1}</button>)}</div>
            <div className="notice amber xs"><Icon name="spark" style={{ flex: 'none' }} /><span>تُقيَّم إجاباتك وفق معايير الوظيفة ثم تراجعها لجنة التوظيف.</span></div>
          </aside>
          {q && <main className="card stack" style={{ padding: '36px 40px', gap: 24, minHeight: 520 }}>
            <div className="row between"><span className="mono small muted">السؤال {i + 1} / {qs.length}</span><span className="pill p-gray">{QTYPES[q.type]}</span></div>
            <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.7 }}>{q.text}</h1>
            {q.type === 'mcq' && <div className="stack" style={{ gap: 10 }} role="radiogroup">{(q.options || []).map((o, k) => <button key={k} role="radio" aria-checked={a.value_option === k} className={`opt ${a.value_option === k ? 'on' : ''}`} onClick={() => setA({ value_option: k })}><span className="opt-k">{KEYS_AR[k]}</span><span>{o}</span></button>)}</div>}
            {q.type === 'number' && <label className="row" style={{ gap: 14 }}><input className="input ltr mono" inputMode="decimal" aria-label="إجابتك الرقمية" style={{ maxWidth: 260, fontSize: 26, minHeight: 68 }} value={a.value_number ?? ''} onChange={(e) => setA({ value_number: e.target.value.replace(/[^\d.\-٠-٩٫,]/g, '') })} placeholder="0" /><b style={{ fontSize: 18 }}>{q.unit}</b></label>}
            {q.type === 'text' && <div className="stack" style={{ gap: 6 }}><textarea className="textarea" aria-label="إجابتك" style={{ minHeight: 220, fontSize: 16 }} placeholder="اكتب إجابتك بخطوات واضحة…" value={a.value_text || ''} onPaste={() => { integ.current.pastes += 1; }} onChange={(e) => setA({ value_text: e.target.value })} /><span className="xs muted">{(a.value_text || '').trim().split(/\s+/).filter(Boolean).length} كلمة · يُقيَّم الترتيب المنطقي ودقة المحتوى</span></div>}
            {q.type === 'upload' && <div className="stack" style={{ gap: 12 }}>
              <label className="drop" style={{ flexDirection: 'column', textAlign: 'center' }}><Icon name="image" size={30} /><b>{uploading ? 'جارٍ الرفع…' : 'أرفق صوراً أو ملف PDF لأعمالك'}</b><span className="small muted">حتى 6 ملفات · JPG, PNG, PDF · 10 ميجابايت لكل ملف</span><input type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => upload(e.target.files)} disabled={uploading} /></label>
              {(a.files || []).map((fl, k) => <div key={fl.path} className="file-row"><span className="file-ic">{safeExt(fl.name).toUpperCase()}</span><span className="grow small"><b>{fl.name}</b></span><button className="btn btn-ghost icon-btn" aria-label="حذف" onClick={() => setA({ files: a.files.filter((_, x) => x !== k) })}><Icon name="x" /></button></div>)}
            </div>}
            {err && <div className="notice red">{err}</div>}
            <div className="row between" style={{ marginTop: 'auto', paddingTop: 22, borderTop: '1px solid var(--line2)' }}>
              <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="arrowR" size={16} />السابق</button>
              {i < qs.length - 1 ? <button className="btn btn-dark" onClick={() => setI(i + 1)}>التالي<Icon name="arrowL" size={16} /></button>
                : <button className="btn btn-accent" onClick={() => setConfirm(true)}>إرسال الإجابات للتقييم</button>}
            </div>
          </main>}
        </div>
      </div>
      {confirm && <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(false)}><div className="modal"><div className="modal-body">
        <h3>إرسال الإجابات؟</h3>
        <p className="muted">أجبت على {answered} من {qs.length} أسئلة. بعد الإرسال لا يمكن تعديل الإجابات.</p>
        {answered < qs.length && <div className="notice amber">لديك {qs.length - answered} أسئلة بدون إجابة.</div>}
      </div><div className="modal-foot"><button className="btn btn-ghost" onClick={() => setConfirm(false)}>مراجعة</button><button className="btn btn-accent" onClick={submit}>تأكيد الإرسال</button></div></div></div>}
    </div>
  );
}

// ======================= حجز موعد المقابلة =======================
export function BookPage() {
  const { token } = useParams();
  const s = usePublicSettings();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const load = () => callFn('candidate', { action: 'slots', token }).then(setD).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, [token]);
  const groups = useMemo(() => { const m = new Map(); (d?.slots || []).forEach((x) => { const k = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(x.starts_at)); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m.entries()]; }, [d]);
  const book = async () => {
    setBusy(true); setErr('');
    try { const r = await callFn('candidate', { action: 'book', token, starts_at: pick }); setDone(r.starts_at); setPick(null); load(); } catch (x) { setErr(x.message); load(); }
    setBusy(false);
  };
  return (
    <>
      <header className="site-header"><Logo company={s.company_name} /></header>
      <section className="wrap" style={{ paddingTop: 36, paddingBottom: 60, maxWidth: 980, margin: '0 auto' }}>
        {err && <div className="notice red" style={{ marginBottom: 16 }}>{err}</div>}
        {!d ? (!err && <Spinner />) : !d.allowed ? <div className="card empty">حجز المواعيد غير متاح لهذا الطلب حالياً.</div> : (
          <div className="stack" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 6 }}><span className="muted">مرحباً {d.candidate?.full_name}</span><h1 style={{ fontSize: 28 }}>موعد مقابلتك — {d.job?.title}</h1></div>
            {(done || d.current) && <div className="notice green" style={{ fontSize: 15 }}><Icon name="calendar" style={{ flex: 'none' }} /><span>موعدك الحالي: <b>{fmtDay(done || d.current.starts_at)} · الساعة {fmtTime(done || d.current.starts_at)}</b> (بتوقيت الرياض). المقابلة افتراضية وسيصلك رابط القاعة عبر واتساب عند حلول الموعد.</span></div>}
            {d.self ? (
              <div className="card stack" style={{ gap: 18 }}>
                <b>{d.current ? 'تغيير الموعد — اختر وقتاً آخر' : 'اختر الموعد المناسب لك'}</b>
                {!groups.length && <div className="empty">لا توجد مواعيد متاحة حالياً.</div>}
                {groups.map(([day, list]) => <div key={day} className="stack" style={{ gap: 8 }}><span className="small" style={{ fontWeight: 700 }}>{fmtDay(list[0].starts_at)}</span>
                  <div className="row wrap" style={{ gap: 8 }}>{list.map((x) => <button key={x.starts_at} className={`chip ${pick === x.starts_at ? 'on' : ''}`} onClick={() => setPick(x.starts_at)}><span className="mono">{fmtTime(x.starts_at)}</span></button>)}</div></div>)}
                <button className="btn btn-accent btn-lg" disabled={!pick || busy} onClick={book}>{busy ? 'جارٍ الحجز…' : 'تأكيد الموعد'}</button>
              </div>
            ) : !d.current && <div className="card empty">ستحدد لجنة التوظيف موعد مقابلتك ويصلك عبر واتساب.</div>}
          </div>
        )}
      </section>
    </>
  );
}
