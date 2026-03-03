DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchasePlatformType') THEN
    CREATE TYPE "PurchasePlatformType" AS ENUM ('SHOPEE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_platforms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  type "PurchasePlatformType" NOT NULL DEFAULT 'SHOPEE',
  app_id VARCHAR(120) NOT NULL DEFAULT '',
  secret TEXT NOT NULL DEFAULT '',
  api_url TEXT NOT NULL DEFAULT 'https://open-api.affiliate.shopee.com.br/graphql',
  is_active BOOLEAN NOT NULL DEFAULT true,
  mock_mode BOOLEAN NOT NULL DEFAULT false,
  api_link TEXT NOT NULL,
  access_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE companies
DROP CONSTRAINT IF EXISTS companies_shopee_platform_id_fkey;

ALTER TABLE companies
ADD CONSTRAINT companies_shopee_platform_id_fkey
FOREIGN KEY (shopee_platform_id) REFERENCES purchase_platforms(id) ON DELETE SET NULL;

ALTER TABLE companies
DROP CONSTRAINT IF EXISTS companies_shopee_platform_test_id_fkey;

ALTER TABLE companies
ADD CONSTRAINT companies_shopee_platform_test_id_fkey
FOREIGN KEY (shopee_platform_test_id) REFERENCES purchase_platforms(id) ON DELETE SET NULL;

ALTER TABLE companies
DROP CONSTRAINT IF EXISTS companies_shopee_platform_prod_id_fkey;

ALTER TABLE companies
ADD CONSTRAINT companies_shopee_platform_prod_id_fkey
FOREIGN KEY (shopee_platform_prod_id) REFERENCES purchase_platforms(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS company_platforms (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform_id INTEGER NOT NULL REFERENCES purchase_platforms(id) ON DELETE CASCADE,
  is_default_for_company BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (company_id, platform_id)
);

INSERT INTO company_platforms (company_id, platform_id, is_default_for_company)
SELECT c.id, c.shopee_platform_id, true
FROM companies c
WHERE c.shopee_platform_id IS NOT NULL
ON CONFLICT (company_id, platform_id) DO UPDATE
SET is_default_for_company = EXCLUDED.is_default_for_company;
