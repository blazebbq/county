-- CreateTable
CREATE TABLE "PdfTemplateSettings" (
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
    "updatedAt" DATETIME NOT NULL
);
