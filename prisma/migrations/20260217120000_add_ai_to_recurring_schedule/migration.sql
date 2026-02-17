-- AlterTable
ALTER TABLE "RecurringSchedule"
ADD COLUMN "useAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiPrompt" TEXT,
ADD COLUMN "aiLanguage" TEXT;
