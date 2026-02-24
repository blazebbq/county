-- CreateTable
CREATE TABLE "QuoteSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "designSpecJson" TEXT NOT NULL,
    "renderImageUrl" TEXT,
    "priceEstimate" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
