CREATE TABLE "currency" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"chargeable" boolean DEFAULT false NOT NULL,
	"auto_rate" numeric(24, 12),
	"override_rate" numeric(24, 12),
	"round_step" integer DEFAULT 1 NOT NULL,
	"rate_updated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_status" (
	"id" text PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"provider_updated_at" timestamp with time zone,
	"last_error" text
);
