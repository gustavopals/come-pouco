DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchasePlatformType') THEN
    CREATE TYPE "PurchasePlatformType" AS ENUM ('SHOPEE');
  END IF;
END $$;

ALTER TABLE "purchase_platforms"
ADD COLUMN IF NOT EXISTS "type" "PurchasePlatformType" NOT NULL DEFAULT 'SHOPEE',
ADD COLUMN IF NOT EXISTS "app_id" VARCHAR(120) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "secret" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "api_url" TEXT NOT NULL DEFAULT 'https://open-api.affiliate.shopee.com.br/graphql';

UPDATE "purchase_platforms"
SET "api_url" = "api_link"
WHERE COALESCE(TRIM("api_url"), '') = '' AND COALESCE(TRIM("api_link"), '') <> '';

UPDATE "purchase_platforms"
SET "secret" = "access_key"
WHERE COALESCE(TRIM("secret"), '') = '' AND COALESCE(TRIM("access_key"), '') <> '';
