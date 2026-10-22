import { waNumber } from '@/lib/phone';

export function whatsappLink(phoneE164: string, text: string): string {
  return `https://wa.me/${waNumber(phoneE164)}?text=${encodeURIComponent(text)}`;
}

export function inquiryMessage(locale: 'ar' | 'en', input: { name: string; code: string; profileUrl: string }): string {
  return locale === 'ar'
    ? `السلام عليكم ${input.name}،\nوصلت لملفك عبر منصة معلمي الدهانات (رقم العضوية ${input.code}).\nأرغب بالاستفسار عن خدمات الدهان لمشروعي.\n${input.profileUrl}`
    : `Hello ${input.name},\nI found your profile on Paint Masters (member ${input.code}).\nI'd like to ask about painting work for my project.\n${input.profileUrl}`;
}
