CREATE INDEX IF NOT EXISTS "users_company_id_idx"
ON "users" ("company_id");

CREATE INDEX IF NOT EXISTS "purchase_platforms_type_is_active_idx"
ON "purchase_platforms" ("type", "is_active");

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx"
ON "audit_logs" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_event_type_created_at_idx"
ON "audit_logs" ("event_type", "created_at");
