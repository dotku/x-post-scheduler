-- Add credit balance to users (safe if column already exists)
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "creditBalanceCents" INTEGER NOT NULL DEFAULT 500;

-- Add credit transactions table (safe if table already exists)
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "stripeSessionId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- Ensure FK exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CreditTransaction_userId_fkey'
  ) THEN
    ALTER TABLE "CreditTransaction"
    ADD CONSTRAINT "CreditTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Indexes used by credit APIs and idempotent top-up checks
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx"
ON "CreditTransaction"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "CreditTransaction_stripeSessionId_idx"
ON "CreditTransaction"("stripeSessionId");
