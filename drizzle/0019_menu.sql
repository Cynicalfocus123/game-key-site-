CREATE TABLE "menu_item" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"kind" text DEFAULT 'link' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"in_bar" boolean DEFAULT false NOT NULL,
	"in_footer" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;