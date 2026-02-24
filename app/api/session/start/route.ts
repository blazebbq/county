import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest) {
  try {
    const session = await prisma.session.create({
      data: {
        status: "active",
        transcript: "[]",
        imageRefs: "[]",
      },
    });

    console.log(JSON.stringify({ level: "info", event: "session_started", sessionId: session.id }));
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "session_start_failed", error: String(err) }));
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
