/**
 * Seed engine: platform plans, promo codes, government authorities, a super admin, and a fully
 * populated demo company whose data covers every rule (expired iqamas, passports expiring before the
 * iqama, employees abroad, heavy drivers without cards, vehicles without operating cards…).
 *
 *   npm run db:seed            → seeds once (skips if the demo company exists)
 *   npm run db:seed -- --reset → deletes the demo companies and seeds again
 */
import './load-env';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth/password';
import { addDays, todayRiyadh, toHijri } from '@/lib/dates';
import { dispatchTenant } from '@/lib/notifications/dispatch';
import { syncTenantAlerts } from '@/lib/rules/sync';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { storage } from '@/lib/storage';
import { randomToken } from '@/lib/crypto';
import { closeDb, db } from './index';
import {
  auditLogs,
  authorities,
  contacts,
  documentBundleItems,
  documentBundles,
  documents,
  driverCards,
  gosiSubscribers,
  importBatches,
  memberships,
  operatingCards,
  plans,
  promoCodes,
  residents,
  subscriptions,
  tenants,
  users,
  vehicles,
} from './schema';
import { buildDataset } from './seed-data';
import { samplePdf } from './sample-pdf';

const DEMO_SLUGS = ['demo', 'demo-trial'];

export const GLOBAL_AUTHORITIES: [string, string][] = [
  ['وزارة التجارة', 'Ministry of Commerce'],
  ['وزارة الصناعة والثروة المعدنية', 'Ministry of Industry and Mineral Resources'],
  ['هيئة الزكاة والضريبة والجمارك', 'Zakat, Tax and Customs Authority'],
  ['وزارة الموارد البشرية والتنمية الاجتماعية', 'Ministry of Human Resources and Social Development'],
  ['وزارة البلديات والإسكان', 'Ministry of Municipalities and Housing'],
  ['المديرية العامة للدفاع المدني', 'General Directorate of Civil Defense'],
  ['مجلس الضمان الصحي', 'Council of Health Insurance'],
  ['الغرفة التجارية', 'Chamber of Commerce'],
  ['الهيئة العامة للنقل', 'Transport General Authority'],
  ['المؤسسة العامة للتأمينات الاجتماعية', 'GOSI'],
  ['الهيئة السعودية للمدن الصناعية (مدن)', 'MODON'],
  ['الهيئة العامة للغذاء والدواء', 'Saudi Food and Drug Authority'],
];

async function seedPlatform() {
  const existingPlans = await db.select().from(plans);
  if (!existingPlans.length) {
    await db.insert(plans).values([
      {
        code: 'starter',
        nameAr: 'الأساسية',
        nameEn: 'Starter',
        descriptionAr: 'للمنشآت الصغيرة: الجوازات والتأمينات والمستندات.',
        descriptionEn: 'For small companies: Muqeem, GOSI and documents.',
        priceMonthly: 29900,
        priceYearly: 299000,
        maxEmployees: 50,
        maxVehicles: 10,
        maxUsers: 3,
        features: ['templates', 'documents', 'telegram', 'email'],
        sortOrder: 1,
      },
      {
        code: 'growth',
        nameAr: 'الاحترافية',
        nameEn: 'Growth',
        descriptionAr: 'الأسطول وهيئة النقل والربط المتقاطع والتوقعات المالية.',
        descriptionEn: 'Fleet, TGA cards, cross-checks and fee forecasts.',
        priceMonthly: 69900,
        priceYearly: 699000,
        maxEmployees: 300,
        maxVehicles: 60,
        maxUsers: 10,
        features: ['templates', 'documents', 'telegram', 'email', 'whatsapp', 'cross_rules', 'forecast'],
        sortOrder: 2,
      },
      {
        code: 'enterprise',
        nameAr: 'المؤسسات',
        nameEn: 'Enterprise',
        descriptionAr: 'بلا حدود، SMTP خاص، واتساب API، ودعم أولوية.',
        descriptionEn: 'Unlimited, custom SMTP, WhatsApp API and priority support.',
        priceMonthly: 149900,
        priceYearly: 1499000,
        maxEmployees: null,
        maxVehicles: null,
        maxUsers: null,
        features: ['templates', 'documents', 'telegram', 'email', 'whatsapp', 'cross_rules', 'forecast', 'custom_smtp', 'priority_support'],
        sortOrder: 3,
      },
    ]);
  }

  const existingPromos = await db.select().from(promoCodes);
  if (!existingPromos.length) {
    const now = new Date();
    await db.insert(promoCodes).values([
      { code: 'WELCOME20', kind: 'percent', value: 20, validUntil: new Date(now.getTime() + 180 * 86_400_000), maxRedemptions: 500, note: 'خصم الإطلاق' },
      { code: 'FLEET500', kind: 'fixed', value: 50000, planCodes: ['growth', 'enterprise'], maxRedemptions: 100, note: 'خصم 500 ريال لباقات الأسطول' },
      { code: 'TRIAL14', kind: 'trial_extension', value: 14, maxRedemptions: 1000, note: 'تمديد التجربة 14 يوماً' },
      { code: 'RAMADAN10', kind: 'percent', value: 10, validFrom: new Date(now.getTime() - 90 * 86_400_000), validUntil: new Date(now.getTime() - 30 * 86_400_000), note: 'منتهٍ — للعرض' },
    ]);
  }

  const existingAuth = await db.select().from(authorities);
  if (!existingAuth.length) {
    await db.insert(authorities).values(GLOBAL_AUTHORITIES.map(([nameAr, nameEn]) => ({ tenantId: null, nameAr, nameEn })));
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@mutabaa.local').toLowerCase();
  const [admin] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!admin) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? `Admin-${randomToken(9)}`;
    await db.insert(users).values({ email: adminEmail, name: 'مشرف المنصة', passwordHash: await hashPassword(password), isSuperAdmin: true });
    console.log(`Super admin: ${adminEmail} / ${password}`);
  }
}

