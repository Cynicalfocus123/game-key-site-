ALTER TABLE "seller_application" ADD COLUMN "freeze_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "freeze_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "freeze_released_by" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "freeze_notice_dismissed_at" timestamp with time zone;