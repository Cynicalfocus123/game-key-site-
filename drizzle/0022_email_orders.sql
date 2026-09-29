CREATE TABLE "email_code" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"token" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "known_device" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_hash" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"ip_address" text,
	"location" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_rating" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text NOT NULL,
	"seller" text NOT NULL,
	"stars" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_event" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "seller" text DEFAULT 'CoreCart' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_last4" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal_minor" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "wallet_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_info" jsonb;--> statement-breakpoint
ALTER TABLE "email_code" ADD CONSTRAINT "email_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "known_device" ADD CONSTRAINT "known_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_rating" ADD CONSTRAINT "seller_rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_rating" ADD CONSTRAINT "seller_rating_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_code_email_idx" ON "email_code" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "known_device_once" ON "known_device" USING btree ("user_id","device_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_rating_once" ON "seller_rating" USING btree ("user_id","order_id","seller");--> statement-breakpoint
CREATE INDEX "seller_rating_seller_idx" ON "seller_rating" USING btree ("seller");--> statement-breakpoint
UPDATE "orders" SET "payment_method" = 'card', "payment_last4" = '4242', "subtotal_minor" = "total_cents", "paid_at" = CASE WHEN "status" IN ('paid', 'completed', 'refunded') THEN "created_at" END WHERE "payment_method" IS NULL;
