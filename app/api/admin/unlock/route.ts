import { NextRequest, NextResponse } from "next/server";
import { verifyStaffPin, getStaffCookieName } from "@/lib/auth";
import { z } from "zod";

const PinSchema = z.object({ pin: z.string().min(4).max(12) });

export async function POST(req: NextRequest) {
  const body = await req.json() as unknown;
  const parsed = PinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid PIN format" }, { status: 400 });
  }

  if (!verifyStaffPin(parsed.data.pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getStaffCookieName(), "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  console.log(JSON.stringify({ level: "info", event: "staff_login" }));
  return response;
}
