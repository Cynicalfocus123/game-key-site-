ALTER TABLE "order_key" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "order_key" ADD COLUMN "source_key_id" text;--> statement-breakpoint
ALTER TABLE "order_key" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "hold_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_ref" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN "order_id" text;--> statement-breakpoint
ALTER TABLE "product_key" ADD COLUMN "order_item_id" text;--> statement-breakpoint
ALTER TABLE "seller_key" ADD COLUMN "order_item_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_key_idx" ON "orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","hold_until");--> statement-breakpoint
CREATE INDEX "orders_provider_ref_idx" ON "orders" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "product_key_item_idx" ON "product_key" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "seller_key_item_idx" ON "seller_key" USING btree ("order_item_id");