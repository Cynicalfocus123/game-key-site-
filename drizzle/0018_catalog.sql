CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"price" integer NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_key" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"code_enc" text NOT NULL,
	"code_hash" text NOT NULL,
	"last4" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"batch" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_key" ADD CONSTRAINT "product_key_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_key" ADD CONSTRAINT "product_key_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_status_idx" ON "product" USING btree ("status","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "product_key_hash_idx" ON "product_key" USING btree ("product_id","code_hash");--> statement-breakpoint
CREATE INDEX "product_key_status_idx" ON "product_key" USING btree ("product_id","status");