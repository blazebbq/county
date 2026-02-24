-- CreateTable
CREATE TABLE "MetalRateCache" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "goldGBPPerGram24k" REAL NOT NULL,
    "silverGBPPerGram" REAL NOT NULL DEFAULT 0,
    "platinumGBPPerGram" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    CONSTRAINT "Lead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PdfTemplateSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "shopName" TEXT NOT NULL,
    "shopAddress" TEXT NOT NULL,
    "shopPhone" TEXT NOT NULL,
    "shopEmail" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "headingDesignSpecification" TEXT NOT NULL,
    "headingPriceEstimate" TEXT NOT NULL,
    "labelDescription" TEXT NOT NULL,
    "labelMetal" TEXT NOT NULL,
    "labelRingSize" TEXT NOT NULL,
    "labelStones" TEXT NOT NULL,
    "labelStyle" TEXT NOT NULL,
    "labelComplexity" TEXT NOT NULL,
    "labelEstimatedPrice" TEXT NOT NULL,
    "labelRange" TEXT NOT NULL,
    "labelLeadTime" TEXT NOT NULL,
    "disclaimerText" TEXT NOT NULL,
    "vatText" TEXT NOT NULL,
    "notificationEmail" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PdfTemplateSettings" ("disclaimerText", "documentTitle", "headingDesignSpecification", "headingPriceEstimate", "id", "labelComplexity", "labelDescription", "labelEstimatedPrice", "labelLeadTime", "labelMetal", "labelRange", "labelRingSize", "labelStones", "labelStyle", "shopAddress", "shopEmail", "shopName", "shopPhone", "updatedAt", "vatText") SELECT "disclaimerText", "documentTitle", "headingDesignSpecification", "headingPriceEstimate", "id", "labelComplexity", "labelDescription", "labelEstimatedPrice", "labelLeadTime", "labelMetal", "labelRange", "labelRingSize", "labelStones", "labelStyle", "shopAddress", "shopEmail", "shopName", "shopPhone", "updatedAt", "vatText" FROM "PdfTemplateSettings";
DROP TABLE "PdfTemplateSettings";
ALTER TABLE "new_PdfTemplateSettings" RENAME TO "PdfTemplateSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sessionId_key" ON "Lead"("sessionId");
