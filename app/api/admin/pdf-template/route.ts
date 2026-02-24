import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffAuthenticated } from "@/lib/auth";
import { getPdfTemplateSettings, DEFAULT_PDF_TEMPLATE } from "@/lib/pdfTemplate";
import { z } from "zod";

const MAX_LABEL = 150;
const MAX_DISCLAIMER = 1000;

/** Strip HTML tags from a string to prevent stored XSS in the PDF. */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

const PdfTemplateSchema = z.object({
  shopName:                   z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  shopAddress:                z.string().max(MAX_LABEL).transform(stripHtml),
  shopPhone:                  z.string().max(MAX_LABEL).transform(stripHtml),
  shopEmail:                  z.string().max(MAX_LABEL).transform(stripHtml),
  documentTitle:              z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  headingDesignSpecification: z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  headingPriceEstimate:       z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelDescription:           z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelMetal:                 z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelRingSize:              z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelStones:                z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelStyle:                 z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelComplexity:            z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelEstimatedPrice:        z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelRange:                 z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  labelLeadTime:              z.string().min(1).max(MAX_LABEL).transform(stripHtml),
  disclaimerText:             z.string().min(1).max(MAX_DISCLAIMER).transform(stripHtml),
  vatText:                    z.string().min(1).max(MAX_DISCLAIMER).transform(stripHtml),
});

export async function GET(_req: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getPdfTemplateSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as unknown;
  const parsed = PdfTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  try {
    const row = await prisma.pdfTemplateSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...parsed.data },
      update: parsed.data,
    });

    console.log(JSON.stringify({ level: "info", event: "pdf_template_updated" }));
    return NextResponse.json({ success: true, settings: { ...DEFAULT_PDF_TEMPLATE, ...row } });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "pdf_template_save_failed", error: String(err) }));
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
