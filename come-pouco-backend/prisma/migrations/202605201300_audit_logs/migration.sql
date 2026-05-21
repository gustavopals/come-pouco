CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" INTEGER,
  "event_type" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(80),
  "entity_id" VARCHAR(120),
  "ip" VARCHAR(64),
  "user_agent" VARCHAR(255),
  "metadata" JSONB,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audit_logs"
DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx"
ON "audit_logs" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_event_type_created_at_idx"
ON "audit_logs" ("event_type", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
ON "audit_logs" ("created_at");
