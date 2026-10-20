import type { TemplateKey } from './types';

export type FieldType = 'text' | 'id' | 'date' | 'hijriDate' | 'bool' | 'int' | 'money' | 'cardNumber';

export interface FieldDef {
  /** Property name on the database row. */
  field: string;
  /** Column headers as exported by the government platform (first is canonical). */
  headers: string[];
  type: FieldType;
  required?: boolean;
  /** For hijriDate: the column that stores the original Hijri string. */
  hijriField?: string;
  /** Label used in reports and the UI. */
  labelAr: string;
  labelEn: string;
}

export interface TemplateDef {
  key: TemplateKey;
  nameAr: string;
  nameEn: string;
  sourceAr: string;
  sourceEn: string;
  sheetHint: string;
  /** The field that uniquely identifies a record in this template. */
  keyField: string;
  /** Field used as a human label in reports. */
  labelFields: string[];
  /** Expiry dates compared to decide whether an uploaded row is newer or older than the stored one. */
  trackedDates: string[];
  /** Companion fields that move together with a tracked date (e.g. the Hijri text of that date). */
  companions: Record<string, string>;
  fields: FieldDef[];
  /** Columns that must be present for the file to be accepted as this template. */
  requiredHeaders: string[];
  validateKey: (key: string) => { ok: boolean; warning?: string; error?: string };
}

