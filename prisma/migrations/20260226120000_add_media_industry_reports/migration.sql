-- CreateTable
CREATE TABLE "MediaIndustryReport" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleZh" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "summaryZh" TEXT NOT NULL,
    "highlightsEn" TEXT NOT NULL,
    "highlightsZh" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "sources" TEXT NOT NULL,
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaIndustryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaIndustryReport_period_reportDate_key" ON "MediaIndustryReport"("period", "reportDate");

-- CreateIndex
CREATE INDEX "MediaIndustryReport_period_reportDate_idx" ON "MediaIndustryReport"("period", "reportDate");
