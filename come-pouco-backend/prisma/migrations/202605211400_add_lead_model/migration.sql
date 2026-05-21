-- CreateTable
CREATE TABLE "leads" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "volume" VARCHAR(40),
  "message" VARCHAR(1000),
  "source" VARCHAR(40) DEFAULT 'landing',
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(500),
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");
