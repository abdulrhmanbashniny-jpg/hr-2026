import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TenantSettings } from '@/lib/settings';

const id = () => uuid('id').primaryKey().defaultRandom();
const tenantRef = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

// ───────────────────────── Platform ─────────────────────────

export const roleEnum = pgEnum('member_role', ['owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trialing', 'active', 'past_due', 'canceled', 'expired']);
export const billingCycleEnum = pgEnum('billing_cycle', ['monthly', 'yearly']);
export const promoKindEnum = pgEnum('promo_kind', ['percent', 'fixed', 'trial_extension']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'canceled']);
export const recordStatusEnum = pgEnum('record_status', ['active', 'missing', 'archived']);
export const templateEnum = pgEnum('import_template', ['residents', 'gosi', 'vehicles', 'operating_cards', 'driver_cards']);
export const severityEnum = pgEnum('alert_severity', ['critical', 'high', 'medium', 'low', 'info']);
export const alertStatusEnum = pgEnum('alert_status', ['open', 'acknowledged', 'snoozed', 'resolved']);
export const moduleEnum = pgEnum('alert_module', ['residents', 'gosi', 'fleet', 'operating_cards', 'driver_cards', 'documents', 'cross']);
export const documentStatusEnum = pgEnum('document_status', ['active', 'renewal_in_progress', 'archived']);
export const channelEnum = pgEnum('notification_channel', ['in_app', 'telegram', 'whatsapp', 'email']);
export const deliveryStatusEnum = pgEnum('delivery_status', ['sent', 'failed', 'skipped']);
export const opCardRequirementEnum = pgEnum('op_card_requirement', ['auto', 'required', 'exempt']);

export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  crNumber: text('cr_number'),
  settings: jsonb('settings').$type<TenantSettings>().notNull(),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  /** Platform team role when `isSuperAdmin` (owner · admin · support · finance); null means owner. */
  staffRole: text('staff_role'),
  locale: text('locale').notNull().default('ar'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** Set by the platform admin: the user cannot sign in and existing sessions stop working. */
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('memberships_tenant_user').on(t.tenantId, t.userId)],
);

export const invitations = pgTable('invitations', {
  id: id(),
  tenantId: tenantRef(),
  email: text('email').notNull(),
  role: roleEnum('role').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/**
 * Invitation to the platform team. The role takes effect only when the recipient opens the link
 * (sent to the address), sets a new password and thereby proves they own the e-mail.
 */
export const staffInvites = pgTable('staff_invites', {
  id: id(),
  email: text('email').notNull(),
  role: text('role').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
});

/** Hits for rate limits shared by every server instance (sign-in, reset, invitations). Keys are hashed. */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    id: id(),
    key: text('key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('rate_limit_hits_key_created').on(t.key, t.createdAt)],
);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: createdAt(),
});

