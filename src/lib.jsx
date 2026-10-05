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
      <span className="logo-mark"><i style={{ height: 28, background: '#C8553D' }} /><i style={{ height: 36, background: '#E0A21B' }} /><i style={{ height: 22, background: light ? '#5E8E7F' : '#2F5D50' }} /></span>
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
