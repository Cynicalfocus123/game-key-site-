ALTER TABLE "orders" ADD COLUMN "base_currency" text DEFAULT 'THB' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "base_total_minor" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fx_rate" numeric(24, 12);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rates_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "currency" text;