import { prisma } from "@/lib/db";

export interface PdfTemplateSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  documentTitle: string;
  headingDesignSpecification: string;
  headingPriceEstimate: string;
  labelDescription: string;
  labelMetal: string;
  labelRingSize: string;
  labelStones: string;
  labelStyle: string;
  labelComplexity: string;
  labelEstimatedPrice: string;
  labelRange: string;
  labelLeadTime: string;
  disclaimerText: string;
  vatText: string;
}

export const DEFAULT_PDF_TEMPLATE: PdfTemplateSettings = {
  shopName: "Your Jewellery Shop",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  documentTitle: "Custom Ring Design Estimate",
  headingDesignSpecification: "DESIGN SPECIFICATION",
  headingPriceEstimate: "PRICE ESTIMATE",
  labelDescription: "Description",
  labelMetal: "Metal",
  labelRingSize: "Ring Size",
  labelStones: "Stones",
  labelStyle: "Style",
  labelComplexity: "Complexity",
  labelEstimatedPrice: "Estimated Price",
  labelRange: "Range",
  labelLeadTime: "Estimated Lead Time",
  disclaimerText:
    "This is an indicative estimate only. Final price may vary based on exact specifications, current material costs, and craftsperson assessment.",
  vatText: "VAT may apply. No obligation to purchase.",
};

/**
 * Fetch the PDF template settings row, auto-creating it with defaults if it doesn't exist.
 * Any missing field falls back to the default constant.
 */
export async function getPdfTemplateSettings(): Promise<PdfTemplateSettings> {
  try {
    let row = await prisma.pdfTemplateSettings.findUnique({ where: { id: "default" } });

    if (!row) {
      row = await prisma.pdfTemplateSettings.create({
        data: { id: "default", ...DEFAULT_PDF_TEMPLATE },
      });
    }

    // Merge with defaults so any future new fields fall back gracefully
    return {
      shopName: row.shopName || DEFAULT_PDF_TEMPLATE.shopName,
      shopAddress: row.shopAddress || DEFAULT_PDF_TEMPLATE.shopAddress,
      shopPhone: row.shopPhone || DEFAULT_PDF_TEMPLATE.shopPhone,
      shopEmail: row.shopEmail || DEFAULT_PDF_TEMPLATE.shopEmail,
      documentTitle: row.documentTitle || DEFAULT_PDF_TEMPLATE.documentTitle,
      headingDesignSpecification:
        row.headingDesignSpecification || DEFAULT_PDF_TEMPLATE.headingDesignSpecification,
      headingPriceEstimate: row.headingPriceEstimate || DEFAULT_PDF_TEMPLATE.headingPriceEstimate,
      labelDescription: row.labelDescription || DEFAULT_PDF_TEMPLATE.labelDescription,
      labelMetal: row.labelMetal || DEFAULT_PDF_TEMPLATE.labelMetal,
      labelRingSize: row.labelRingSize || DEFAULT_PDF_TEMPLATE.labelRingSize,
      labelStones: row.labelStones || DEFAULT_PDF_TEMPLATE.labelStones,
      labelStyle: row.labelStyle || DEFAULT_PDF_TEMPLATE.labelStyle,
      labelComplexity: row.labelComplexity || DEFAULT_PDF_TEMPLATE.labelComplexity,
      labelEstimatedPrice: row.labelEstimatedPrice || DEFAULT_PDF_TEMPLATE.labelEstimatedPrice,
      labelRange: row.labelRange || DEFAULT_PDF_TEMPLATE.labelRange,
      labelLeadTime: row.labelLeadTime || DEFAULT_PDF_TEMPLATE.labelLeadTime,
      disclaimerText: row.disclaimerText || DEFAULT_PDF_TEMPLATE.disclaimerText,
      vatText: row.vatText || DEFAULT_PDF_TEMPLATE.vatText,
    };
  } catch (err) {
    console.log(
      JSON.stringify({ level: "warn", event: "pdf_template_fetch_failed", error: String(err) })
    );
    return { ...DEFAULT_PDF_TEMPLATE };
  }
}
