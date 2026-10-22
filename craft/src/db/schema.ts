import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { InvoiceExtraction } from '@/lib/invoices/types';
import type { RiskReason } from '@/lib/fraud/types';
import type { IncentiveResult } from '@/lib/incentives/engine';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'number' });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

// ───────────────────────── Enums ─────────────────────────

export const userRoleEnum = pgEnum('user_role', ['craftsman', 'reviewer', 'admin', 'super_admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended']);
export const tierEnum = pgEnum('craftsman_tier', ['A', 'B', 'C']);
export const availabilityEnum = pgEnum('availability', ['available', 'busy', 'away']);
export const checkStatusEnum = pgEnum('check_status', ['unverified', 'pending', 'verified', 'rejected']);
export const documentKindEnum = pgEnum('document_kind', ['national_id', 'freelance_license', 'insurance', 'other']);
export const mediaKindEnum = pgEnum('media_kind', ['image', 'video']);
export const mediaRoleEnum = pgEnum('media_role', ['before', 'after', 'gallery']);
export const projectVerificationEnum = pgEnum('project_verification', ['self', 'field_verified']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['processing', 'pending', 'flagged', 'approved', 'rejected']);
export const qrSignatureEnum = pgEnum('qr_signature', ['absent', 'unsigned', 'valid', 'invalid']);
export const ledgerKindEnum = pgEnum('ledger_kind', [
  'invoice',
  'welcome_bonus',
  'referral_bonus',
  'commission_l1',
  'commission_l2',
  'redemption',
  'redemption_refund',
  'adjustment',
]);
export const referralStatusEnum = pgEnum('referral_status', ['pending', 'activated', 'held', 'rejected']);
export const incentiveScopeEnum = pgEnum('incentive_scope', ['national', 'region', 'city']);
export const incentiveTargetEnum = pgEnum('incentive_target', ['invoice', 'referral_bonus', 'commission']);
export const rewardKindEnum = pgEnum('reward_kind', ['fuel_voucher', 'supplier_discount', 'tool', 'cash_out', 'other']);
export const redemptionStatusEnum = pgEnum('redemption_status', ['requested', 'fulfilled', 'rejected', 'canceled']);
export const leadChannelEnum = pgEnum('lead_channel', ['profile_view', 'whatsapp', 'call', 'vcard', 'estimate', 'share']);
export const leadSourceEnum = pgEnum('lead_source', ['qr', 'nfc', 'search', 'link', 'wallet', 'direct']);
export const signalEventEnum = pgEnum('signal_event', ['signup', 'login', 'invoice', 'referral']);
export const fraudSubjectEnum = pgEnum('fraud_subject', ['craftsman', 'invoice', 'referral']);
export const fraudStatusEnum = pgEnum('fraud_status', ['open', 'dismissed', 'confirmed']);
export const uploadPurposeEnum = pgEnum('upload_purpose', ['portfolio', 'invoice', 'document', 'avatar', 'product']);
export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);
export const productCategoryEnum = pgEnum('product_category', ['interior', 'exterior', 'primer', 'waterproofing', 'decorative', 'wood_metal']);
export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'uploaded', 'attached']);

// ───────────────────────── Identity ─────────────────────────

export const users = pgTable('users', {
  id: id(),
  /** E.164, e.g. +966512345678. The phone number is the identity. */
  phone: text('phone').notNull().unique(),
  name: text('name'),
  role: userRoleEnum('role').notNull().default('craftsman'),
  status: userStatusEnum('status').notNull().default('active'),
  locale: text('locale').notNull().default('ar'),
  lastLoginAt: ts('last_login_at'),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    deviceId: text('device_id'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: id(),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_phone_idx').on(t.phone, t.createdAt)],
);

export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    id: id(),
    key: text('key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('rate_limit_key_idx').on(t.key, t.createdAt)],
);

// ───────────────────────── Geography & catalogues ─────────────────────────

export const regions = pgTable('regions', {
  code: text('code').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
});

export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  regionCode: text('region_code')
    .notNull()
    .references(() => regions.code),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
});

