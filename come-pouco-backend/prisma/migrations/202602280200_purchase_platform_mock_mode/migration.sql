ALTER TABLE "purchase_platforms"
ADD COLUMN IF NOT EXISTS "mock_mode" BOOLEAN NOT NULL DEFAULT false;
