import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffAuthenticated } from "@/lib/auth";
import { refreshMetalRates } from "@/lib/pricing/metalRates";

export async function GET(_req: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.metalRateCache.findUnique({ where: { id: "default" } });
  if (!row) {
    return NextResponse.json({ updatedAt: null, source: null });
  }

  return NextResponse.json({
    goldGBPPerGram24k: row.goldGBPPerGram24k,
    updatedAt: row.updatedAt.toISOString(),
    source: row.source,
  });
}

export async function POST(_req: NextRequest) {
  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await refreshMetalRates();
  const row = await prisma.metalRateCache.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    goldGBPPerGram24k: row?.goldGBPPerGram24k ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    source: row?.source ?? null,
  });
}
