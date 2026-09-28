ALTER TABLE "ticket" ADD COLUMN "order_ref" text;--> statement-breakpoint
UPDATE "ticket" SET "order_ref" = "orders"."number" FROM "orders" WHERE "orders"."id" = "ticket"."order_id";--> statement-breakpoint
UPDATE "ticket" SET "category" = CASE WHEN "category" IN ('order', 'key') THEN 'order_issue' ELSE 'general_support' END WHERE "category" NOT IN ('order_issue', 'return_refund', 'general_support', 'questions');
