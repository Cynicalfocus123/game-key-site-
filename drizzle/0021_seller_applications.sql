CREATE TABLE "seller_application" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "seller_application_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"data" jsonb NOT NULL,
	"merchant_name" text NOT NULL,
	"merchant_key" text NOT NULL,
	"id_type" text NOT NULL,
	"id_number_enc" text NOT NULL,
	"id_number_hash" text NOT NULL,
	"id_last4" text NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"reason" text,
	"blacklist_reason" text,
	"status_before" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_application_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
CREATE TABLE "seller_event" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"admin_id" text,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"application_id" text,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"stored_name" text NOT NULL,
	"original_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_file_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "closed_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "closed_email" text;--> statement-breakpoint
ALTER TABLE "seller_application" ADD CONSTRAINT "seller_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_application" ADD CONSTRAINT "seller_application_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_event" ADD CONSTRAINT "seller_event_application_id_seller_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_event" ADD CONSTRAINT "seller_event_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_file" ADD CONSTRAINT "seller_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_file" ADD CONSTRAINT "seller_file_application_id_seller_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."seller_application"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_app_user_idx" ON "seller_application" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "seller_app_status_idx" ON "seller_application" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "seller_app_merchant_idx" ON "seller_application" USING btree ("merchant_key");--> statement-breakpoint
CREATE INDEX "seller_app_idnum_idx" ON "seller_application" USING btree ("id_number_hash");--> statement-breakpoint
CREATE INDEX "seller_app_email_idx" ON "seller_application" USING btree ("email");--> statement-breakpoint
CREATE INDEX "seller_event_app_idx" ON "seller_event" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "seller_file_app_idx" ON "seller_file" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "seller_file_user_idx" ON "seller_file" USING btree ("user_id");