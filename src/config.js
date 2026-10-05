// إعدادات الاتصال بـ Supabase — المفتاح العام (publishable) آمن للوضع في الواجهة لأن الصلاحيات محمية بـ RLS
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ypnqoblfdilqlnhphewf.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_H6u6aRciVIMXAIjPuPOUEA_PNpZoZAe';
