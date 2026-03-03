ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "shopee_platform_id" INTEGER NULL;

ALTER TABLE "companies"
DROP CONSTRAINT IF EXISTS "companies_shopee_platform_id_fkey";

ALTER TABLE "companies"
ADD CONSTRAINT "companies_shopee_platform_id_fkey"
FOREIGN KEY ("shopee_platform_id") REFERENCES "purchase_platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
