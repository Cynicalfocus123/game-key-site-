CREATE TABLE "site_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_setting_event" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"admin_id" text,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_setting" ADD CONSTRAINT "site_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_setting_event" ADD CONSTRAINT "site_setting_event_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_setting_event_key_idx" ON "site_setting_event" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "orders_paid_idx" ON "orders" USING btree ("paid_at");