export const trades = pgTable('trades', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const brands = pgTable('brands', {
  id: id(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull(),
  isPartner: boolean('is_partner').notNull().default(true),
  createdAt: createdAt(),
});

export const dealers = pgTable(
  'dealers',
  {
    id: id(),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    /** 15 digits, starts and ends with 3 (ZATCA). Matched against QR tag 2. */
    vatNumber: text('vat_number').notNull().unique(),
    cityId: text('city_id').references(() => cities.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('dealers_city_idx').on(t.cityId)],
);

/**
 * ZATCA e-invoicing public keys seen on a dealer's invoices (QR tag 8). Every cashier device (EGS
 * unit) has its own key, so a dealer has several. A key joins the set when staff approve an invoice
 * signed with it; invoices signed by a key outside the set go to manual review.
 */
export const dealerKeys = pgTable(
  'dealer_keys',
  {
    id: id(),
    dealerId: uuid('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    /** Base64 of the DER SubjectPublicKeyInfo. */
    publicKey: text('public_key').notNull(),
    label: text('label'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('dealer_keys_uq').on(t.dealerId, t.publicKey)],
);

// ───────────────────────── Craftsmen ─────────────────────────

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

export const craftsmen = pgTable(
  'craftsmen',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    referralCode: text('referral_code').notNull().unique(),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    trades: text('trades').array().notNull().default(sql`'{}'::text[]`),
    yearsExperience: smallint('years_experience').notNull().default(0),
    tier: tierEnum('tier').notNull().default('C'),
    tierAssignedAt: ts('tier_assigned_at'),
    tierAssignedBy: uuid('tier_assigned_by').references(() => users.id, { onDelete: 'set null' }),
    availability: availabilityEnum('availability').notNull().default('available'),
    availabilityUntil: ts('availability_until'),
    /** Published WhatsApp number (E.164). Never rendered in HTML; reached through the tracked redirect. */
    whatsapp: text('whatsapp'),
    acceptsCalls: boolean('accepts_calls').notNull().default(true),
    avatarKey: text('avatar_key'),
    warrantyMonths: smallint('warranty_months').notNull().default(12),
    identityStatus: checkStatusEnum('identity_status').notNull().default('unverified'),
    /** AES-256-GCM. */
    nationalIdEnc: text('national_id_enc'),
    nationalIdLast4: text('national_id_last4'),
    licenseStatus: checkStatusEnum('license_status').notNull().default('unverified'),
    licenseNumber: text('license_number'),
    licenseExpiresOn: date('license_expires_on'),
    referredById: uuid('referred_by_id').references((): AnyPgColumn => craftsmen.id, { onDelete: 'set null' }),
    /** Profile complete and first invoice approved: referral bonuses are paid from here. */
    activatedAt: ts('activated_at'),
    consent: jsonb('consent').$type<ConsentRecord>(),
    profileViews: integer('profile_views').notNull().default(0),
    deletionRequestedAt: ts('deletion_requested_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('craftsmen_city_idx').on(t.cityId), index('craftsmen_tier_idx').on(t.tier), index('craftsmen_referred_by_idx').on(t.referredById)],
);

export const verificationDocuments = pgTable(
  'verification_documents',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    mime: text('mime').notNull(),
    status: checkStatusEnum('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: ts('reviewed_at'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('vdocs_craftsman_idx').on(t.craftsmanId)],
);

// ───────────────────────── Portfolio ─────────────────────────

export interface ColorUsed {
  name: string;
  code?: string;
  hex: string;
}

export const portfolioProjects = pgTable(
  'portfolio_projects',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    cityId: text('city_id').references(() => cities.id),
    district: text('district'),
    completedOn: date('completed_on'),
    areaSqm: integer('area_sqm'),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    colors: jsonb('colors').$type<ColorUsed[]>().notNull().default([]),
    verification: projectVerificationEnum('verification').notNull().default('self'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: ts('verified_at'),
    warrantyMonths: smallint('warranty_months'),
    /** Factory products used on this job (marketing for the factory on the public profile). */
    productIds: uuid('product_ids').array().notNull().default(sql`'{}'::uuid[]`),
    isPublished: boolean('is_published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('projects_craftsman_idx').on(t.craftsmanId, t.sortOrder)],
);

export const portfolioMedia = pgTable(
  'portfolio_media',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => portfolioProjects.id, { onDelete: 'cascade' }),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum('kind').notNull(),
    role: mediaRoleEnum('role').notNull().default('gallery'),
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key'),
    posterKey: text('poster_key'),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSec: doublePrecision('duration_sec'),
    /** Tiny blurred WebP data URL shown while the image loads. */
    lqip: text('lqip'),
    sha256: text('sha256').notNull(),
    capturedAt: ts('captured_at'),
    geoLat: doublePrecision('geo_lat'),
    geoLng: doublePrecision('geo_lng'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('media_project_idx').on(t.projectId, t.sortOrder)],
);

// ───────────────────────── Invoices & points ─────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    dealerId: uuid('dealer_id').references(() => dealers.id, { onDelete: 'set null' }),
    status: invoiceStatusEnum('status').notNull().default('processing'),
    imageKey: text('image_key').notNull(),
    imageSha256: text('image_sha256').notNull(),
    qrPayload: text('qr_payload'),
    qrPhase: smallint('qr_phase'),
    qrSignature: qrSignatureEnum('qr_signature').notNull().default('absent'),
    qrPublicKey: text('qr_public_key'),
    sellerName: text('seller_name'),
    sellerVat: text('seller_vat'),
    invoiceNumber: text('invoice_number'),
    issuedAt: ts('issued_at'),
    totalAmount: money('total_amount'),
    vatAmount: money('vat_amount'),
    declaredAmount: money('declared_amount'),
    extraction: jsonb('extraction').$type<InvoiceExtraction>(),
    /** Unique platform-wide: one genuine invoice can be claimed once. */
    fingerprint: text('fingerprint'),
    riskScore: smallint('risk_score').notNull().default(0),
    riskReasons: jsonb('risk_reasons').$type<RiskReason[]>().notNull().default([]),
    basePoints: integer('base_points').notNull().default(0),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    ruleSnapshot: jsonb('rule_snapshot').$type<IncentiveResult & { tierMultiplier: number }>(),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: ts('reviewed_at'),
    reviewNote: text('review_note'),
    cityId: text('city_id').references(() => cities.id),
    ipHash: text('ip_hash'),
    deviceId: text('device_id'),
    processingError: text('processing_error'),
    /** Only one worker processes an invoice at a time: a run holds this lease while it reads the QR and the photo. */
    processingLeaseUntil: ts('processing_lease_until'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invoices_fingerprint_uq').on(t.fingerprint),
    uniqueIndex('invoices_image_sha_uq').on(t.imageSha256),
    index('invoices_craftsman_idx').on(t.craftsmanId, t.createdAt),
    index('invoices_status_idx').on(t.status, t.riskScore),
  ],
);

export const wallets = pgTable(
  'wallets',
  {
    craftsmanId: uuid('craftsman_id')
      .primaryKey()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    balance: integer('balance').notNull().default(0),
    lifetimeEarned: integer('lifetime_earned').notNull().default(0),
    lifetimeRedeemed: integer('lifetime_redeemed').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check('wallets_balance_non_negative', sql`${t.balance} >= 0`)],
);

export const pointsLedger = pgTable(
  'points_ledger',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    kind: ledgerKindEnum('kind').notNull(),
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ledger_idempotency_uq').on(t.idempotencyKey), index('ledger_craftsman_idx').on(t.craftsmanId, t.createdAt)],
);

export const referrals = pgTable(
  'referrals',
  {
    id: id(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    refereeId: uuid('referee_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    status: referralStatusEnum('status').notNull().default('pending'),
    riskScore: smallint('risk_score').notNull().default(0),
    riskReasons: jsonb('risk_reasons').$type<RiskReason[]>().notNull().default([]),
    activatedAt: ts('activated_at'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('referrals_referee_uq').on(t.refereeId), index('referrals_referrer_idx').on(t.referrerId, t.createdAt)],
);

export const incentiveRules = pgTable(
  'incentive_rules',
  {
    id: id(),
    name: text('name').notNull(),
    target: incentiveTargetEnum('target').notNull(),
    scope: incentiveScopeEnum('scope').notNull(),
    regionCode: text('region_code').references(() => regions.code),
    cityId: text('city_id').references(() => cities.id),
    multiplier: numeric('multiplier', { precision: 4, scale: 2, mode: 'number' }).notNull().default(1),
    flatBonus: integer('flat_bonus').notNull().default(0),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [check('incentive_window', sql`${t.endsAt} > ${t.startsAt}`), check('incentive_multiplier', sql`${t.multiplier} >= 1`)],
);

export const rewards = pgTable('rewards', {
  id: id(),
  kind: rewardKindEnum('kind').notNull(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionAr: text('description_ar'),
  descriptionEn: text('description_en'),
  partnerName: text('partner_name'),
  pointsCost: integer('points_cost').notNull(),
  valueSar: money('value_sar'),
  stock: integer('stock'),
  minTier: tierEnum('min_tier'),
  accent: text('accent'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
});

export const redemptions = pgTable(
  'redemptions',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => rewards.id),
    pointsSpent: integer('points_spent').notNull(),
    status: redemptionStatusEnum('status').notNull().default('requested'),
    /** Wallet phone or IBAN for cash-out. */
    payoutHandle: text('payout_handle'),
    /** AES-256-GCM. */
    voucherCodeEnc: text('voucher_code_enc'),
    fulfilledBy: uuid('fulfilled_by').references(() => users.id, { onDelete: 'set null' }),
    fulfilledAt: ts('fulfilled_at'),
    note: text('note'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index('redemptions_craftsman_idx').on(t.craftsmanId, t.createdAt), index('redemptions_status_idx').on(t.status)],
);

// ───────────────────────── Engagement ─────────────────────────

export const leads = pgTable(
  'leads',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    channel: leadChannelEnum('channel').notNull(),
    source: leadSourceEnum('source').notNull().default('direct'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('leads_craftsman_idx').on(t.craftsmanId, t.createdAt)],
);

/** Client reviews on a craftsman's public profile. Published only after staff moderation. */
export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    craftsmanId: uuid('craftsman_id')
      .notNull()
      .references(() => craftsmen.id, { onDelete: 'cascade' }),
    authorName: text('author_name').notNull(),
    rating: smallint('rating').notNull(),
    body: text('body').notNull(),
    projectLabel: text('project_label'),
    status: reviewStatusEnum('status').notNull().default('pending'),
    /** The reviewer's network reached this craftsman through the platform (WhatsApp, call or estimate) before reviewing. */
    contactedViaPlatform: boolean('contacted_via_platform').notNull().default(false),
    ipHash: text('ip_hash'),
    deviceId: text('device_id'),
    moderatedBy: uuid('moderated_by').references(() => users.id, { onDelete: 'set null' }),
    moderatedAt: ts('moderated_at'),
    createdAt: createdAt(),
  },
  (t) => [index('reviews_craftsman_idx').on(t.craftsmanId, t.status, t.createdAt), index('reviews_status_idx').on(t.status, t.createdAt), check('reviews_rating_range', sql`${t.rating} between 1 and 5`)],
);

/** The factory's own product catalogue, shown on the public site and on the work it was used for. */
export const products = pgTable(
  'products',
  {
    id: id(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    category: productCategoryEnum('category').notNull(),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    finishAr: text('finish_ar'),
    finishEn: text('finish_en'),
    /** Square metres per litre per coat, used by the estimator. */
    coverageSqmPerLiter: doublePrecision('coverage_sqm_per_liter'),
    sizes: text('sizes').array().notNull().default(sql`'{}'::text[]`),
    /** Accent colour for the product card. */
    swatch: text('swatch').notNull().default('#102A43'),
    imageKey: text('image_key'),
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_active_idx').on(t.isActive, t.sortOrder)],
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: createdAt(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    url: text('url'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

// ───────────────────────── Fraud & audit ─────────────────────────

export const deviceSignals = pgTable(
  'device_signals',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    event: signalEventEnum('event').notNull(),
    deviceId: text('device_id'),
    ipHash: text('ip_hash'),
    ipPrefixHash: text('ip_prefix_hash'),
    uaHash: text('ua_hash'),
    fingerprint: text('fingerprint'),
    createdAt: createdAt(),
  },
  (t) => [
    index('signals_device_idx').on(t.deviceId),
    index('signals_prefix_idx').on(t.ipPrefixHash, t.createdAt),
    index('signals_user_idx').on(t.userId),
  ],
);

export const fraudFlags = pgTable(
  'fraud_flags',
  {
    id: id(),
    subjectType: fraudSubjectEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    craftsmanId: uuid('craftsman_id').references(() => craftsmen.id, { onDelete: 'cascade' }),
    rule: text('rule').notNull(),
    score: smallint('score').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    status: fraudStatusEnum('status').notNull().default('open'),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: ts('resolved_at'),
    createdAt: createdAt(),
  },
  (t) => [index('fraud_status_idx').on(t.status, t.createdAt), index('fraud_subject_idx').on(t.subjectType, t.subjectId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    subjectType: text('subject_type'),
    subjectId: text('subject_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_subject_idx').on(t.subjectType, t.subjectId)],
);

// ───────────────────────── Files & settings ─────────────────────────

export const uploads = pgTable(
  'uploads',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: uploadPurposeEnum('purpose').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    sha256: text('sha256').notNull(),
    status: uploadStatusEnum('status').notNull().default('pending'),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('uploads_user_idx').on(t.userId, t.createdAt)],
);

export const storedFiles = pgTable('stored_files', {
  key: text('key').primaryKey(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  data: bytea('data').notNull(),
  createdAt: createdAt(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});
