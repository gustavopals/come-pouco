DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyRole') THEN
    CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'EMPLOYEE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "companies" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(160) NOT NULL UNIQUE,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "company_id" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "company_role" "CompanyRole" NULL;

ALTER TABLE "users"
DROP CONSTRAINT IF EXISTS "users_company_id_fkey";
ALTER TABLE "users"
ADD CONSTRAINT "users_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "affiliate_links"
ADD COLUMN IF NOT EXISTS "company_id" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "created_by_user_id" INTEGER NULL;

ALTER TABLE "affiliate_links"
DROP CONSTRAINT IF EXISTS "affiliate_links_company_id_fkey";
ALTER TABLE "affiliate_links"
ADD CONSTRAINT "affiliate_links_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "affiliate_links"
DROP CONSTRAINT IF EXISTS "affiliate_links_created_by_user_id_fkey";
ALTER TABLE "affiliate_links"
ADD CONSTRAINT "affiliate_links_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "companies" ("name")
VALUES ('Default Company')
ON CONFLICT ("name") DO NOTHING;

UPDATE "users"
SET "company_id" = (SELECT id FROM "companies" WHERE name = 'Default Company' LIMIT 1)
WHERE "role" = 'USER' AND "company_id" IS NULL;

UPDATE "users"
SET "company_role" = 'EMPLOYEE'
WHERE "role" = 'USER' AND "company_role" IS NULL;

UPDATE "affiliate_links"
SET "company_id" = (SELECT id FROM "companies" WHERE name = 'Default Company' LIMIT 1)
WHERE "company_id" IS NULL;

UPDATE "affiliate_links"
SET "created_by_user_id" = (
  SELECT u.id
  FROM "users" u
  WHERE u."role" = 'USER'
  ORDER BY u.id ASC
  LIMIT 1
)
WHERE "created_by_user_id" IS NULL;
