/**
 * Release history, newest first. The first entry is the version shown across the platform.
 *
 * Numbering: a small update (fixes, polish, one modest feature) raises the decimal, e.g. 3.1 → 3.2.
 * A major update (a new module, a redesign, a large set of features) raises the whole number and
 * resets the decimal, e.g. 3.2 → 4.0. Keep package.json "version" at `<this version>.0`.
 */
export type ReleaseKind = 'major' | 'minor';

export interface Release {
  version: string;
  /** Riyadh date, YYYY-MM-DD. */
  date: string;
  kind: ReleaseKind;
  ar: string[];
  en: string[];
}

export const RELEASES: Release[] = [
  {
    version: '3.4',
    date: '2026-10-21',
    kind: 'minor',
    ar: ['صورة ووصف يظهران عند مشاركة رابط المنصة في لينكدإن وواتساب وغيرها.', 'بيانات منظمة وخريطة موقع وملف llms.txt لتفهم محركات البحث والذكاء الاصطناعي المنصة بدقة.'],
    en: ['An image and description appear when the platform link is shared on LinkedIn, WhatsApp and elsewhere.', 'Structured data, a sitemap and an llms.txt file so search and AI engines describe the platform accurately.'],
  },
  {
    version: '3.3',
    date: '2026-10-21',
    kind: 'minor',
    ar: ['رقم الإصدار أسفل كل صفحة، وصفحة «ما الجديد» بسجل التحديثات.'],
    en: ['The version number at the bottom of every page, and a "What\'s new" page with the release history.'],
  },
  {
    version: '3.2',
    date: '2026-10-21',
    kind: 'minor',
    ar: ['إصلاح زرّي واتساب ولينكدإن في صفحة «تواصل معنا».'],
    en: ['Fixed the WhatsApp and LinkedIn buttons on the Contact us page.'],
  },
  {
    version: '3.1',
    date: '2026-10-21',
    kind: 'minor',
    ar: ['سطر التصميم والتواصل أسفل كل صفحة.', 'صفحة «تواصل معنا» (مشكلة، تحسين وتطوير، أخرى) تصل رسائلها إلى لوحة الإدارة وتليجرام والبريد.'],
    en: ['Designer credit and contact line at the bottom of every page.', 'A Contact us page (problem, improvement, other) whose messages reach the console, Telegram and e-mail.'],
  },
  {
    version: '3.0',
    date: '2026-10-21',
    kind: 'major',
    ar: [
      'بوت تليجرام خاص لكل شركة يخدم بياناتها فقط، مع صلاحيات ومجموعة للملخص اليومي.',
      'فريق المنصة بأدوار: مالك، مدير، دعم فني، مالية.',
      'إعداد بريد المنصة واختباره من لوحة الإدارة.',
      'إضافة سجل واحد، وتعديل كل البيانات، والأرشفة، والحذف في كل المنصات.',
      'الرسوم المتوقعة لكل منصة على حدة بتفاصيلها.',
      'روابط مشاركة بمدة تختارها أو دائمة، مع عداد تنازلي.',
    ],
    en: [
      'A Telegram bot per company that serves only its data, with permissions and a daily group digest.',
      'Platform team roles: owner, admin, support, finance.',
      'Platform mail set up and tested from the console.',
      'Add a single record, edit every field, archive and delete across all modules.',
      'Expected fees per government platform, with details.',
      'Share links with a chosen duration or permanent, with a countdown.',
    ],
  },
  {
    version: '2.0',
    date: '2026-10-20',
    kind: 'major',
    ar: ['الهوية الزجاجية الجديدة (Liquid Glass) بالوضعين الفاتح والداكن.', 'لوحة إدارة المنصة الكاملة: الشركات، المستخدمون، الاشتراكات، مركز التواصل وسجل النشاط.'],
    en: ['The new Liquid Glass design in light and dark themes.', 'The full platform console: companies, users, subscriptions, communications and the activity log.'],
  },
  {
    version: '1.0',
    date: '2026-10-20',
    kind: 'major',
    ar: ['إطلاق متابعة: رفع القوالب الحكومية الخمسة، محرك القواعد والتنبيهات، ملفات 360°، مركز المستندات، الإشعارات والاشتراكات.'],
    en: ['Mutabaa launch: the five government templates, the rules and alerts engine, 360° profiles, the document hub, notifications and subscriptions.'],
  },
];

export const APP_VERSION = RELEASES[0].version;
