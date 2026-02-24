import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffAuthenticated } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          assets: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({
    lead: {
      ...lead,
      session: {
        ...lead.session,
        transcript: JSON.parse(lead.session.transcript || "[]") as unknown[],
        designSpec: lead.session.designSpec ? JSON.parse(lead.session.designSpec) as unknown : null,
        quote: lead.session.quote ? JSON.parse(lead.session.quote) as unknown : null,
      },
    },
  });
}
