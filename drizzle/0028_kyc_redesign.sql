CREATE TABLE "seller_draft" (
	"user_id" text PRIMARY KEY NOT NULL,
	"seller_type" text NOT NULL,
	"data" jsonb NOT NULL,
	"id_number_enc" text,
	"completed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_application_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seller_application" ADD COLUMN "seller_type" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_draft" ADD CONSTRAINT "seller_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_draft" ADD CONSTRAINT "seller_draft_submitted_application_id_seller_application_id_fk" FOREIGN KEY ("submitted_application_id") REFERENCES "public"."seller_application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Older applications (4-step form): business when the "registered company" answer was yes.
UPDATE "seller_application" SET "seller_type" = 'business' WHERE "data"->>'isCompany' = 'true';