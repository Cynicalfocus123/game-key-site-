ALTER TABLE "seller_application" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_draft" ADD COLUMN "discarded_at" timestamp with time zone;