async function resetDemo() {
  const demo = await db.select({ id: tenants.id }).from(tenants).where(inArray(tenants.slug, DEMO_SLUGS));
  if (demo.length) {
    const docs = await db.select({ key: documents.fileKey }).from(documents).where(inArray(documents.tenantId, demo.map((d) => d.id)));
    for (const d of docs) if (d.key) await storage().remove(d.key).catch(() => undefined);
    await db.delete(tenants).where(inArray(tenants.id, demo.map((d) => d.id)));
  }
  await db.delete(users).where(inArray(users.email, DEMO_USERS.map((u) => u.email)));
}

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo@2026pass';
const DEMO_USERS = [
  { email: 'owner@demo.mutabaa.local', name: 'عبدالرحمن الشهري', role: 'owner' as const },
  { email: 'gm@demo.mutabaa.local', name: 'خالد العتيبي', role: 'general_manager' as const },
  { email: 'hr@demo.mutabaa.local', name: 'نورة القحطاني', role: 'hr_officer' as const },
  { email: 'fleet@demo.mutabaa.local', name: 'ماجد الدوسري', role: 'fleet_officer' as const },
  { email: 'viewer@demo.mutabaa.local', name: 'سارة الغامدي', role: 'viewer' as const },
];

async function seedDemoCompany() {
  const today = todayRiyadh();
  const [growth] = await db.select().from(plans).where(eq(plans.code, 'growth'));
  const [starter] = await db.select().from(plans).where(eq(plans.code, 'starter'));

  const [tenant] = await db
    .insert(tenants)
    .values({ name: 'مصنع الأفق للصناعات', slug: 'demo', crNumber: '1010987654', settings: DEFAULT_SETTINGS })
    .returning();
  const now = new Date();
  await db.insert(subscriptions).values({
    tenantId: tenant.id,
    planId: growth.id,
    status: 'active',
    billingCycle: 'yearly',
    currentPeriodStart: new Date(now.getTime() - 40 * 86_400_000),
    currentPeriodEnd: new Date(now.getTime() + 325 * 86_400_000),
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const createdUsers = await db.insert(users).values(DEMO_USERS.map((u) => ({ email: u.email, name: u.name, passwordHash }))).returning();
  await db.insert(memberships).values(createdUsers.map((u, i) => ({ tenantId: tenant.id, userId: u.id, role: DEMO_USERS[i].role })));
  const owner = createdUsers[0];

  const data = buildDataset(today);
  const lifecycle = { tenantId: tenant.id, recordStatus: 'active' as const };
  await db.insert(residents).values(data.residents.map((r) => ({ ...r, ...lifecycle })));
  await db.insert(gosiSubscribers).values(data.gosi.map((g) => ({ ...g, ...lifecycle })));
  await db.insert(vehicles).values(
    data.vehicles.map((v) => ({
      ...v,
      ...lifecycle,
      ownershipDateHijri: toHijri(v.ownershipDate),
      licenseExpiryHijri: toHijri(v.licenseExpiry),
      inspectionExpiryHijri: toHijri(v.inspectionExpiry),
      formIssueDateHijri: toHijri(v.formIssueDate),
    })),
  );
  await db.insert(operatingCards).values(data.operatingCards.map((c) => ({ ...c, ...lifecycle })));
  await db.insert(driverCards).values(data.driverCards.map((c) => ({ ...c, ...lifecycle })));

  // One historical import per template, so the import centre has history.
  for (const [template, rows] of [
    ['residents', data.residents.length],
    ['gosi', data.gosi.length],
    ['vehicles', data.vehicles.length],
    ['operating_cards', data.operatingCards.length],
    ['driver_cards', data.driverCards.length],
  ] as const) {
    await db.insert(importBatches).values({
      tenantId: tenant.id,
      template,
      fileName: `${template}-initial.xlsx`,
      fileSize: 9000 + rows * 120,
      rowCount: rows,
      createdCount: rows,
      report: {
        template,
        sheetName: 'seed',
        headerRow: 1,
        matchedColumns: [],
        missingOptionalColumns: [],
        ignoredColumns: [],
        rows,
        created: [],
        updated: [],
        stale: [],
        conflicts: [],
        missing: [],
        errors: [],
        warnings: [],
        fileIsStale: false,
        missingDetectionSkipped: false,
      },
      userId: owner.id,
      fileDiscardedAt: new Date(now.getTime() - 3 * 86_400_000),
      createdAt: new Date(now.getTime() - 3 * 86_400_000),
    });
  }

  // Responsible contacts.
  const [hrContact, fleetContact, financeContact] = await db
    .insert(contacts)
    .values([
      {
        tenantId: tenant.id,
        name: 'نورة القحطاني',
        jobTitle: 'مديرة الموارد البشرية',
        phone: '0500000101',
        email: 'hr.manager@example.com',
        userId: createdUsers[2].id,
        modules: ['residents', 'gosi', 'driver_cards', 'documents', 'cross'],
        canRequestDocuments: true,
        receiveWeeklyReport: true,
        telegramLinkCode: randomToken(12),
      },
      {
        tenantId: tenant.id,
        name: 'ماجد الدوسري',
        jobTitle: 'مسؤول الحركة والأسطول',
        phone: '0500000102',
        email: 'fleet@example.com',
        userId: createdUsers[3].id,
        modules: ['fleet', 'operating_cards', 'driver_cards'],
        canRequestDocuments: true,
        telegramLinkCode: randomToken(12),
      },
      {
        tenantId: tenant.id,
        name: 'فهد السبيعي',
        jobTitle: 'المدير المالي',
        phone: '0500000103',
        email: 'finance@example.com',
        modules: ['documents'],
        canRequestDocuments: false,
        receiveWeeklyReport: true,
        telegramLinkCode: randomToken(12),
      },
    ])
    .returning();

  // Document hub with real (sample) PDF attachments.
  const authRows = await db.select().from(authorities);
  const auth = (ar: string) => authRows.find((a) => a.nameAr === ar)?.id ?? null;
  const docSpecs: { title: string; en: string; authority: string; ref: string; expiry: number; responsible: string; fee: number; alertDays?: number[] }[] = [
    { title: 'السجل التجاري', en: 'Commercial Registration', authority: 'وزارة التجارة', ref: '1010987654', expiry: 45, responsible: financeContact.id, fee: 200 },
    { title: 'الترخيص الصناعي', en: 'Industrial License', authority: 'وزارة الصناعة والثروة المعدنية', ref: 'IND-44120', expiry: 210, responsible: financeContact.id, fee: 0 },
    { title: 'شهادة الزكاة والدخل', en: 'Zakat Certificate', authority: 'هيئة الزكاة والضريبة والجمارك', ref: 'ZK-2026-7781', expiry: 12, responsible: financeContact.id, fee: 0 },
    { title: 'شهادة السعودة', en: 'Saudization Certificate', authority: 'وزارة الموارد البشرية والتنمية الاجتماعية', ref: 'NT-55410', expiry: -5, responsible: hrContact.id, fee: 0 },
    { title: 'رخصة البلدية', en: 'Municipality License', authority: 'وزارة البلديات والإسكان', ref: 'BL-90312', expiry: 75, responsible: financeContact.id, fee: 1500 },
    { title: 'شهادة الدفاع المدني', en: 'Civil Defense Certificate', authority: 'المديرية العامة للدفاع المدني', ref: 'CD-11873', expiry: 25, responsible: fleetContact.id, fee: 600, alertDays: [30, 15, 4] },
    { title: 'بوليصة التأمين الطبي الموحدة', en: 'Unified Medical Insurance Policy', authority: 'مجلس الضمان الصحي', ref: 'MED-2026-031', expiry: 150, responsible: hrContact.id, fee: 0 },
    { title: 'اشتراك الغرفة التجارية', en: 'Chamber of Commerce Membership', authority: 'الغرفة التجارية', ref: 'CH-88213', expiry: 3, responsible: financeContact.id, fee: 1100 },
  ];
  const docRows: (typeof documents.$inferSelect)[] = [];
  for (const spec of docSpecs) {
    const id = randomUUID();
    const key = `${tenant.id}/${randomUUID()}`;
    const bytes = samplePdf([spec.en, `Reference: ${spec.ref}`, `Expires: ${addDays(today, spec.expiry)}`, 'Mutabaa demo document — sample attachment']);
    await storage().put(key, bytes, 'application/pdf');
    const expiryDate = addDays(today, spec.expiry);
    const issueDate = addDays(expiryDate, -365);
    const [row] = await db
      .insert(documents)
      .values({
        id,
        tenantId: tenant.id,
        title: spec.title,
        authorityId: auth(spec.authority),
        referenceNumber: spec.ref,
        issueDate,
        expiryDate,
        issueDateHijri: toHijri(issueDate),
        expiryDateHijri: toHijri(expiryDate),
        alertDays: spec.alertDays ?? [60, 30, 15, 4],
        responsibleContactId: spec.responsible,
        renewalFee: spec.fee || null,
        fileKey: key,
        fileName: `${spec.en.replace(/\s+/g, '-').toLowerCase()}.pdf`,
        fileMime: 'application/pdf',
        fileSize: bytes.byteLength,
        createdBy: owner.id,
      })
      .returning();
    docRows.push(row);
  }
  const byTitle = (t: string) => docRows.find((d) => d.title === t)!.id;
  const [tender] = await db
    .insert(documentBundles)
    .values({ tenantId: tenant.id, name: 'حقيبة التقديم على المناقصات', description: 'المستندات المطلوبة في أغلب المنافسات الحكومية', createdBy: owner.id })
    .returning();
  await db.insert(documentBundleItems).values(
    ['السجل التجاري', 'شهادة الزكاة والدخل', 'شهادة السعودة', 'اشتراك الغرفة التجارية'].map((t) => ({ bundleId: tender.id, documentId: byTitle(t) })),
  );
  const [bank] = await db.insert(documentBundles).values({ tenantId: tenant.id, name: 'حقيبة فتح حساب بنكي', createdBy: owner.id }).returning();
  await db.insert(documentBundleItems).values(['السجل التجاري', 'الترخيص الصناعي'].map((t) => ({ bundleId: bank.id, documentId: byTitle(t) })));

  await db.insert(auditLogs).values([
    { tenantId: tenant.id, userId: owner.id, action: 'tenant.created', entityType: 'tenant', entityId: tenant.id, summary: 'إنشاء مساحة عمل الشركة' },
    { tenantId: tenant.id, userId: createdUsers[2].id, action: 'import.applied', entityType: 'import', summary: `رفع ملف المقيمين النشطين (${data.residents.length} سجل)` },
    { tenantId: tenant.id, userId: createdUsers[3].id, action: 'import.applied', entityType: 'import', summary: `رفع ملف المركبات (${data.vehicles.length} مركبة)` },
  ]);

  const sync = await syncTenantAlerts(tenant.id, today);
  await dispatchTenant(tenant.id, today, { external: false });

  // A second company on a trial that is about to end, to show the trial banner and admin views.
  const [trial] = await db
    .insert(tenants)
    .values({ name: 'شركة النخبة للنقل', slug: 'demo-trial', crNumber: '2050112233', settings: DEFAULT_SETTINGS })
    .returning();
  await db.insert(subscriptions).values({ tenantId: trial.id, planId: starter.id, status: 'trialing', trialEndsAt: new Date(now.getTime() + 2 * 86_400_000) });
  await db.insert(memberships).values({ tenantId: trial.id, userId: owner.id, role: 'owner' });

  console.log(`Demo company "${tenant.name}" seeded: ${data.residents.length} residents, ${data.gosi.length} GOSI, ${data.vehicles.length} vehicles, ${data.operatingCards.length} operating cards, ${data.driverCards.length} driver cards, ${docRows.length} documents, ${sync.total} alerts.`);
  console.log(`Demo users (password ${DEMO_PASSWORD}): ${DEMO_USERS.map((u) => `${u.email} [${u.role}]`).join(', ')}`);
}

async function main() {
  const reset = process.argv.includes('--reset');
  await seedPlatform();
  const [existing] = await db.select().from(tenants).where(eq(tenants.slug, 'demo'));
  if (existing && !reset) {
    console.log('Demo company already exists. Run with --reset to recreate it.');
    return;
  }
  if (reset) await resetDemo();
  await seedDemoCompany();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
