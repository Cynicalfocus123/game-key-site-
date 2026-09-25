CREATE TABLE "login_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"method" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_event" ADD CONSTRAINT "login_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_event_user_idx" ON "login_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_event_created_idx" ON "login_event" USING btree ("created_at");