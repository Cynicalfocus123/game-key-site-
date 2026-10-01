ALTER TABLE "top_up" ADD COLUMN "method" text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE "top_up" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "topup_ref" text;--> statement-breakpoint
ALTER TABLE "top_up" ADD CONSTRAINT "top_up_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_topup_ref_unique" UNIQUE("topup_ref");