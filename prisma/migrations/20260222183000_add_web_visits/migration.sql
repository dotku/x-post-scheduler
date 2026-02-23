CREATE TABLE IF NOT EXISTS "WebVisit" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "referrer" TEXT,
  "sessionId" TEXT,
  "userAgent" TEXT,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  CONSTRAINT "WebVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebVisit_createdAt_idx"
ON "WebVisit"("createdAt");

CREATE INDEX IF NOT EXISTS "WebVisit_path_createdAt_idx"
ON "WebVisit"("path", "createdAt");

CREATE INDEX IF NOT EXISTS "WebVisit_sessionId_createdAt_idx"
ON "WebVisit"("sessionId", "createdAt");

CREATE INDEX IF NOT EXISTS "WebVisit_userId_createdAt_idx"
ON "WebVisit"("userId", "createdAt");

ALTER TABLE "WebVisit"
ADD CONSTRAINT "WebVisit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

