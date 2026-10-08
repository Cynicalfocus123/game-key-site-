CREATE TABLE "key_registry" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"key_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_request" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "product_request_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"platform" text NOT NULL,
	"region" text NOT NULL,
	"edition" text DEFAULT '' NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"product_id" text,
	"reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_request_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "product_request_event" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"admin_id" text,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_key" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"code_enc" text NOT NULL,
	"code_hash" text NOT NULL,
	"last4" text NOT NULL,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone,
	CONSTRAINT "seller_key_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "seller_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"product_id" text NOT NULL,
	"price_usd_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_store" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"invoices" boolean DEFAULT false NOT NULL,
	"low_stock_at" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_store_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "seller_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "offer_id" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_usd_cents" integer;--> statement-breakpoint
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request" ADD CONSTRAINT "product_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request_event" ADD CONSTRAINT "product_request_event_request_id_product_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."product_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_request_event" ADD CONSTRAINT "product_request_event_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_key" ADD CONSTRAINT "seller_key_offer_id_seller_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."seller_offer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_key" ADD CONSTRAINT "seller_key_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_offer" ADD CONSTRAINT "seller_offer_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_offer" ADD CONSTRAINT "seller_offer_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_store" ADD CONSTRAINT "seller_store_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_request_seller_idx" ON "product_request" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "product_request_status_idx" ON "product_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_request_name_idx" ON "product_request" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "product_request_event_idx" ON "product_request_event" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "seller_key_offer_idx" ON "seller_key" USING btree ("offer_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_offer_once" ON "seller_offer" USING btree ("seller_id","product_id");--> statement-breakpoint
CREATE INDEX "seller_offer_product_idx" ON "seller_offer" USING btree ("product_id","active");--> statement-breakpoint
CREATE INDEX "order_items_seller_idx" ON "order_items" USING btree ("seller_id");--> statement-breakpoint
-- Hand-added: every admin key already stored joins the registry (first one wins when the same code sits on two products).
INSERT INTO "key_registry" ("code_hash", "source", "key_id", "created_at") SELECT DISTINCT ON ("code_hash") "code_hash", 'admin', "id", "created_at" FROM "product_key" ORDER BY "code_hash", "created_at" ON CONFLICT DO NOTHING;