export const passwordResets = pgTable('password_resets', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const plans = pgTable('plans', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionAr: text('description_ar').notNull().default(''),
  descriptionEn: text('description_en').notNull().default(''),
  /** Prices are stored in halalas (1 SAR = 100 halalas). */
  priceMonthly: integer('price_monthly').notNull(),
  priceYearly: integer('price_yearly').notNull(),
  maxEmployees: integer('max_employees'),
  maxVehicles: integer('max_vehicles'),
  maxUsers: integer('max_users'),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  tenantId: tenantRef().unique(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  status: subscriptionStatusEnum('status').notNull(),
  billingCycle: billingCycleEnum('billing_cycle').notNull().default('monthly'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  /** A discount code entered at sign-up, applied to the first payment. */
  pendingPromoCodeId: uuid('pending_promo_code_id').references(() => promoCodes.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const promoCodes = pgTable('promo_codes', {
  id: id(),
  code: text('code').notNull().unique(),
  kind: promoKindEnum('kind').notNull(),
  /** percent: 1–100 · fixed: halalas · trial_extension: days */
  value: integer('value').notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  maxRedemptions: integer('max_redemptions'),
  redeemedCount: integer('redeemed_count').notNull().default(0),
  planCodes: jsonb('plan_codes').$type<string[] | null>(),
  isActive: boolean('is_active').notNull().default(true),
  note: text('note'),
  createdAt: createdAt(),
});

export const promoRedemptions = pgTable(
  'promo_redemptions',
  {
    id: id(),
    promoCodeId: uuid('promo_code_id')
      .notNull()
      .references(() => promoCodes.id, { onDelete: 'cascade' }),
    tenantId: tenantRef(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('promo_redemptions_unique').on(t.promoCodeId, t.tenantId)],
);

export const payments = pgTable('payments', {
  id: id(),
  tenantId: tenantRef(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  billingCycle: billingCycleEnum('billing_cycle').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  vat: integer('vat').notNull().default(0),
  total: integer('total').notNull(),
  promoCodeId: uuid('promo_code_id').references(() => promoCodes.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  providerRef: text('provider_ref'),
  checkoutUrl: text('checkout_url'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_tenant_created').on(t.tenantId, t.createdAt)],
);

// ───────────────────────── Government templates ─────────────────────────

const recordLifecycle = () => ({
  recordStatus: recordStatusEnum('record_status').notNull().default('active'),
  missingSince: timestamp('missing_since', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archiveReason: text('archive_reason'),
  lastImportId: uuid('last_import_id'),
  manuallyUpdatedAt: timestamp('manually_updated_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** قالب الجوازات — مقيم (المقيمين النشطين) */
export const residents = pgTable(
  'residents',
  {
    id: id(),
    tenantId: tenantRef(),
    iqamaNumber: text('iqama_number').notNull(),
    name: text('name').notNull(),
    gender: text('gender'),
    nationality: text('nationality'),
    occupation: text('occupation'),
    passportNumber: text('passport_number'),
    passportExpiry: date('passport_expiry'),
    iqamaIssueDate: date('iqama_issue_date'),
    iqamaExpiry: date('iqama_expiry'),
    birthDate: date('birth_date'),
    outsideKingdom: boolean('outside_kingdom').notNull().default(false),
    iqamaExpiryHijri: text('iqama_expiry_hijri'),
    employerNumber: text('employer_number'),
    ...recordLifecycle(),
  },
  (t) => [uniqueIndex('residents_tenant_iqama').on(t.tenantId, t.iqamaNumber)],
);

/** قالب التأمينات الاجتماعية — قائمة المشتركين النشطين */
export const gosiSubscribers = pgTable(
  'gosi_subscribers',
  {
    id: id(),
    tenantId: tenantRef(),
    nationalId: text('national_id').notNull(),
    name: text('name').notNull(),
    nationality: text('nationality'),
    isSaudi: boolean('is_saudi').notNull().default(false),
    gender: text('gender'),
    birthDate: date('birth_date'),
    basicWage: numeric('basic_wage', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    housingAllowance: numeric('housing_allowance', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    commissions: numeric('commissions', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    otherAllowances: numeric('other_allowances', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    totalWage: numeric('total_wage', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    contributoryWage: numeric('contributory_wage', { precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    occupation: text('occupation'),
    joinDate: date('join_date'),
    newSystemEligible: boolean('new_system_eligible').notNull().default(false),
    probationDays: integer('probation_days'),
    probationReviewedAt: timestamp('probation_reviewed_at', { withTimezone: true }),
    ...recordLifecycle(),
  },
  (t) => [uniqueIndex('gosi_tenant_national_id').on(t.tenantId, t.nationalId)],
);

/** قالب المرور — منصة تم (vehicle_list) */
export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    tenantId: tenantRef(),
    sequenceNumber: text('sequence_number').notNull(),
    plateNumber: text('plate_number'),
    registrationType: text('registration_type'),
    branch: text('branch'),
    make: text('make'),
    model: text('model'),
    manufactureYear: integer('manufacture_year'),
    chassisNumber: text('chassis_number'),
    color: text('color'),
    vehicleStatus: text('vehicle_status'),
    ownershipDate: date('ownership_date'),
    ownershipDateHijri: text('ownership_date_hijri'),
    licenseExpiry: date('license_expiry'),
    licenseExpiryHijri: text('license_expiry_hijri'),
    inspectionExpiry: date('inspection_expiry'),
    inspectionExpiryHijri: text('inspection_expiry_hijri'),
    actualUserId: text('actual_user_id'),
    actualUserName: text('actual_user_name'),
    inspectionStatus: text('inspection_status'),
    insuranceStatus: text('insurance_status'),
    restrictionStatus: text('restriction_status'),
    formIssueDate: date('form_issue_date'),
    formIssueDateHijri: text('form_issue_date_hijri'),
    bodyType: text('body_type'),
    operatingCardRequirement: opCardRequirementEnum('operating_card_requirement').notNull().default('auto'),
    ...recordLifecycle(),
  },
  (t) => [uniqueIndex('vehicles_tenant_sequence').on(t.tenantId, t.sequenceNumber)],
);

/** بطاقات التشغيل — منصة لوجستي / هيئة النقل */
export const operatingCards = pgTable(
  'operating_cards',
  {
    id: id(),
    tenantId: tenantRef(),
    cardNumber: text('card_number').notNull(),
    sequenceNumber: text('sequence_number'),
    activity: text('activity'),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    cardStatus: text('card_status'),
    ...recordLifecycle(),
  },
  (t) => [
    uniqueIndex('operating_cards_tenant_card').on(t.tenantId, t.cardNumber),
    index('operating_cards_sequence').on(t.tenantId, t.sequenceNumber),
  ],
);

/** بطاقات السائقين — منصة لوجستي / هيئة النقل */
export const driverCards = pgTable(
  'driver_cards',
  {
    id: id(),
    tenantId: tenantRef(),
    cardNumber: text('card_number').notNull(),
    driverId: text('driver_id').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    activity: text('activity'),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    cardClass: text('card_class'),
    requestStatus: text('request_status'),
    ...recordLifecycle(),
  },
  (t) => [
    uniqueIndex('driver_cards_tenant_card').on(t.tenantId, t.cardNumber),
    index('driver_cards_driver').on(t.tenantId, t.driverId),
  ],
);

export const importBatches = pgTable(
  'import_batches',
  {
    id: id(),
    tenantId: tenantRef(),
    template: templateEnum('template').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size').notNull(),
    rowCount: integer('row_count').notNull().default(0),
    createdCount: integer('created_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    unchangedCount: integer('unchanged_count').notNull().default(0),
    staleCount: integer('stale_count').notNull().default(0),
    conflictCount: integer('conflict_count').notNull().default(0),
    missingCount: integer('missing_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    fileIsStale: boolean('file_is_stale').notNull().default(false),
    report: jsonb('report').$type<import('@/lib/imports/types').ImportReport>().notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    fileDiscardedAt: timestamp('file_discarded_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('import_batches_tenant_created').on(t.tenantId, t.createdAt)],
);

// ───────────────────────── Alerts & notifications ─────────────────────────

export const complianceAlerts = pgTable(
  'compliance_alerts',
  {
    id: id(),
    tenantId: tenantRef(),
    fingerprint: text('fingerprint').notNull(),
    ruleCode: text('rule_code').notNull(),
    module: moduleEnum('module').notNull(),
    severity: severityEnum('severity').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    entityKey: text('entity_key').notNull(),
    entityLabel: text('entity_label').notNull(),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull(),
    detailAr: text('detail_ar').notNull(),
    detailEn: text('detail_en').notNull(),
    dueDate: date('due_date'),
    link: text('link'),
    status: alertStatusEnum('status').notNull().default('open'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedReason: text('resolved_reason'),
  },
  (t) => [
    uniqueIndex('alerts_tenant_fingerprint').on(t.tenantId, t.fingerprint),
    index('alerts_tenant_status').on(t.tenantId, t.status),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    tenantId: tenantRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alertId: uuid('alert_id').references(() => complianceAlerts.id, { onDelete: 'set null' }),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull(),
    bodyAr: text('body_ar').notNull(),
    bodyEn: text('body_en').notNull(),
    link: text('link'),
    severity: severityEnum('severity').notNull().default('info'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_created').on(t.userId, t.createdAt)],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: id(),
    tenantId: tenantRef(),
    dedupeKey: text('dedupe_key').notNull(),
    channel: channelEnum('channel').notNull(),
    recipient: text('recipient').notNull(),
    status: deliveryStatusEnum('status').notNull(),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('deliveries_dedupe').on(t.tenantId, t.dedupeKey, t.channel, t.recipient)],
);

/** Responsible people who receive alerts (may or may not be platform users). */
export const contacts = pgTable('contacts', {
  id: id(),
  tenantId: tenantRef(),
  name: text('name').notNull(),
  jobTitle: text('job_title'),
  phone: text('phone'),
  email: text('email'),
  telegramChatId: text('telegram_chat_id'),
  telegramUsername: text('telegram_username'),
  telegramLinkCode: text('telegram_link_code').unique(),
  /** Link codes are single-use and expire, so a leaked or forgotten link stops working. */
  telegramLinkExpiresAt: timestamp('telegram_link_expires_at', { withTimezone: true }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  modules: jsonb('modules').$type<string[]>().notNull().default([]),
  canRequestDocuments: boolean('can_request_documents').notNull().default(false),
  receiveWeeklyReport: boolean('receive_weekly_report').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

// ───────────────────────── Document hub ─────────────────────────

export const authorities = pgTable('authorities', {
  id: id(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  createdAt: createdAt(),
});

export const documents = pgTable(
  'documents',
  {
    id: id(),
    tenantId: tenantRef(),
    title: text('title').notNull(),
    authorityId: uuid('authority_id').references(() => authorities.id, { onDelete: 'set null' }),
    referenceNumber: text('reference_number'),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    issueDateHijri: text('issue_date_hijri'),
    expiryDateHijri: text('expiry_date_hijri'),
    enteredCalendar: text('entered_calendar').notNull().default('gregorian'),
    alertDays: jsonb('alert_days').$type<number[]>().notNull().default([60, 30, 15, 4]),
    responsibleContactId: uuid('responsible_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    renewalFee: numeric('renewal_fee', { precision: 12, scale: 2, mode: 'number' }),
    fileKey: text('file_key'),
    fileName: text('file_name'),
    fileMime: text('file_mime'),
    fileSize: integer('file_size'),
    externalUrl: text('external_url'),
    notes: text('notes'),
    status: documentStatusEnum('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('documents_tenant_expiry').on(t.tenantId, t.expiryDate)],
);

export const documentBundles = pgTable('document_bundles', {
  id: id(),
  tenantId: tenantRef(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export const documentBundleItems = pgTable(
  'document_bundle_items',
  {
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => documentBundles.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.bundleId, t.documentId] })],
);

export const shareLinks = pgTable('share_links', {
  id: id(),
  tenantId: tenantRef(),
  tokenHash: text('token_hash').notNull().unique(),
  documentIds: jsonb('document_ids').$type<string[]>().notNull(),
  recipient: text('recipient'),
  channel: text('channel'),
  /** Null means the link never expires (it can still be revoked). */
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  accessCount: integer('access_count').notNull().default(0),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/** Document attachments when STORAGE_DRIVER=database (serverless hosts without a writable disk or S3). */
export const storedFiles = pgTable('stored_files', {
  key: text('key').primaryKey(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  data: bytea('data').notNull(),
  createdAt: createdAt(),
});

// ───────────────────────── Platform administration ─────────────────────────

/** Internal notes the platform team keeps about a customer company (never shown to the company). */
export const tenantNotes = pgTable(
  'tenant_notes',
  {
    id: id(),
    tenantId: tenantRef(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('tenant_notes_tenant').on(t.tenantId, t.createdAt)],
);

export const announcementLevelEnum = pgEnum('announcement_level', ['info', 'success', 'warning', 'critical']);

export interface AnnouncementAudience {
  kind: 'all' | 'trialing' | 'active' | 'expired' | 'plan' | 'tenants';
  planIds?: string[];
  tenantIds?: string[];
}

/** Messages from the platform team to subscribers: a banner in the workspace, an in-app notification and/or an e-mail. */
export const announcements = pgTable('announcements', {
  id: id(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  level: announcementLevelEnum('level').notNull().default('info'),
  audience: jsonb('audience').$type<AnnouncementAudience>().notNull(),
  channels: jsonb('channels').$type<('banner' | 'in_app' | 'email')[]>().notNull(),
  link: text('link'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  tenantCount: integer('tenant_count').notNull().default(0),
  userCount: integer('user_count').notNull().default(0),
  emailSent: integer('email_sent').notNull().default(0),
  emailFailed: integer('email_failed').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const announcementDismissals = pgTable(
  'announcement_dismissals',
  {
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.announcementId, t.userId] })],
);

/** Platform-wide configuration edited from the console (e.g. the platform mail server). */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

// ───────────────────────── Contact us ─────────────────────────

export const contactCategoryEnum = pgEnum('contact_category', ['problem', 'improvement', 'other']);
export const contactStatusEnum = pgEnum('contact_status', ['new', 'in_progress', 'closed']);

/** Messages sent from the public "Contact us" page to the platform team. */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: id(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    category: contactCategoryEnum('category').notNull(),
    message: text('message').notNull(),
    status: contactStatusEnum('status').notNull().default('new'),
    /** Set when the sender was signed in. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    /** Hash of the sender's IP, only to limit how often one address can send. */
    ipHash: text('ip_hash'),
    handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('contact_messages_status_created').on(t.status, t.createdAt), index('contact_messages_ip_created').on(t.ipHash, t.createdAt)],
);
