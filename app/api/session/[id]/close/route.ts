import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.session.update({
      where: { id },
      data: { status: "closed" },
    });

    const cleanupHours = parseInt(process.env.ASSET_CLEANUP_HOURS ?? "24", 10);
    console.log(JSON.stringify({
      level: "info",
      event: "session_closed",
      sessionId: id,
      cleanupScheduled: `${cleanupHours}h`,
    }));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "close_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to close session" }, { status: 500 });
  }
}
