ALTER TABLE "user" ADD COLUMN "admin_perms" jsonb;--> statement-breakpoint
-- T2 default (user 2026-09-29): admins that exist before this migration keep every section until the master admin changes them.
UPDATE "user" SET "admin_perms" = '["users","wallet","topups","products","menu","filters","currencies","giftcards","promo","returns","tickets"]'::jsonb WHERE "role" = 'admin' AND "admin_perms" IS NULL;
