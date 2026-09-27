CREATE TABLE "key_reveal" (
	"id" text PRIMARY KEY NOT NULL,
	"key_id" text NOT NULL,
	"user_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_key" (
	"id" text PRIMARY KEY NOT NULL,
	"order_item_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "key_reveal" ADD CONSTRAINT "key_reveal_key_id_order_key_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."order_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_reveal" ADD CONSTRAINT "key_reveal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_key" ADD CONSTRAINT "order_key_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_key" ADD CONSTRAINT "order_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "key_reveal_key_idx" ON "key_reveal" USING btree ("key_id");--> statement-breakpoint
CREATE INDEX "order_key_user_idx" ON "order_key" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_key_item_idx" ON "order_key" USING btree ("order_item_id");