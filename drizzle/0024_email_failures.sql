CREATE TABLE "email_failure" (
	"id" text PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"to" text NOT NULL,
	"error" text NOT NULL,
	"attempts" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_failure_created_idx" ON "email_failure" USING btree ("created_at");