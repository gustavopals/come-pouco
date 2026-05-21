CREATE INDEX IF NOT EXISTS "affiliate_links_created_by_user_id_created_at_idx"
ON "affiliate_links" ("created_by_user_id", "created_at");
