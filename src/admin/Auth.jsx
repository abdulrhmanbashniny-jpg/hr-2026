import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { Icon, initial, Logo, ROLES, sb, Spinner, usePublicSettings } from '../lib.jsx';

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [me, setMe] = useState(undefined);
  const [depts, setDepts] = useState([]);
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    sb.from('departments').select('*').order('sort').then(({ data }) => setDepts(data || []));
    return () => sub.subscription.unsubscribe();
  }, []);
  const loadMe = () => {
    if (!session) { setMe(session === null ? null : undefined); return; }
    sb.from('profiles').select('*, profile_departments(department_id)').eq('id', session.user.id).maybeSingle().then(({ data }) => setMe(data || false));
  };
  useEffect(loadMe, [session?.user?.id, session === null]);
  return <AuthCtx.Provider value={{ session, me, depts, reload: loadMe }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const useAdmin = () => useOutletContext();

export function Login() {
  const { session, me } = useAuth();
  const s = usePublicSettings();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (session && me) return <Navigate to="/admin" replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) return setErr(error.message.includes('Invalid') ? 'البريد أو كلمة المرور غير صحيحة' : error.message.includes('banned') ? 'هذا الحساب موقوف' : error.message);
    nav('/admin');
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', background: 'var(--bg)' }}>
      <div className="paint-bar">{['#C8553D', '#E0A21B', '#2F5D50', '#3B5B8C', '#8A6E4B'].map((c) => <i key={c} style={{ background: c }} />)}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form className="card stack" style={{ width: '100%', maxWidth: 420, padding: 34, gap: 18 }} onSubmit={submit}>
          <Logo company={s.company_name} sub="لوحة لجنة التوظيف" />
          <h1 style={{ fontSize: 24 }}>تسجيل الدخول</h1>
          <label className="field"><span className="label">البريد الإلكتروني</span><input className="input ltr" type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field"><span className="label">كلمة المرور</span><input className="input ltr" type="password" name="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
          {err && <div className="notice red" role="alert">{err}</div>}
          <button className="btn btn-dark btn-lg" disabled={busy}>{busy ? <span className="spinner" /> : 'دخول'}</button>
          <a href="#/" className="small center">العودة لبوابة الوظائف</a>
        </form>
      </div>
    </div>
  );
}

const NAV = [
  { to: '/admin', end: true, label: 'نظرة عامة', icon: 'home' },
  { to: '/admin/jobs', label: 'الوظائف والاختبارات', icon: 'briefcase' },
  { to: '/admin/import', label: 'استيراد وظيفة', icon: 'briefcase', admin: true },
  { to: '/admin/candidates', label: 'المرشحون', icon: 'users' },
  { to: '/admin/ranking', label: 'ترتيب المرشحين', icon: 'trophy' },
  { to: '/admin/schedule', label: 'ترتيب المواعيد', icon: 'calendar' },
  { to: '/admin/messages', label: 'رسائل واتساب', icon: 'wa' },
  { to: '/admin/users', label: 'المستخدمون والصلاحيات', icon: 'shield', admin: true },
  { to: '/admin/settings', label: 'الإعدادات والتكاملات', icon: 'gear', admin: true },
];

export function AdminLayout() {
  const { session, me, depts, reload } = useAuth();
  const s = usePublicSettings();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  if (session === undefined || (session && me === undefined)) return <Spinner />;
  if (!session) return <Navigate to="/admin/login" replace />;
  const logout = async () => { await sb.auth.signOut(); };
  if (!me || !me.active) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card stack center" style={{ maxWidth: 420, alignItems: 'center' }}><b>هذا الحساب غير مفعّل في اللوحة</b><span className="muted small">تواصل مع مدير النظام لتفعيل حسابك وتحديد صلاحياتك.</span><button className="btn btn-dark" onClick={logout}>تسجيل الخروج</button></div>
    </div>
  );
  const isAdmin = me.role === 'admin';
  const myDepts = new Set((me.profile_departments || []).map((d) => d.department_id));
  const canAccess = (deptId) => isAdmin || myDepts.has(deptId);
  const canManage = (deptId) => isAdmin || (me.role === 'manager' && myDepts.has(deptId));
  const visibleDepts = isAdmin ? depts : depts.filter((d) => myDepts.has(d.id));
  const ctx = { me, isAdmin, canAccess, canManage, depts, visibleDepts, company: s.company_name, reloadMe: reload };
  return (
    <div className="shell">
      <div className="mobile-top"><Logo company={s.company_name} sub="لوحة التوظيف" to="/admin" light /><button className="btn icon-btn" style={{ background: 'var(--dark3)', color: '#fff' }} aria-label="القائمة" onClick={() => setOpen(true)}><Icon name="menu" /></button></div>
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="row between"><Logo company={s.company_name} sub="لوحة التوظيف" to="/admin" light />{open && <button className="btn icon-btn" style={{ background: 'var(--dark3)', color: '#fff' }} aria-label="إغلاق" onClick={() => setOpen(false)}><Icon name="x" /></button>}</div>
        <nav>{NAV.filter((n) => !n.admin || isAdmin).map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={n.icon} size={18} />{n.label}</NavLink>)}</nav>
        <div className="stack" style={{ gap: 6, padding: '0 8px' }}>
          <span className="xs" style={{ color: '#9DA1A7' }}>أقسامك</span>
          <div className="row wrap" style={{ gap: 6 }}>{isAdmin ? <span className="pill" style={{ background: 'var(--dark3)', color: '#E6E4DF' }}>كل الأقسام</span> : visibleDepts.map((d) => <span key={d.id} className="pill" style={{ background: 'var(--dark3)', color: '#E6E4DF' }}><span className="sw" style={{ background: d.color }} />{d.name}</span>)}</div>
        </div>
        <div className="me">
          <span className="avatar" style={{ background: 'var(--saffron)', color: 'var(--ink)' }}>{initial(me.full_name)}</span>
          <NavLink to="/admin/account" className="stack grow" style={{ gap: 0, color: '#fff', textDecoration: 'none' }}><span className="small" style={{ fontWeight: 600 }}>{me.full_name}</span><span className="xs" style={{ color: '#9DA1A7' }}>{ROLES[me.role]}</span></NavLink>
          <button className="btn icon-btn" style={{ background: 'transparent', color: '#B9BCC1' }} aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={logout}><Icon name="logout" /></button>
        </div>
      </aside>
      <main className="main"><Outlet context={ctx} /><footer className="admin-credit">من تصميم <strong>عبدالرحمن سالم باشنيني</strong> · <a href="tel:0599222345" dir="ltr">٠٥٩٩٢٢٢٣٤٥</a> · <a href="mailto:abdulrhman.bashniny@gmail.com">abdulrhman.bashniny@gmail.com</a></footer></main>
    </div>
  );
}
