CREATE TYPE "public"."product_category" AS ENUM('interior', 'exterior', 'primer', 'waterproofing', 'decorative', 'wood_metal');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."upload_purpose" ADD VALUE 'product';--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"category" "product_category" NOT NULL,
	"description_ar" text,
	"description_en" text,
	"finish_ar" text,
	"finish_en" text,
	"coverage_sqm_per_liter" double precision,
	"sizes" text[] DEFAULT '{}'::text[] NOT NULL,
	"swatch" text DEFAULT '#102A43' NOT NULL,
	"image_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"craftsman_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"rating" smallint NOT NULL,
	"body" text NOT NULL,
	"project_label" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"contacted_via_platform" boolean DEFAULT false NOT NULL,
	"ip_hash" text,
	"device_id" text,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD COLUMN "product_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_craftsman_id_craftsmen_id_fk" FOREIGN KEY ("craftsman_id") REFERENCES "public"."craftsmen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_active_idx" ON "products" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "reviews_craftsman_idx" ON "reviews" USING btree ("craftsman_id","status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status","created_at");