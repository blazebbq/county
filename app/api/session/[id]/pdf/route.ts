import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DesignSpecSchema } from "@/lib/llm/designSpecSchema";
import { getPdfTemplateSettings } from "@/lib/pdfTemplate";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

function hexToRgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return [0, 0, 0];
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [session, template] = await Promise.all([
      prisma.session.findUnique({ where: { id }, include: { assets: true } }),
      getPdfTemplateSettings(),
    ]);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const goldColor = rgb(...hexToRgb("#d4920f"));
    const darkColor = rgb(0.1, 0.1, 0.1);
    const grayColor = rgb(0.4, 0.4, 0.4);

    // Header bar
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.07, 0.07, 0.07) });

    page.drawText(template.shopName, {
      x: 40, y: height - 50,
      size: 22, font: fontBold, color: goldColor,
    });
    page.drawText(template.documentTitle, {
      x: 40, y: height - 70,
      size: 11, font: fontRegular, color: rgb(0.8, 0.8, 0.8),
    });

    // Date (always dynamic)
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 10);
    page.drawText(dateStr, {
      x: width - dateWidth - 40, y: height - 55,
      size: 10, font: fontRegular, color: rgb(0.7, 0.7, 0.7),
    });

    let yPos = height - 110;

    // Design Spec section
    if (session.designSpec) {
      const parsedSpec = DesignSpecSchema.safeParse(JSON.parse(session.designSpec) as unknown);
      if (parsedSpec.success) {
        const spec = parsedSpec.data;

        page.drawText(template.headingDesignSpecification, {
          x: 40, y: yPos, size: 13, font: fontBold, color: goldColor,
        });
        yPos -= 8;
        page.drawLine({ start: { x: 40, y: yPos }, end: { x: width - 40, y: yPos }, thickness: 1, color: goldColor });
        yPos -= 20;

        const specRows: [string, string][] = [
          [template.labelDescription, spec.intentSummary],
          [template.labelMetal, spec.metal ? `${spec.metal.type.replace("_", " ").toUpperCase()} — ${spec.metal.finish}` : "TBC"],
          [template.labelRingSize, spec.ringSize ? `${spec.ringSize.system} ${spec.ringSize.value}` : "TBC"],
          [template.labelStones, spec.stones ? `${spec.stones.kind.replace("_", " ")} — ${spec.stones.tier} quality` : "None"],
          [template.labelStyle, spec.styleTags.join(", ") || "Custom"],
          [template.labelComplexity, spec.complexity ?? "TBC"],
        ];

        for (const [label, value] of specRows) {
          page.drawText(`${label}:`, { x: 40, y: yPos, size: 10, font: fontBold, color: darkColor });
          page.drawText(value, { x: 160, y: yPos, size: 10, font: fontRegular, color: darkColor });
          yPos -= 18;
        }
        yPos -= 10;
      }
    }

    // Quote section
    if (session.quote) {
      interface QuoteData {
        retailPriceGBP?: number;
        retailRangeGBP?: { min: number; max: number };
        customerFacingSummary?: {
          metal?: string;
          stones?: string;
          ringSize?: string;
          style?: string;
          leadTime?: string;
        };
      }
      const quote = JSON.parse(session.quote) as QuoteData;

      page.drawText(template.headingPriceEstimate, {
        x: 40, y: yPos, size: 13, font: fontBold, color: goldColor,
      });
      yPos -= 8;
      page.drawLine({ start: { x: 40, y: yPos }, end: { x: width - 40, y: yPos }, thickness: 1, color: goldColor });
      yPos -= 20;

      if (quote.retailPriceGBP) {
        page.drawText(`${template.labelEstimatedPrice}: £${quote.retailPriceGBP.toLocaleString()}`, {
          x: 40, y: yPos, size: 16, font: fontBold, color: darkColor,
        });
        yPos -= 22;
      }

      if (quote.retailRangeGBP) {
        page.drawText(`${template.labelRange}: £${quote.retailRangeGBP.min.toLocaleString()} – £${quote.retailRangeGBP.max.toLocaleString()}`, {
          x: 40, y: yPos, size: 11, font: fontRegular, color: grayColor,
        });
        yPos -= 18;
      }

      if (quote.customerFacingSummary?.leadTime) {
        page.drawText(`${template.labelLeadTime}: ${quote.customerFacingSummary.leadTime}`, {
          x: 40, y: yPos, size: 10, font: fontRegular, color: grayColor,
        });
        yPos -= 30;
      }

      // Disclaimer box — use template text (main + VAT line combined, filtering empty parts)
      const fullDisclaimer = [template.disclaimerText.trim(), template.vatText.trim()]
        .filter(Boolean)
        .join(" ");
      page.drawRectangle({ x: 36, y: yPos - 48, width: width - 72, height: 56, color: rgb(0.95, 0.95, 0.95) });
      const words = fullDisclaimer.split(" ");
      let line = "";
      let disclaimerY = yPos - 12;
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (fontRegular.widthOfTextAtSize(testLine, 8) > width - 96) {
          page.drawText(line, { x: 44, y: disclaimerY, size: 8, font: fontRegular, color: grayColor });
          disclaimerY -= 12;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) page.drawText(line, { x: 44, y: disclaimerY, size: 8, font: fontRegular, color: grayColor });
      yPos -= 70;
    }

    // Fix F/G: sort by createdAt DESC so the most recent generated image comes first
    const generatedAssets = session.assets
      .filter((a) => a.type === "generated")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 3);

    if (generatedAssets.length > 0) {
      yPos -= 10;
      page.drawText("CONCEPT IMAGES", {
        x: 40, y: yPos, size: 13, font: fontBold, color: goldColor,
      });
      yPos -= 8;
      page.drawLine({ start: { x: 40, y: yPos }, end: { x: width - 40, y: yPos }, thickness: 1, color: goldColor });
      yPos -= 15;

      const imgSize = 160;
      let imgX = 40;
      let embedded = 0;
      for (const asset of generatedAssets) {
        try {
          const imgPath = join(process.cwd(), "public", asset.path);
          const imgBytes = await readFile(imgPath);
          // Detect format: PNG signature is 8 bytes: 89 50 4E 47 0D 0A 1A 0A
          // Check first 4 bytes for reliable detection
          const isPng = imgBytes.length >= 4 &&
            imgBytes[0] === 0x89 && imgBytes[1] === 0x50 &&
            imgBytes[2] === 0x4E && imgBytes[3] === 0x47;
          const embeddedImg = isPng
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes);
          page.drawImage(embeddedImg, { x: imgX, y: yPos - imgSize, width: imgSize, height: imgSize });
          imgX += imgSize + 20;
          embedded++;
        } catch {
          // Skip if image file not found or unreadable
        }
      }
      if (embedded === 0) {
        page.drawText("No concept image generated.", { x: 44, y: yPos - 20, size: 10, font: fontRegular, color: grayColor });
      }
      yPos -= imgSize + 20;
    } else {
      yPos -= 10;
      page.drawText("CONCEPT IMAGES", {
        x: 40, y: yPos, size: 13, font: fontBold, color: goldColor,
      });
      yPos -= 28;
      page.drawText("No concept image generated.", { x: 44, y: yPos, size: 10, font: fontRegular, color: grayColor });
      yPos -= 20;
    }

    // Footer — use template values
    page.drawLine({ start: { x: 40, y: 80 }, end: { x: width - 40, y: 80 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    page.drawText(template.shopName, { x: 40, y: 65, size: 9, font: fontBold, color: darkColor });
    if (template.shopAddress) page.drawText(template.shopAddress, { x: 40, y: 52, size: 8, font: fontRegular, color: grayColor });
    if (template.shopPhone) page.drawText(template.shopPhone, { x: 40, y: 40, size: 8, font: fontRegular, color: grayColor });
    if (template.shopEmail) page.drawText(template.shopEmail, { x: 40, y: 28, size: 8, font: fontRegular, color: grayColor });
    page.drawText(`Session ref: ${id}`, { x: width - 200, y: 28, size: 7, font: fontRegular, color: rgb(0.7, 0.7, 0.7) });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ring-estimate-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "pdf_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
