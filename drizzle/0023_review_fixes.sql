ALTER TABLE "top_up" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "claim_email" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "terms_version" text;--> statement-breakpoint
-- R3: one pending / approved application per merchant name. Existing duplicates are reported, never deleted: the index is then
-- skipped (the app check still refuses new duplicates) until an admin rejects one of them and runs the migration again.
DO $$
DECLARE dupes text;
BEGIN
  SELECT string_agg(merchant_key || ' (' || n || ')', ', ') INTO dupes FROM (
    SELECT merchant_key, count(*) AS n FROM "seller_application" WHERE status IN ('pending', 'approved') GROUP BY merchant_key HAVING count(*) > 1) d;
  IF dupes IS NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "seller_app_merchant_open_idx" ON "seller_application" USING btree ("merchant_key") WHERE "seller_application"."status" in ('pending', 'approved');
  ELSE
    RAISE WARNING 'CoreCart R3: duplicate open merchant names, unique index NOT created: %', dupes;
  END IF;
END $$;