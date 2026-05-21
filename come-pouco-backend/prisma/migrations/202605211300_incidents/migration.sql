CREATE TYPE "incident_severity" AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE "incident_status" AS ENUM ('investigating', 'identified', 'resolved');

CREATE TABLE "incidents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(2000) NOT NULL,
  "severity" "incident_severity" NOT NULL DEFAULT 'medium',
  "status" "incident_status" NOT NULL DEFAULT 'investigating',
  "affected_components" JSONB NOT NULL,
  "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incidents_status_started_at_idx" ON "incidents"("status", "started_at" DESC);
CREATE INDEX "incidents_severity_started_at_idx" ON "incidents"("severity", "started_at" DESC);
CREATE INDEX "incidents_started_at_idx" ON "incidents"("started_at" DESC);
