CREATE TABLE "filter_group" (
	"id" text PRIMARY KEY NOT NULL,
	"shown" boolean DEFAULT true NOT NULL,
	"start_open" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filter_option" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "filter_group" ADD CONSTRAINT "filter_group_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_option" ADD CONSTRAINT "filter_option_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "filter_option_group_value_idx" ON "filter_option" USING btree ("group_id","value");