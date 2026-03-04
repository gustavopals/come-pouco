DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApiRequestMode') THEN
    CREATE TYPE "ApiRequestMode" AS ENUM ('MOCK', 'REAL');
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "api_request_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "platform_id" INTEGER NOT NULL,
  "mode" "ApiRequestMode" NOT NULL,
  "endpoint" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "api_request_logs_company_id_idx" ON "api_request_logs"("company_id");
CREATE INDEX IF NOT EXISTS "api_request_logs_user_id_idx" ON "api_request_logs"("user_id");
CREATE INDEX IF NOT EXISTS "api_request_logs_platform_id_idx" ON "api_request_logs"("platform_id");
CREATE INDEX IF NOT EXISTS "api_request_logs_mode_idx" ON "api_request_logs"("mode");
CREATE INDEX IF NOT EXISTS "api_request_logs_created_at_idx" ON "api_request_logs"("created_at");

ALTER TABLE "api_request_logs"
DROP CONSTRAINT IF EXISTS "api_request_logs_company_id_fkey";

ALTER TABLE "api_request_logs"
ADD CONSTRAINT "api_request_logs_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_request_logs"
DROP CONSTRAINT IF EXISTS "api_request_logs_user_id_fkey";

ALTER TABLE "api_request_logs"
ADD CONSTRAINT "api_request_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_request_logs"
DROP CONSTRAINT IF EXISTS "api_request_logs_platform_id_fkey";

ALTER TABLE "api_request_logs"
ADD CONSTRAINT "api_request_logs_platform_id_fkey"
FOREIGN KEY ("platform_id") REFERENCES "purchase_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
