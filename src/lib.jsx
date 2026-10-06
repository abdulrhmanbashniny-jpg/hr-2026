import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'hiring-auth' } });

// استدعاء دوال الخادم (Edge Functions)
export async function callFn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}` },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok || data.error) throw new Error(data.error || `خطأ ${res.status}`);
  return data;
}

// ---------------- ثوابت ونصوص ----------------
export const STATUS = {
  applied: { l: 'لم يكمل الاختبار', c: 'p-gray' },
  passed: { l: 'اجتاز الاختبار', c: 'p-green' },
  failed: { l: 'لم يجتز', c: 'p-red' },
  interview: { l: 'مقابلة مجدولة', c: 'p-blue' },
  interviewed: { l: 'تمت المقابلة', c: 'p-amber' },
  offer: { l: 'عرض وظيفي', c: 'p-green' },
  hired: { l: 'تم التعيين', c: 'p-dark' },
  rejected: { l: 'مستبعد', c: 'p-red' },
};
export const ROLES = { admin: 'مدير النظام', manager: 'مدير قسم', evaluator: 'عضو لجنة' };
export const QTYPES = { mcq: 'اختيار من متعدد', text: 'إجابة نصية', number: 'إجابة رقمية', upload: 'إرفاق أعمال' };
export const REC = { strong: { l: 'مرشح قوي', c: 'p-green' }, good: { l: 'مناسب', c: 'p-blue' }, weak: { l: 'ضعيف', c: 'p-red' } };
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const KEYS_AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

// ---------------- التاريخ والوقت (توقيت الرياض) ----------------
const TZ = 'Asia/Riyadh';
const LOC = 'ar-SA-u-ca-gregory-nu-latn';
export const fmtDate = (d) => d ? new Intl.DateTimeFormat(LOC, { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d)) : '—';
export const fmtDay = (d) => d ? new Intl.DateTimeFormat(LOC, { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d)) : '—';
export const fmtTime = (d) => d ? new Intl.DateTimeFormat(LOC, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)) : '—';
export const fmtDateTime = (d) => d ? `${fmtDay(d)} · ${fmtTime(d)}` : '—';
export function ago(d) {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.round(s / 60); if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`;
  const dd = Math.round(h / 24); return `قبل ${dd} يوم`;
}
export const riyadhDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
export const pad = (n) => String(n).padStart(2, '0');
export const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const timeToMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };

