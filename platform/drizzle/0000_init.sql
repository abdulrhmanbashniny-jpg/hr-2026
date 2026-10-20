CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'snoozed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'telegram', 'whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('active', 'renewal_in_progress', 'archived');--> statement-breakpoint
CREATE TYPE "public"."alert_module" AS ENUM('residents', 'gosi', 'fleet', 'operating_cards', 'driver_cards', 'documents', 'cross');--> statement-breakpoint
CREATE TYPE "public"."op_card_requirement" AS ENUM('auto', 'required', 'exempt');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."promo_kind" AS ENUM('percent', 'fixed', 'trial_extension');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('active', 'missing', 'archived');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."import_template" AS ENUM('residents', 'gosi', 'vehicles', 'operating_cards', 'driver_cards');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"rule_code" text NOT NULL,
	"module" "alert_module" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"entity_key" text NOT NULL,
	"entity_label" text NOT NULL,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"detail_ar" text NOT NULL,
	"detail_en" text NOT NULL,
	"due_date" date,
	"link" text,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_reason" text
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"phone" text,
	"email" text,
	"telegram_chat_id" text,
	"telegram_username" text,
	"telegram_link_code" text,
	"user_id" uuid,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"can_request_documents" boolean DEFAULT false NOT NULL,
	"receive_weekly_report" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_telegram_link_code_unique" UNIQUE("telegram_link_code")
);
--> statement-breakpoint
CREATE TABLE "document_bundle_items" (
	"bundle_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "document_bundle_items_bundle_id_document_id_pk" PRIMARY KEY("bundle_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "document_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"authority_id" uuid,
	"reference_number" text,
	"issue_date" date,
	"expiry_date" date,
	"issue_date_hijri" text,
	"expiry_date_hijri" text,
	"entered_calendar" text DEFAULT 'gregorian' NOT NULL,
	"alert_days" jsonb DEFAULT '[60,30,15,4]'::jsonb NOT NULL,
	"responsible_contact_id" uuid,
	"renewal_fee" numeric(12, 2),
	"file_key" text,
	"file_name" text,
	"file_mime" text,
	"file_size" integer,
	"external_url" text,
	"notes" text,
	"status" "document_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"card_number" text NOT NULL,
	"driver_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"activity" text,
	"issue_date" date,
	"expiry_date" date,
	"card_class" text,
	"request_status" text,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"missing_since" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"last_import_id" uuid,
	"manually_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gosi_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"national_id" text NOT NULL,
	"name" text NOT NULL,
	"nationality" text,
	"is_saudi" boolean DEFAULT false NOT NULL,
	"gender" text,
	"birth_date" date,
	"basic_wage" numeric(12, 2) DEFAULT 0 NOT NULL,
	"housing_allowance" numeric(12, 2) DEFAULT 0 NOT NULL,
	"commissions" numeric(12, 2) DEFAULT 0 NOT NULL,
	"other_allowances" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_wage" numeric(12, 2) DEFAULT 0 NOT NULL,
	"contributory_wage" numeric(12, 2) DEFAULT 0 NOT NULL,
	"occupation" text,
	"join_date" date,
	"new_system_eligible" boolean DEFAULT false NOT NULL,
	"probation_days" integer,
	"probation_reviewed_at" timestamp with time zone,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"missing_since" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"last_import_id" uuid,
	"manually_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template" "import_template" NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"stale_count" integer DEFAULT 0 NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"missing_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"file_is_stale" boolean DEFAULT false NOT NULL,
	"report" jsonb NOT NULL,
	"user_id" uuid,
	"file_discarded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" text NOT NULL,
	"status" "delivery_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"alert_id" uuid,
	"title_ar" text NOT NULL,
	"title_en" text NOT NULL,
	"body_ar" text NOT NULL,
	"body_en" text NOT NULL,
	"link" text,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"card_number" text NOT NULL,
	"sequence_number" text,
	"activity" text,
	"issue_date" date,
	"expiry_date" date,
	"card_status" text,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"missing_since" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"last_import_id" uuid,
	"manually_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid,
	"billing_cycle" "billing_cycle" NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"vat" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"promo_code_id" uuid,
	"provider" text NOT NULL,
	"provider_ref" text,
	"checkout_url" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"description_ar" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer NOT NULL,
	"max_employees" integer,
	"max_vehicles" integer,
	"max_users" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" "promo_kind" NOT NULL,
	"value" integer NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"plan_codes" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"iqama_number" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"nationality" text,
	"occupation" text,
	"passport_number" text,
	"passport_expiry" date,
	"iqama_issue_date" date,
	"iqama_expiry" date,
	"birth_date" date,
	"outside_kingdom" boolean DEFAULT false NOT NULL,
	"iqama_expiry_hijri" text,
	"employer_number" text,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"missing_since" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"last_import_id" uuid,
	"manually_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"document_ids" jsonb NOT NULL,
	"recipient" text,
	"channel" text,
	"expires_at" timestamp with time zone NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" "subscription_status" NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"pending_promo_code_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"cr_number" text,
	"settings" jsonb NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sequence_number" text NOT NULL,
	"plate_number" text,
	"registration_type" text,
	"branch" text,
	"make" text,
	"model" text,
	"manufacture_year" integer,
	"chassis_number" text,
	"color" text,
	"vehicle_status" text,
	"ownership_date" date,
	"ownership_date_hijri" text,
	"license_expiry" date,
	"license_expiry_hijri" text,
	"inspection_expiry" date,
	"inspection_expiry_hijri" text,
	"actual_user_id" text,
	"actual_user_name" text,
	"inspection_status" text,
	"insurance_status" text,
	"restriction_status" text,
	"form_issue_date" date,
	"form_issue_date_hijri" text,
	"body_type" text,
	"operating_card_requirement" "op_card_requirement" DEFAULT 'auto' NOT NULL,
	"record_status" "record_status" DEFAULT 'active' NOT NULL,
	"missing_since" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"last_import_id" uuid,
	"manually_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorities" ADD CONSTRAINT "authorities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_alerts" ADD CONSTRAINT "compliance_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bundle_items" ADD CONSTRAINT "document_bundle_items_bundle_id_document_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."document_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bundle_items" ADD CONSTRAINT "document_bundle_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_authority_id_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."authorities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_responsible_contact_id_contacts_id_fk" FOREIGN KEY ("responsible_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_cards" ADD CONSTRAINT "driver_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gosi_subscribers" ADD CONSTRAINT "gosi_subscribers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_compliance_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."compliance_alerts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_cards" ADD CONSTRAINT "operating_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "residents" ADD CONSTRAINT "residents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("pending_promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_created" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_tenant_fingerprint" ON "compliance_alerts" USING btree ("tenant_id","fingerprint");--> statement-breakpoint
CREATE INDEX "alerts_tenant_status" ON "compliance_alerts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "documents_tenant_expiry" ON "documents" USING btree ("tenant_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_cards_tenant_card" ON "driver_cards" USING btree ("tenant_id","card_number");--> statement-breakpoint
CREATE INDEX "driver_cards_driver" ON "driver_cards" USING btree ("tenant_id","driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gosi_tenant_national_id" ON "gosi_subscribers" USING btree ("tenant_id","national_id");--> statement-breakpoint
CREATE INDEX "import_batches_tenant_created" ON "import_batches" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_tenant_user" ON "memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_dedupe" ON "notification_deliveries" USING btree ("tenant_id","dedupe_key","channel","recipient");--> statement-breakpoint
CREATE INDEX "notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operating_cards_tenant_card" ON "operating_cards" USING btree ("tenant_id","card_number");--> statement-breakpoint
CREATE INDEX "operating_cards_sequence" ON "operating_cards" USING btree ("tenant_id","sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX "promo_redemptions_unique" ON "promo_redemptions" USING btree ("promo_code_id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "residents_tenant_iqama" ON "residents" USING btree ("tenant_id","iqama_number");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_tenant_sequence" ON "vehicles" USING btree ("tenant_id","sequence_number");