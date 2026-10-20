import { z } from 'zod';

export const DEFAULT_HEAVY_DRIVER_OCCUPATIONS = [
  'سائق شاحنة ثقيلة',
  'سائق شاحنة',
  'سائق نقل ثقيل',
  'سائق معدات ثقيلة',
  'سائق صهريج',
  'سائق حافلة',
  'سائق تريلا',
];
export const DEFAULT_EXCLUDED_DRIVER_OCCUPATIONS = ['رافعة شوكية', 'سائق خاص', 'سائق سيارة خفيفة'];
export const DEFAULT_OPERATING_CARD_REGISTRATION_TYPES = ['نقل خاص', 'نقل عام'];
export const DEFAULT_LIGHT_VEHICLE_KEYWORDS = ['بكب', 'بيك اب', 'ونيت', 'نصف نقل', 'خفيفة', 'سيدان', 'جيب', 'ستيشن', 'هاتشباك', 'دباب'];

export const smtpSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string(),
  passwordEnc: z.string().nullable(),
  fromName: z.string(),
  fromEmail: z.string(),
});

const whatsappSchema = z.object({
  mode: z.enum(['deeplink', 'cloud_api', 'webhook']),
  cloudPhoneNumberId: z.string(),
  cloudTokenEnc: z.string().nullable(),
  cloudTemplateName: z.string(),
  cloudTemplateLang: z.string(),
  webhookUrl: z.string(),
  webhookAuthHeaderEnc: z.string().nullable(),
});

const telegramSchema = z.object({
  /** Use the company's own bot instead of the shared platform bot. */
  enabled: z.boolean(),
  botTokenEnc: z.string().nullable(),
  botUsername: z.string(),
  botName: z.string(),
  webhookSecret: z.string(),
  /** A group the bot posts the daily digest to (add the bot to the group and send /chatid). */
  groupChatId: z.string(),
  allowSummary: z.boolean(),
  allowAlerts: z.boolean(),
  allowDocuments: z.boolean(),
  /** "Renewed" and "Snooze" buttons on alert messages. */
  allowActions: z.boolean(),
  connectedAt: z.string().nullable(),
});

export const tenantSettingsSchema = z.object({
  templateAlertDays: z.array(z.number().int().min(0).max(365)).min(1).max(8),
  probationDays: z.union([z.literal(90), z.literal(180)]),
  probationAlertLeadDays: z.number().int().min(1).max(60),
  saudiMinContributoryWage: z.number().min(0),
  heavyDriverOccupations: z.array(z.string().min(1)).max(50),
  excludedDriverOccupations: z.array(z.string().min(1)).max(50),
  operatingCardRegistrationTypes: z.array(z.string().min(1)).max(20),
  lightVehicleKeywords: z.array(z.string().min(1)).max(50),
  maxVehiclesPerUser: z.number().int().min(1).max(20),
  seniorAge: z.number().int().min(40).max(80),
  fees: z.object({
    iqamaRenewal: z.number().min(0),
    workPermit: z.number().min(0),
    operatingCard: z.number().min(0),
    driverCard: z.number().min(0),
    inspection: z.number().min(0),
    vehicleLicense: z.number().min(0),
  }),
  gosi: z.object({
    saudiEmployerPct: z.number().min(0).max(100),
    saudiEmployeePct: z.number().min(0).max(100),
    saudiNewEmployerPct: z.number().min(0).max(100),
    saudiNewEmployeePct: z.number().min(0).max(100),
    nonSaudiEmployerPct: z.number().min(0).max(100),
    maxContributoryWage: z.number().min(0),
  }),
  eosWageBasis: z.enum(['basic_housing', 'total']),
  smtp: smtpSchema,
  whatsapp: whatsappSchema,
  telegram: telegramSchema,
  weeklyReportDay: z.number().int().min(0).max(6),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

export const DEFAULT_SETTINGS: TenantSettings = {
  templateAlertDays: [60, 30, 7, 4],
  probationDays: 90,
  probationAlertLeadDays: 15,
  saudiMinContributoryWage: 4000,
  heavyDriverOccupations: DEFAULT_HEAVY_DRIVER_OCCUPATIONS,
  excludedDriverOccupations: DEFAULT_EXCLUDED_DRIVER_OCCUPATIONS,
  operatingCardRegistrationTypes: DEFAULT_OPERATING_CARD_REGISTRATION_TYPES,
  lightVehicleKeywords: DEFAULT_LIGHT_VEHICLE_KEYWORDS,
  maxVehiclesPerUser: 1,
  seniorAge: 60,
  // Average government fees in SAR — editable per company from Settings → Rules & fees.
  fees: {
    iqamaRenewal: 650,
    workPermit: 9600,
    operatingCard: 100,
    driverCard: 100,
    inspection: 115,
    vehicleLicense: 100,
  },
  // Contribution rates in percent of the contributory wage. "New" applies to Saudis marked eligible
  // under the 1445H Social Insurance Law; adjust here when GOSI publishes the next annual step.
  gosi: {
    saudiEmployerPct: 11.75,
    saudiEmployeePct: 9.75,
    saudiNewEmployerPct: 12.25,
    saudiNewEmployeePct: 10.25,
    nonSaudiEmployerPct: 2,
    maxContributoryWage: 45000,
  },
  eosWageBasis: 'basic_housing',
  smtp: { enabled: false, host: '', port: 587, secure: false, user: '', passwordEnc: null, fromName: '', fromEmail: '' },
  whatsapp: {
    mode: 'deeplink',
    cloudPhoneNumberId: '',
    cloudTokenEnc: null,
    cloudTemplateName: '',
    cloudTemplateLang: 'ar',
    webhookUrl: '',
    webhookAuthHeaderEnc: null,
  },
  telegram: {
    enabled: false,
    botTokenEnc: null,
    botUsername: '',
    botName: '',
    webhookSecret: '',
    groupChatId: '',
    allowSummary: true,
    allowAlerts: true,
    allowDocuments: true,
    allowActions: true,
    connectedAt: null,
  },
  weeklyReportDay: 0,
};

/** Merges stored (possibly older-shaped) settings over the defaults so new keys always exist. */
export function resolveSettings(stored: Partial<TenantSettings> | null | undefined): TenantSettings {
  const s = stored ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    fees: { ...DEFAULT_SETTINGS.fees, ...(s.fees ?? {}) },
    gosi: { ...DEFAULT_SETTINGS.gosi, ...(s.gosi ?? {}) },
    smtp: { ...DEFAULT_SETTINGS.smtp, ...(s.smtp ?? {}) },
    whatsapp: { ...DEFAULT_SETTINGS.whatsapp, ...(s.whatsapp ?? {}) },
    telegram: { ...DEFAULT_SETTINGS.telegram, ...(s.telegram ?? {}) },
  };
}
