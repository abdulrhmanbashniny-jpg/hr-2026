// إعدادات الاتصال بـ Supabase — المفتاح العام (publishable) آمن للوضع في الواجهة لأن الصلاحيات محمية بـ RLS
// القيم تُقرأ من متغيرات البيئة (VITE_SUPABASE_URL و VITE_SUPABASE_KEY) — انظر .env.example
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
