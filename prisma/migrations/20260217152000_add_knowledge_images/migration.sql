-- CreateTable
CREATE TABLE "KnowledgeImage" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "knowledgeSourceId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeImage_knowledgeSourceId_sourceUrl_key" ON "KnowledgeImage"("knowledgeSourceId", "sourceUrl");
CREATE INDEX "KnowledgeImage_userId_knowledgeSourceId_idx" ON "KnowledgeImage"("userId", "knowledgeSourceId");

-- AddForeignKey
ALTER TABLE "KnowledgeImage" ADD CONSTRAINT "KnowledgeImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnowledgeImage" ADD CONSTRAINT "KnowledgeImage_knowledgeSourceId_fkey" FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
