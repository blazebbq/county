import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DesignSpecSchema } from "@/lib/llm/designSpecSchema";
import { computeQuote } from "@/lib/pricing/pricingEngine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Session not found or closed" }, { status: 404 });
    }

    if (!session.designSpec) {
      return NextResponse.json({ error: "No design spec available" }, { status: 400 });
    }

    const parsedSpec = DesignSpecSchema.safeParse(JSON.parse(session.designSpec) as unknown);
    if (!parsedSpec.success) {
      return NextResponse.json({ error: "Invalid design spec" }, { status: 400 });
    }

    const quoteResult = await computeQuote(parsedSpec.data);

    await prisma.session.update({
      where: { id },
      data: { quote: JSON.stringify(quoteResult) },
    });

    // Strip staff-only costing before returning to client
    const { staffOnlyCosting: _stripped, ...customerQuote } = quoteResult;

    console.log(JSON.stringify({ level: "info", event: "quote_generated", sessionId: id, retail: quoteResult.retailPriceGBP }));

    return NextResponse.json({ quote: customerQuote });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "quote_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to compute quote" }, { status: 500 });
  }
}
