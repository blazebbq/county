import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffAuthenticated } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      session: {
        select: { id: true, status: true, designSpec: true, quote: true, assets: { where: { type: "generated" } } },
      },
    },
  });

  return NextResponse.json({ leads });
}
