CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" TEXT PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(6) NOT NULL,
  "used_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
ON "password_reset_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx"
ON "password_reset_tokens" ("user_id");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx"
ON "password_reset_tokens" ("expires_at");

CREATE TABLE IF NOT EXISTS "system_email_configs" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "provider" VARCHAR(20) NOT NULL,
  "from_email" VARCHAR(255) NOT NULL,
  "from_name" VARCHAR(160),
  "smtp_host" VARCHAR(255),
  "smtp_port" INTEGER,
  "smtp_user" VARCHAR(255),
  "smtp_password" TEXT,
  "smtp_secure" BOOLEAN DEFAULT false,
  "resend_api_key" TEXT,
  "sendgrid_api_key" TEXT,
  "ses_access_key" TEXT,
  "ses_secret_key" TEXT,
  "ses_region" VARCHAR(100),
  "mailgun_api_key" TEXT,
  "mailgun_domain" VARCHAR(255),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "system_email_configs" (
  "id", "provider", "from_email", "from_name", "enabled"
)
VALUES (1, 'smtp', 'no-reply@comepouco.local', 'ComePouco', false)
ON CONFLICT ("id") DO NOTHING;
