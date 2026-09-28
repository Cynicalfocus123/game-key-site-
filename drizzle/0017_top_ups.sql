CREATE TABLE "payment_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"top_up_id" text,
	"payload" text NOT NULL,
	"result" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "top_up" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"credit_minor" integer NOT NULL,
	"fx_rate" numeric(24, 12) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"idempotency_key" text NOT NULL,
	"failure_reason" text,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"credited_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "top_up_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD COLUMN "top_up_id" text;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_top_up_id_top_up_id_fk" FOREIGN KEY ("top_up_id") REFERENCES "public"."top_up"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up" ADD CONSTRAINT "top_up_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_up" ADD CONSTRAINT "top_up_closed_by_user_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_provider_event_idx" ON "payment_event" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "payment_event_top_up_idx" ON "payment_event" USING btree ("top_up_id");--> statement-breakpoint
CREATE UNIQUE INDEX "top_up_user_key_idx" ON "top_up" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "top_up_user_idx" ON "top_up" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "top_up_status_idx" ON "top_up" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "top_up_provider_ref_idx" ON "top_up" USING btree ("provider","provider_ref");--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_top_up_id_top_up_id_fk" FOREIGN KEY ("top_up_id") REFERENCES "public"."top_up"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_top_up_idx" ON "wallet_ledger" USING btree ("top_up_id");