-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "username" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "xApiKey" TEXT NOT NULL,
    "xApiSecret" TEXT NOT NULL,
    "xAccessToken" TEXT NOT NULL,
    "xAccessTokenSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "xAccountId" TEXT;
ALTER TABLE "RecurringSchedule" ADD COLUMN "xAccountId" TEXT;

-- CreateIndex
CREATE INDEX "XAccount_userId_isDefault_idx" ON "XAccount"("userId", "isDefault");

-- AddForeignKey
ALTER TABLE "XAccount" ADD CONSTRAINT "XAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate legacy single-account credentials into XAccount
INSERT INTO "XAccount" (
    "id",
    "label",
    "username",
    "isDefault",
    "xApiKey",
    "xApiSecret",
    "xAccessToken",
    "xAccessTokenSecret",
    "createdAt",
    "updatedAt",
    "userId"
)
SELECT
    'legacy_' || "id",
    'Migrated account',
    NULL,
    true,
    "xApiKey",
    "xApiSecret",
    "xAccessToken",
    "xAccessTokenSecret",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "id"
FROM "User"
WHERE
    "xApiKey" IS NOT NULL
    AND "xApiSecret" IS NOT NULL
    AND "xAccessToken" IS NOT NULL
    AND "xAccessTokenSecret" IS NOT NULL;

-- Bind existing posts/schedules to migrated account when available
UPDATE "Post"
SET "xAccountId" = 'legacy_' || "userId"
WHERE
    "userId" IS NOT NULL
    AND "xAccountId" IS NULL
    AND EXISTS (
        SELECT 1
        FROM "XAccount" xa
        WHERE xa."id" = 'legacy_' || "Post"."userId"
    );

UPDATE "RecurringSchedule"
SET "xAccountId" = 'legacy_' || "userId"
WHERE
    "userId" IS NOT NULL
    AND "xAccountId" IS NULL
    AND EXISTS (
        SELECT 1
        FROM "XAccount" xa
        WHERE xa."id" = 'legacy_' || "RecurringSchedule"."userId"
    );