const tenDigits = (label: string, prefixes: string[]) => (key: string) => {
  if (!/^\d{10}$/.test(key)) return { ok: false, error: `${label} يجب أن يتكون من 10 أرقام (${key})` };
  if (prefixes.length && !prefixes.some((p) => key.startsWith(p)))
    return { ok: true, warning: `${label} ${key} لا يبدأ بـ ${prefixes.join(' أو ')}` };
  return { ok: true };
};

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  residents: {
    key: 'residents',
    nameAr: 'المقيمين النشطين',
    nameEn: 'Active residents',
    sourceAr: 'الجوازات — منصة مقيم',
    sourceEn: 'Jawazat — Muqeem',
    sheetHint: 'المقيمين النشطين',
    keyField: 'iqamaNumber',
    labelFields: ['name'],
    trackedDates: ['iqamaExpiry', 'passportExpiry'],
    companions: { iqamaExpiry: 'iqamaExpiryHijri' },
    requiredHeaders: ['رقم الاقامة', 'الاسم', 'تاريخ انتهاء الاقامة'],
    validateKey: tenDigits('رقم الإقامة', ['2']),
    fields: [
      { field: 'iqamaNumber', headers: ['رقم الاقامة', 'رقم الإقامة'], type: 'id', required: true, labelAr: 'رقم الإقامة', labelEn: 'Iqama number' },
      { field: 'name', headers: ['الاسم'], type: 'text', required: true, labelAr: 'الاسم', labelEn: 'Name' },
      { field: 'gender', headers: ['الجنس'], type: 'text', labelAr: 'الجنس', labelEn: 'Gender' },
      { field: 'nationality', headers: ['الجنسية'], type: 'text', labelAr: 'الجنسية', labelEn: 'Nationality' },
      { field: 'occupation', headers: ['المهنة'], type: 'text', labelAr: 'المهنة', labelEn: 'Occupation' },
      { field: 'passportNumber', headers: ['رقم الجواز'], type: 'text', labelAr: 'رقم الجواز', labelEn: 'Passport number' },
      { field: 'passportExpiry', headers: ['تاريخ انتهاء الجواز'], type: 'date', labelAr: 'انتهاء الجواز', labelEn: 'Passport expiry' },
      { field: 'iqamaIssueDate', headers: ['تاريخ اصدار الاقامة', 'تاريخ إصدار الإقامة'], type: 'date', labelAr: 'إصدار الإقامة', labelEn: 'Iqama issue date' },
      { field: 'iqamaExpiry', headers: ['تاريخ انتهاء الاقامة', 'تاريخ انتهاء الإقامة'], type: 'date', labelAr: 'انتهاء الإقامة', labelEn: 'Iqama expiry' },
      { field: 'birthDate', headers: ['تاريخ الميلاد'], type: 'date', labelAr: 'تاريخ الميلاد', labelEn: 'Birth date' },
      { field: 'outsideKingdom', headers: ['خارج المملكه', 'خارج المملكة'], type: 'bool', labelAr: 'خارج المملكة', labelEn: 'Outside the Kingdom' },
      { field: 'iqamaExpiryHijri', headers: ['تاريخ انتهاء الاقامة بالهجري', 'تاريخ انتهاء الإقامة بالهجري'], type: 'text', labelAr: 'انتهاء الإقامة (هجري)', labelEn: 'Iqama expiry (Hijri)' },
      { field: 'employerNumber', headers: ['رقم صاحب العمل'], type: 'id', labelAr: 'رقم صاحب العمل', labelEn: 'Employer number' },
    ],
  },
  gosi: {
    key: 'gosi',
    nameAr: 'قائمة المشتركين النشطين',
    nameEn: 'Active subscribers',
    sourceAr: 'التأمينات الاجتماعية — GOSI',
    sourceEn: 'GOSI',
    sheetHint: 'قائمة المشتركين النشطين',
    keyField: 'nationalId',
    labelFields: ['name'],
    trackedDates: [],
    companions: {},
    requiredHeaders: ['اسم المشترك', 'رقم الهوية', 'الاجر الخاضع للاشتراك'],
    validateKey: tenDigits('رقم الهوية', ['1', '2']),
    fields: [
      { field: 'name', headers: ['اسم المشترك'], type: 'text', required: true, labelAr: 'اسم المشترك', labelEn: 'Name' },
      { field: 'nationalId', headers: ['رقم الهوية'], type: 'id', required: true, labelAr: 'رقم الهوية', labelEn: 'National ID' },
      { field: 'nationality', headers: ['الجنسية'], type: 'text', labelAr: 'الجنسية', labelEn: 'Nationality' },
      { field: 'gender', headers: ['الجنس'], type: 'text', labelAr: 'الجنس', labelEn: 'Gender' },
      { field: 'birthDate', headers: ['تاريخ الميلاد'], type: 'date', labelAr: 'تاريخ الميلاد', labelEn: 'Birth date' },
      { field: 'basicWage', headers: ['الأجر الأساسي', 'الاجر الاساسي'], type: 'money', labelAr: 'الأجر الأساسي', labelEn: 'Basic wage' },
      { field: 'housingAllowance', headers: ['السكن'], type: 'money', labelAr: 'السكن', labelEn: 'Housing' },
      { field: 'commissions', headers: ['العمولات'], type: 'money', labelAr: 'العمولات', labelEn: 'Commissions' },
      { field: 'otherAllowances', headers: ['البدلات الأخرى'], type: 'money', labelAr: 'البدلات الأخرى', labelEn: 'Other allowances' },
      { field: 'totalWage', headers: ['إجمالي الأجر'], type: 'money', labelAr: 'إجمالي الأجر', labelEn: 'Total wage' },
      { field: 'contributoryWage', headers: ['الاجر الخاضع للاشتراك', 'الأجر الخاضع للاشتراك'], type: 'money', labelAr: 'الأجر الخاضع للاشتراك', labelEn: 'Contributory wage' },
      { field: 'occupation', headers: ['المهنة'], type: 'text', labelAr: 'المهنة', labelEn: 'Occupation' },
      { field: 'joinDate', headers: ['تاريخ الإلتحاق', 'تاريخ الالتحاق'], type: 'date', labelAr: 'تاريخ الالتحاق', labelEn: 'Join date' },
      { field: 'newSystemEligible', headers: ['الاهلية لنظام التأمينات الاجتماعية 1445هـ', 'الأهلية لنظام التأمينات الاجتماعية 1445هـ'], type: 'bool', labelAr: 'أهلية نظام 1445هـ', labelEn: '1445H system eligibility' },
    ],
  },
  vehicles: {
    key: 'vehicles',
    nameAr: 'قائمة المركبات',
    nameEn: 'Vehicle list',
    sourceAr: 'المرور — منصة تم',
    sourceEn: 'Traffic — Tamm',
    sheetHint: 'vehicle_list',
    keyField: 'sequenceNumber',
    labelFields: ['plateNumber', 'make', 'model'],
    trackedDates: ['licenseExpiry', 'inspectionExpiry'],
    companions: { licenseExpiry: 'licenseExpiryHijri', inspectionExpiry: 'inspectionExpiryHijri' },
    requiredHeaders: ['رقم اللوحة', 'الرقم التسلسلي', 'تاريخ انتهاء رخصة السير'],
    validateKey: (key) => (/^\d{6,12}$/.test(key) ? { ok: true } : { ok: false, error: `الرقم التسلسلي غير صالح (${key})` }),
    fields: [
      { field: 'plateNumber', headers: ['رقم اللوحة'], type: 'text', labelAr: 'رقم اللوحة', labelEn: 'Plate' },
      { field: 'registrationType', headers: ['نوع التسجيل'], type: 'text', labelAr: 'نوع التسجيل', labelEn: 'Registration type' },
      { field: 'branch', headers: ['الفرع'], type: 'text', labelAr: 'الفرع', labelEn: 'Branch' },
      { field: 'make', headers: ['الماركة'], type: 'text', labelAr: 'الماركة', labelEn: 'Make' },
      { field: 'model', headers: ['الطراز'], type: 'text', labelAr: 'الطراز', labelEn: 'Model' },
      { field: 'manufactureYear', headers: ['سنة الصنع'], type: 'int', labelAr: 'سنة الصنع', labelEn: 'Year' },
      { field: 'sequenceNumber', headers: ['الرقم التسلسلي'], type: 'id', required: true, labelAr: 'الرقم التسلسلي', labelEn: 'Sequence number' },
      { field: 'chassisNumber', headers: ['رقم الهيكل'], type: 'text', labelAr: 'رقم الهيكل', labelEn: 'Chassis (VIN)' },
      { field: 'color', headers: ['اللون الأساسي'], type: 'text', labelAr: 'اللون', labelEn: 'Colour' },
      { field: 'vehicleStatus', headers: ['وضع المركبة'], type: 'text', labelAr: 'وضع المركبة', labelEn: 'Vehicle status' },
      { field: 'ownershipDate', headers: ['تاريخ الملكية'], type: 'hijriDate', hijriField: 'ownershipDateHijri', labelAr: 'تاريخ الملكية', labelEn: 'Ownership date' },
      { field: 'licenseExpiry', headers: ['تاريخ انتهاء رخصة السير'], type: 'hijriDate', hijriField: 'licenseExpiryHijri', labelAr: 'انتهاء رخصة السير', labelEn: 'Registration expiry' },
      { field: 'inspectionExpiry', headers: ['تاريخ انتهاء الفحص'], type: 'hijriDate', hijriField: 'inspectionExpiryHijri', labelAr: 'انتهاء الفحص', labelEn: 'Inspection expiry' },
      { field: 'actualUserId', headers: ['رقم هوية المستخدم الفعلي'], type: 'id', labelAr: 'هوية المستخدم الفعلي', labelEn: 'Actual user ID' },
      { field: 'actualUserName', headers: ['اسم المستخدم الفعلي'], type: 'text', labelAr: 'المستخدم الفعلي', labelEn: 'Actual user' },
      { field: 'inspectionStatus', headers: ['حالة الفحص'], type: 'text', labelAr: 'حالة الفحص', labelEn: 'Inspection status' },
      { field: 'insuranceStatus', headers: ['حالة التأمين'], type: 'text', labelAr: 'حالة التأمين', labelEn: 'Insurance status' },
      { field: 'restrictionStatus', headers: ['حالة التحفظ'], type: 'text', labelAr: 'حالة التحفظ', labelEn: 'Restriction status' },
      { field: 'formIssueDate', headers: ['تاريخ إصدار الاستمارة', 'تاريخ اصدار الاستمارة'], type: 'hijriDate', hijriField: 'formIssueDateHijri', labelAr: 'إصدار الاستمارة', labelEn: 'Registration issue date' },
      { field: 'bodyType', headers: ['نوع الهيكل'], type: 'text', labelAr: 'نوع الهيكل', labelEn: 'Body type' },
    ],
  },
  operating_cards: {
    key: 'operating_cards',
    nameAr: 'بطاقات التشغيل',
    nameEn: 'Operating cards',
    sourceAr: 'هيئة النقل — منصة لوجستي',
    sourceEn: 'Transport General Authority — Logisti',
    sheetHint: 'بطاقات التشغيل',
    keyField: 'cardNumber',
    labelFields: ['cardNumber'],
    trackedDates: ['expiryDate'],
    companions: {},
    requiredHeaders: ['رقم البطاقة', 'الرقم التسلسلي', 'تاريخ الانتهاء', 'الحالة'],
    validateKey: (key) => (key.length >= 4 ? { ok: true } : { ok: false, error: `رقم البطاقة غير صالح (${key})` }),
    fields: [
      { field: 'cardNumber', headers: ['رقم البطاقة'], type: 'cardNumber', required: true, labelAr: 'رقم البطاقة', labelEn: 'Card number' },
      { field: 'sequenceNumber', headers: ['الرقم التسلسلي'], type: 'id', labelAr: 'الرقم التسلسلي', labelEn: 'Vehicle sequence number' },
      { field: 'activity', headers: ['النشاط'], type: 'text', labelAr: 'النشاط', labelEn: 'Activity' },
      { field: 'issueDate', headers: ['تاريخ الإصدار', 'تاريخ الاصدار'], type: 'date', labelAr: 'تاريخ الإصدار', labelEn: 'Issue date' },
      { field: 'expiryDate', headers: ['تاريخ الانتهاء'], type: 'date', labelAr: 'تاريخ الانتهاء', labelEn: 'Expiry date' },
      { field: 'cardStatus', headers: ['الحالة'], type: 'text', labelAr: 'الحالة', labelEn: 'Status' },
    ],
  },
  driver_cards: {
    key: 'driver_cards',
    nameAr: 'بطاقات السائقين',
    nameEn: 'Driver cards',
    sourceAr: 'هيئة النقل — منصة لوجستي',
    sourceEn: 'Transport General Authority — Logisti',
    sheetHint: 'بطاقات السائقين',
    keyField: 'cardNumber',
    labelFields: ['firstName', 'lastName'],
    trackedDates: ['expiryDate'],
    companions: {},
    requiredHeaders: ['هوية السائق', 'رقم البطاقة', 'تاريخ الانتهاء'],
    validateKey: (key) => (key.length >= 4 ? { ok: true } : { ok: false, error: `رقم البطاقة غير صالح (${key})` }),
    fields: [
      { field: 'driverId', headers: ['هوية السائق'], type: 'id', required: true, labelAr: 'هوية السائق', labelEn: 'Driver ID' },
      { field: 'firstName', headers: ['الاسم الأول', 'الاسم الاول'], type: 'text', labelAr: 'الاسم الأول', labelEn: 'First name' },
      { field: 'lastName', headers: ['اسم العائلة'], type: 'text', labelAr: 'اسم العائلة', labelEn: 'Family name' },
      { field: 'cardNumber', headers: ['رقم البطاقة'], type: 'cardNumber', required: true, labelAr: 'رقم البطاقة', labelEn: 'Card number' },
      { field: 'activity', headers: ['النشاط'], type: 'text', labelAr: 'النشاط', labelEn: 'Activity' },
      { field: 'issueDate', headers: ['تاريخ الإصدار', 'تاريخ الاصدار'], type: 'date', labelAr: 'تاريخ الإصدار', labelEn: 'Issue date' },
      { field: 'expiryDate', headers: ['تاريخ الانتهاء'], type: 'date', labelAr: 'تاريخ الانتهاء', labelEn: 'Expiry date' },
      { field: 'cardClass', headers: ['تصنيف البطاقة'], type: 'text', labelAr: 'تصنيف البطاقة', labelEn: 'Card class' },
      { field: 'requestStatus', headers: ['حالة الطلب'], type: 'text', labelAr: 'حالة الطلب', labelEn: 'Request status' },
    ],
  },
};

export function fieldLabel(template: TemplateKey, field: string, locale: 'ar' | 'en'): string {
  const def = TEMPLATES[template].fields.find((f) => f.field === field || f.hijriField === field);
  if (!def) return field;
  return locale === 'ar' ? def.labelAr : def.labelEn;
}
