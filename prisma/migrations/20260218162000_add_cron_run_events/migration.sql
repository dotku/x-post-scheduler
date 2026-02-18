CREATE TABLE IF NOT EXISTS "CronRunEvent" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "triggeredBy" TEXT,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CronRunEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CronRunEvent_jobName_createdAt_idx"
ON "CronRunEvent"("jobName", "createdAt");

CREATE INDEX IF NOT EXISTS "CronRunEvent_success_createdAt_idx"
ON "CronRunEvent"("success", "createdAt");

CREATE INDEX IF NOT EXISTS "CronRunEvent_endpoint_createdAt_idx"
ON "CronRunEvent"("endpoint", "createdAt");
