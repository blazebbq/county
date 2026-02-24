import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStaffAuthenticated } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await isStaffAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: { assets: true, adminEvents: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      session: {
        ...session,
        transcript: JSON.parse(session.transcript || "[]") as unknown[],
        designSpec: session.designSpec ? JSON.parse(session.designSpec) as unknown : null,
        quote: session.quote ? JSON.parse(session.quote) as unknown : null,
        imageRefs: JSON.parse(session.imageRefs || "[]") as string[],
      },
    });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "admin_session_fetch_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}
