CREATE TYPE "public"."availability" AS ENUM('available', 'busy', 'away');--> statement-breakpoint
CREATE TYPE "public"."check_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('national_id', 'freelance_license', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."fraud_status" AS ENUM('open', 'dismissed', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."fraud_subject" AS ENUM('craftsman', 'invoice', 'referral');--> statement-breakpoint
CREATE TYPE "public"."incentive_scope" AS ENUM('national', 'region', 'city');--> statement-breakpoint
CREATE TYPE "public"."incentive_target" AS ENUM('invoice', 'referral_bonus', 'commission');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('processing', 'pending', 'flagged', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."lead_channel" AS ENUM('profile_view', 'whatsapp', 'call', 'vcard', 'estimate', 'share');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('qr', 'nfc', 'search', 'link', 'wallet', 'direct');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('invoice', 'welcome_bonus', 'referral_bonus', 'commission_l1', 'commission_l2', 'redemption', 'redemption_refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."media_role" AS ENUM('before', 'after', 'gallery');--> statement-breakpoint
CREATE TYPE "public"."project_verification" AS ENUM('self', 'field_verified');--> statement-breakpoint
CREATE TYPE "public"."qr_signature" AS ENUM('absent', 'unsigned', 'valid', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('requested', 'fulfilled', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'activated', 'held', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reward_kind" AS ENUM('fuel_voucher', 'supplier_discount', 'tool', 'cash_out', 'other');--> statement-breakpoint
CREATE TYPE "public"."signal_event" AS ENUM('signup', 'login', 'invoice', 'referral');--> statement-breakpoint
CREATE TYPE "public"."craftsman_tier" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."upload_purpose" AS ENUM('portfolio', 'invoice', 'document', 'avatar');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploaded', 'attached');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('craftsman', 'reviewer', 'admin', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"meta" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"is_partner" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"region_code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "craftsmen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"city_id" text NOT NULL,
	"trades" text[] DEFAULT '{}'::text[] NOT NULL,
	"years_experience" smallint DEFAULT 0 NOT NULL,
	"tier" "craftsman_tier" DEFAULT 'C' NOT NULL,
	"tier_assigned_at" timestamp with time zone,
	"tier_assigned_by" uuid,
	"availability" "availability" DEFAULT 'available' NOT NULL,
	"availability_until" timestamp with time zone,
	"whatsapp" text,
	"accepts_calls" boolean DEFAULT true NOT NULL,
	"avatar_key" text,
	"warranty_months" smallint DEFAULT 12 NOT NULL,
	"identity_status" "check_status" DEFAULT 'unverified' NOT NULL,
	"national_id_enc" text,
	"national_id_last4" text,
	"license_status" "check_status" DEFAULT 'unverified' NOT NULL,
	"license_number" text,
	"license_expires_on" date,
	"referred_by_id" uuid,
	"activated_at" timestamp with time zone,
	"consent" jsonb,
	"profile_views" integer DEFAULT 0 NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "craftsmen_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "craftsmen_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "dealer_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"label" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"name" text NOT NULL,
	"vat_number" text NOT NULL,
	"city_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dealers_vat_number_unique" UNIQUE("vat_number")
);
--> statement-breakpoint
CREATE TABLE "device_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "signal_event" NOT NULL,
	"device_id" text,
	"ip_hash" text,
	"ip_prefix_hash" text,
	"ua_hash" text,
	"fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fraud_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "fraud_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"craftsman_id" uuid,
	"rule" text NOT NULL,
	"score" smallint NOT NULL,
	"details" jsonb,
	"status" "fraud_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incentive_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"target" "incentive_target" NOT NULL,
	"scope" "incentive_scope" NOT NULL,
	"region_code" text,
	"city_id" text,
	"multiplier" numeric(4, 2) DEFAULT 1 NOT NULL,
	"flat_bonus" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incentive_window" CHECK ("incentive_rules"."ends_at" > "incentive_rules"."starts_at"),
	CONSTRAINT "incentive_multiplier" CHECK ("incentive_rules"."multiplier" >= 1)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"dealer_id" uuid,
	"status" "invoice_status" DEFAULT 'processing' NOT NULL,
	"image_key" text NOT NULL,
	"image_sha256" text NOT NULL,
	"qr_payload" text,
	"qr_phase" smallint,
	"qr_signature" "qr_signature" DEFAULT 'absent' NOT NULL,
	"qr_public_key" text,
	"seller_name" text,
	"seller_vat" text,
	"invoice_number" text,
	"issued_at" timestamp with time zone,
	"total_amount" numeric(12, 2),
	"vat_amount" numeric(12, 2),
	"declared_amount" numeric(12, 2),
	"extraction" jsonb,
	"fingerprint" text,
	"risk_score" smallint DEFAULT 0 NOT NULL,
	"risk_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_points" integer DEFAULT 0 NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"rule_snapshot" jsonb,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"city_id" text,
	"ip_hash" text,
	"device_id" text,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"channel" "lead_channel" NOT NULL,
	"source" "lead_source" DEFAULT 'direct' NOT NULL,
	"meta" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"ref_type" text,
	"ref_id" uuid,
	"idempotency_key" text NOT NULL,
	"balance_after" integer NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"role" "media_role" DEFAULT 'gallery' NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"poster_key" text,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_sec" double precision,
	"lqip" text,
	"sha256" text NOT NULL,
	"captured_at" timestamp with time zone,
	"geo_lat" double precision,
	"geo_lng" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"city_id" text,
	"district" text,
	"completed_on" date,
	"area_sqm" integer,
	"brand_id" uuid,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification" "project_verification" DEFAULT 'self' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"warranty_months" smallint,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"points_spent" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'requested' NOT NULL,
	"payout_handle" text,
	"voucher_code_enc" text,
	"fulfilled_by" uuid,
	"fulfilled_at" timestamp with time zone,
	"note" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"risk_score" smallint DEFAULT 0 NOT NULL,
	"risk_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activated_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "reward_kind" NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"partner_name" text,
	"points_cost" integer NOT NULL,
	"value_sar" numeric(12, 2),
	"stock" integer,
	"min_tier" "craftsman_tier",
	"accent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_hash" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"key" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" text PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "upload_purpose" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"status" "upload_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'craftsman' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verification_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"status" "check_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"craftsman_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_redeemed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_balance_non_negative" CHECK ("wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craftsmen" ADD CONSTRAINT "craftsmen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craftsmen" ADD CONSTRAINT "craftsmen_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craftsmen" ADD CONSTRAINT "craftsmen_tier_assigned_by_users_id_fk" FOREIGN KEY ("tier_assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "craftsmen" ADD CONSTRAINT "craftsmen_referred_by_id_craftsmen_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."craftsmen"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_keys" ADD CONSTRAINT "dealer_keys_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_keys" ADD CONSTRAINT "dealer_keys_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_signals" ADD CONSTRAINT "device_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_rules" ADD CONSTRAINT "incentive_rules_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_rules" ADD CONSTRAINT "incentive_rules_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_rules" ADD CONSTRAINT "incentive_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_media" ADD CONSTRAINT "portfolio_media_project_id_portfolio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."portfolio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_media" ADD CONSTRAINT "portfolio_media_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_fulfilled_by_users_id_fk" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_craftsmen_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_craftsmen_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "craftsmen_city_idx" ON "craftsmen" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "craftsmen_tier_idx" ON "craftsmen" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "craftsmen_referred_by_idx" ON "craftsmen" USING btree ("referred_by_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealer_keys_uq" ON "dealer_keys" USING btree ("dealer_id","public_key");--> statement-breakpoint
CREATE INDEX "dealers_city_idx" ON "dealers" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "signals_device_idx" ON "device_signals" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "signals_prefix_idx" ON "device_signals" USING btree ("ip_prefix_hash","created_at");--> statement-breakpoint
CREATE INDEX "signals_user_idx" ON "device_signals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fraud_status_idx" ON "fraud_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "fraud_subject_idx" ON "fraud_flags" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_fingerprint_uq" ON "invoices" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_image_sha_uq" ON "invoices" USING btree ("image_sha256");--> statement-breakpoint
CREATE INDEX "invoices_craftsman_idx" ON "invoices" USING btree ("craftsman_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status","risk_score");--> statement-breakpoint
CREATE INDEX "leads_craftsman_idx" ON "leads" USING btree ("craftsman_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_idempotency_uq" ON "points_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ledger_craftsman_idx" ON "points_ledger" USING btree ("craftsman_id","created_at");--> statement-breakpoint
CREATE INDEX "media_project_idx" ON "portfolio_media" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "projects_craftsman_idx" ON "portfolio_projects" USING btree ("craftsman_id","sort_order");--> statement-breakpoint
CREATE INDEX "rate_limit_key_idx" ON "rate_limit_hits" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "redemptions_craftsman_idx" ON "redemptions" USING btree ("craftsman_id","created_at");--> statement-breakpoint
CREATE INDEX "redemptions_status_idx" ON "redemptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referee_uq" ON "referrals" USING btree ("referee_id");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uploads_user_idx" ON "uploads" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "vdocs_craftsman_idx" ON "verification_documents" USING btree ("craftsman_id");