ALTER TABLE "orders" ADD COLUMN "service_fee_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_rate_bp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "billing_address" jsonb;