// ---------------- توليد المواعيد ----------------
export function daySlots(s) {
  const out = []; let t = s.start_min; let g = 0;
  while (t + s.duration_min <= s.end_min && g++ < 500) {
    if (s.exclude_prayer && t < s.prayer_end && t + s.duration_min > s.prayer_start) { t = s.prayer_end; continue; }
    out.push(t); t += s.duration_min + s.break_min;
  }
  return out;
}
export function generateSlots(s) {
  if (!s?.date_from || !s?.date_to) return [];
  const res = []; const mins = daySlots(s);
  const d = new Date(s.date_from + 'T12:00:00Z'); const end = new Date(s.date_to + 'T12:00:00Z'); let g = 0;
  while (d <= end && g++ < 120) {
    if ((s.days || []).includes(d.getUTCDay())) {
      const ds = d.toISOString().slice(0, 10);
      for (const m of mins) {
        const e = m + s.duration_min;
        res.push({ date: ds, dow: d.getUTCDay(), starts_at: new Date(`${ds}T${minToTime(m)}:00+03:00`).toISOString(), ends_at: new Date(`${ds}T${minToTime(e)}:00+03:00`).toISOString() });
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return res;
}

// ---------------- واتساب (الرابط الهجين) ----------------
export const siteBase = () => `${window.location.origin}${window.location.pathname}`;
export const bookingLink = (token) => `${siteBase()}#/book/${token}`;
export const testLink = (token) => `${siteBase()}#/test/${token}`;
export function fillTemplate(body, v) {
  return String(body || '')
    .replaceAll('{الاسم}', v.name || '')
    .replaceAll('{الوظيفة}', v.job || '')
    .replaceAll('{الموعد}', v.when || '[لم يُحدد موعد]')
    .replaceAll('{رابط_الحجز}', v.booking || '')
    .replaceAll('{رابط_القاعة}', v.room || '[رابط القاعة غير متوفر]')
    .replaceAll('{الشركة}', v.company || '');
}
export function waLink(phone, text, mode = 'wa') {
  const p = String(phone || '').replace(/[^\d]/g, '');
  const t = encodeURIComponent(text || '');
  if (mode === 'web') return `https://web.whatsapp.com/send?phone=${p}&text=${t}`;
  if (mode === 'app') return `whatsapp://send?phone=${p}&text=${t}`;
  return `https://wa.me/${p}?text=${t}`;
}
export const displayPhone = (p) => { const d = String(p || ''); return d.startsWith('966') ? `+966 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : d; };

// ---------------- الترتيب والأوزان (اختيارية) ----------------
export function evalPercent(ev, criteria, weighted) {
  const vals = (criteria || []).map((c) => ({ v: Number(ev?.scores?.[c.key] || 0), w: Number(c.weight || 1) })).filter((x) => x.v > 0);
  if (!vals.length) return null;
  if (weighted) { const tw = vals.reduce((s, x) => s + x.w, 0); return Math.round(vals.reduce((s, x) => s + (x.v / 5) * x.w, 0) / tw * 1000) / 10; }
  return Math.round(vals.reduce((s, x) => s + x.v / 5, 0) / vals.length * 1000) / 10;
}
export function finalScore(app, evals, job) {
  const rw = job?.rank_weights || {};
  const committee = evals.length ? Math.round(evals.reduce((s, e) => s + Number(e.total || 0), 0) / evals.length * 10) / 10 : null;
  const comps = [];
  if (rw.enabled) {
    if (app.test_score != null) comps.push([Number(app.test_score), Number(rw.test || 0)]);
    if (app.cv_match != null) comps.push([Number(app.cv_match), Number(rw.cv || 0)]);
    if (committee != null) comps.push([committee, Number(rw.committee || 0)]);
  } else {
    if (app.test_score != null) comps.push([Number(app.test_score), 1]);
    if (committee != null) comps.push([committee, 1]);
  }
  const tw = comps.reduce((s, c) => s + c[1], 0);
  const final = tw ? Math.round(comps.reduce((s, c) => s + c[0] * c[1], 0) / tw * 10) / 10 : null;
  return { committee, final, evalCount: evals.length };
}

// ---------------- ملفات ----------------
export function safeExt(name) { const m = String(name || '').toLowerCase().match(/\.([a-z0-9]{2,5})$/); return m ? m[1] : 'bin'; }
export function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); }
export function fileSize(n) { return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
export async function openSigned(bucket, path, download) {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 600, download ? { download: typeof download === 'string' ? download : true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click();
}
export const initial = (n) => (String(n || '؟').trim()[0] || '؟');

// ---------------- مكونات واجهة ----------------
export function Icon({ name, size = 18, stroke = 1.9, color = 'currentColor', style }) {
  const P = {
    arrowL: <path d="M15 6l-6 6 6 6" />, arrowR: <path d="M9 6l6 6-6 6" />, check: <path d="M5 12l5 5 9-10" />, x: <path d="M6 6l12 12M18 6L6 18" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>, pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>, upload: <><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    download: <><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></>, eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    clock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></>, spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
    wa: <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />, video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></>,
    home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></>, briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>, trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>, gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />, logout: <><path d="M15 12H4" /><path d="M8 8l-4 4 4 4" /><path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />, plus: <path d="M12 5v14M5 12h14" />, trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>, edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>, file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></>, image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></>,
    send: <path d="M20 12L4 4l3 8-3 8z" />, link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">{P[name]}</svg>;
}

export function Logo({ company, sub = 'بوابة التوظيف', to = '/', light }) {
  return (
    <a href={`#${to}`} className="logo" style={light ? { color: '#fff' } : undefined}>
      <img src="data:image/png;base64,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" alt={company || 'شعار الشركة'} className="logo-img" style={{ height: 40, width: 'auto', display: 'block', objectFit: 'contain', ...(light ? { background: '#fff', padding: '5px 8px', borderRadius: 10 } : {}) }} />
      <span style={{ display: 'flex', flexDirection: 'column' }}><span className="logo-name">{company || 'بوابة التوظيف'}</span><span className="logo-sub">{sub}</span></span>
    </a>
  );
}

export const Spinner = ({ label = 'جارٍ التحميل…' }) => <div className="loading"><span className="spinner" />{label}</div>;
export const Pill = ({ status }) => { const s = STATUS[status] || { l: status, c: 'p-gray' }; return <span className={`pill ${s.c}`}>{s.l}</span>; };
export function Toggle({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head"><h3 style={{ fontSize: 18 }}>{title}</h3><button className="btn btn-ghost icon-btn" aria-label="إغلاق" onClick={onClose}><Icon name="x" /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
export function ScoreRing({ value, threshold = 60, size = 170, label = 'الدرجة' }) {
  const r = size / 2 - 14; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, Number(value || 0)));
  const color = v >= threshold ? '#2F6B55' : '#A8412B';
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={v >= threshold ? '#E9F1EC' : '#F3ECE6'} strokeWidth="14" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 1s ease' }} /></svg>
      <div className="in"><span className="mono" style={{ fontSize: size / 4.5, fontWeight: 600 }}>{v}%</span><span className="xs muted">{label}</span></div>
    </div>
  );
}

// إشعارات سريعة
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = '') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="toast-wrap" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}</div></ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

export function usePublicSettings() {
  const [s, setS] = useState({ company_name: '' });
  useEffect(() => { sb.rpc('public_settings').then(({ data }) => data && setS(data)); }, []);
  return s;
}
export function useInterval(fn, ms) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const t = setInterval(() => ref.current(), ms); return () => clearInterval(t); }, [ms]);
}
