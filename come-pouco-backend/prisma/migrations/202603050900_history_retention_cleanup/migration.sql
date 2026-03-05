ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "history_retention_days" INTEGER NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS "affiliate_links_company_id_created_at_idx"
ON "affiliate_links" ("company_id", "created_at");
