-- Add username and 2FA-related fields incrementally without breaking existing auth.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(120);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret_pending" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_pending_created_at" TIMESTAMP(6);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_confirmed_at" TIMESTAMP(6);

CREATE OR REPLACE FUNCTION cp_slug_username(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := lower(regexp_replace(coalesce(input_text, ''), '[^a-zA-Z0-9_-]+', '', 'g'));
  IF normalized IS NULL OR length(normalized) = 0 THEN
    RETURN 'user';
  END IF;

  IF length(normalized) > 110 THEN
    RETURN substring(normalized from 1 for 110);
  END IF;

  RETURN normalized;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
  candidate TEXT;
  base_value TEXT;
  suffix INTEGER;
BEGIN
  FOR rec IN SELECT id, username, email, full_name FROM "users" ORDER BY id LOOP
    IF rec.username IS NOT NULL AND length(trim(rec.username)) > 0 THEN
      CONTINUE;
    END IF;

    IF rec.email IS NOT NULL AND position('@' IN rec.email) > 1 THEN
      base_value := split_part(rec.email, '@', 1);
    ELSIF rec.email IS NOT NULL AND length(trim(rec.email)) > 0 THEN
      base_value := rec.email;
    ELSE
      base_value := rec.full_name;
    END IF;

    candidate := cp_slug_username(base_value);
    suffix := 0;

    WHILE EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.username = candidate
      AND u.id <> rec.id
    ) LOOP
      suffix := suffix + 1;
      candidate := substring(cp_slug_username(base_value) from 1 for 100) || suffix::TEXT;
    END LOOP;

    UPDATE "users" SET username = candidate WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE ("username");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "two_factor_backup_codes" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "used_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "two_factor_backup_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_backup_codes_user_id_code_hash_key"
  ON "two_factor_backup_codes"("user_id", "code_hash");
CREATE INDEX IF NOT EXISTS "two_factor_backup_codes_user_id_idx"
  ON "two_factor_backup_codes"("user_id");

CREATE TABLE IF NOT EXISTS "trusted_devices" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(6) NOT NULL,
  "last_used_at" TIMESTAMP(6),
  "user_agent" VARCHAR(255),
  "ip" VARCHAR(64),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trusted_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");
CREATE INDEX IF NOT EXISTS "trusted_devices_token_hash_idx" ON "trusted_devices"("token_hash");

DROP FUNCTION IF EXISTS cp_slug_username(TEXT);
