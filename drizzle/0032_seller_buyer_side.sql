ALTER TABLE "cart_item" ADD COLUMN "offer_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cart_item" DROP CONSTRAINT "cart_item_user_id_product_id_pk";--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_user_id_product_id_offer_id_pk" PRIMARY KEY("user_id","product_id","offer_id");--> statement-breakpoint
ALTER TABLE "seller_store" ADD COLUMN "logo_type" text;--> statement-breakpoint
ALTER TABLE "seller_store" ADD COLUMN "logo_width" integer;--> statement-breakpoint
ALTER TABLE "seller_store" ADD COLUMN "logo_height" integer;--> statement-breakpoint
ALTER TABLE "seller_store" ADD COLUMN "logo_at" timestamp with time zone;
