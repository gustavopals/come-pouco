DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShopeeMode') THEN
    CREATE TYPE "ShopeeMode" AS ENUM ('TEST', 'PROD');
  END IF;
END $$;

ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "shopee_platform_test_id" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "shopee_platform_prod_id" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "shopee_mode" "ShopeeMode" NOT NULL DEFAULT 'TEST';

ALTER TABLE "companies"
DROP CONSTRAINT IF EXISTS "companies_shopee_platform_test_id_fkey";

ALTER TABLE "companies"
ADD CONSTRAINT "companies_shopee_platform_test_id_fkey"
FOREIGN KEY ("shopee_platform_test_id") REFERENCES "purchase_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "companies"
DROP CONSTRAINT IF EXISTS "companies_shopee_platform_prod_id_fkey";

ALTER TABLE "companies"
ADD CONSTRAINT "companies_shopee_platform_prod_id_fkey"
FOREIGN KEY ("shopee_platform_prod_id") REFERENCES "purchase_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
