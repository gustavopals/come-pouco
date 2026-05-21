CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversionStatus') THEN
    CREATE TYPE "ConversionStatus" AS ENUM ('SUCCESS', 'FALLBACK', 'ERROR');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversionMode') THEN
    CREATE TYPE "ConversionMode" AS ENUM ('MOCK', 'REAL');
  END IF;
END $$;

ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "public_slug" VARCHAR(32),
ADD COLUMN IF NOT EXISTS "fallback_affiliate_url" TEXT;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "public_slug" VARCHAR(32);

CREATE TABLE IF NOT EXISTS "landing_configs" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "banner_text" VARCHAR(160) NOT NULL DEFAULT 'Ofertas Shopee em segundos',
  "banner_emoji" VARCHAR(16) NOT NULL DEFAULT '🛍️',
  "hero_title" VARCHAR(160) NOT NULL DEFAULT 'Economize nas compras da Shopee',
  "hero_subtitle" VARCHAR(280) NOT NULL DEFAULT 'Cole o link do produto e siga para a Shopee com o rastreamento aplicado.',
  "how_it_works_steps" JSONB NOT NULL DEFAULT '["Cole o link Shopee", "Aplicamos o link da loja", "Voce compra normalmente"]'::jsonb,
  "primary_color" VARCHAR(16) NOT NULL DEFAULT '#10b981',
  "logo_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "landing_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "company_id" INTEGER NOT NULL,
  "employee_id" INTEGER,
  "original_url" TEXT NOT NULL,
  "normalized_url" TEXT,
  "affiliate_url" TEXT,
  "item_id" VARCHAR(40),
  "shop_id" VARCHAR(40),
  "status" "ConversionStatus" NOT NULL,
  "error_reason" VARCHAR(255),
  "mode" "ConversionMode" NOT NULL,
  "ip_hash" VARCHAR(64) NOT NULL,
  "user_agent" VARCHAR(256) NOT NULL,
  "referrer" VARCHAR(2048),
  "response_time_ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "companies_public_slug_key"
ON "companies" ("public_slug");

CREATE UNIQUE INDEX IF NOT EXISTS "users_company_id_public_slug_key"
ON "users" ("company_id", "public_slug");

CREATE UNIQUE INDEX IF NOT EXISTS "landing_configs_company_id_key"
ON "landing_configs" ("company_id");

CREATE INDEX IF NOT EXISTS "conversions_company_id_created_at_idx"
ON "conversions" ("company_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "conversions_employee_id_created_at_idx"
ON "conversions" ("employee_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "conversions_item_id_idx"
ON "conversions" ("item_id");

CREATE INDEX IF NOT EXISTS "conversions_status_created_at_idx"
ON "conversions" ("status", "created_at" DESC);

ALTER TABLE "landing_configs"
DROP CONSTRAINT IF EXISTS "landing_configs_company_id_fkey";

ALTER TABLE "landing_configs"
ADD CONSTRAINT "landing_configs_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversions"
DROP CONSTRAINT IF EXISTS "conversions_company_id_fkey";

ALTER TABLE "conversions"
ADD CONSTRAINT "conversions_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversions"
DROP CONSTRAINT IF EXISTS "conversions_employee_id_fkey";

ALTER TABLE "conversions"
ADD CONSTRAINT "conversions_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "landing_configs" ("company_id")
SELECT "id"
FROM "companies"
ON CONFLICT ("company_id") DO NOTHING;
