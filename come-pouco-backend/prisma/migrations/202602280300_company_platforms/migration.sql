CREATE TABLE IF NOT EXISTS "company_platforms" (
  "company_id" INTEGER NOT NULL,
  "platform_id" INTEGER NOT NULL,
  "is_default_for_company" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "company_platforms_pkey" PRIMARY KEY ("company_id", "platform_id"),
  CONSTRAINT "company_platforms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "company_platforms_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "purchase_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "company_platforms" ("company_id", "platform_id", "is_default_for_company")
SELECT c."id", c."shopee_platform_id", true
FROM "companies" c
WHERE c."shopee_platform_id" IS NOT NULL
ON CONFLICT ("company_id", "platform_id") DO UPDATE
SET "is_default_for_company" = EXCLUDED."is_default_for_company";
