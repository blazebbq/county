import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import nodemailer from "nodemailer";

const LeadSchema = z.object({
  firstName: z.string().min(1).max(100).transform((s) => s.trim()),
  email: z.string().email().max(200),
  // Accept UK phone: +44, 07xx, with spaces, dashes, brackets
  phone: z
    .string()
    .min(7)
    .max(30)
    .regex(/^[\+\d][\d\s\-\(\)]{6,28}$/, "Invalid phone number format"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json() as unknown;
  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  const { firstName, email, phone } = parsed.data;

  // Upsert — allow re-submission on the same session
  const lead = await prisma.lead.upsert({
    where: { sessionId },
    create: { firstName, email, phone, sessionId },
    update: { firstName, email, phone },
  });

  // Update session email
  await prisma.session.update({ where: { id: sessionId }, data: { customerEmail: email } });

  // Fire-and-forget notification email
  void sendNotificationEmail(lead.id, firstName, email, phone, sessionId);

  console.log(JSON.stringify({ level: "info", event: "lead_captured", sessionId, leadId: lead.id }));
  return NextResponse.json({ success: true, leadId: lead.id });
}

async function sendNotificationEmail(
  leadId: string,
  firstName: string,
  email: string,
  phone: string,
  sessionId: string
) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) return;

  // Load notification email from DB settings
  let notificationEmail = process.env.SMTP_TO ?? process.env.SMTP_FROM;
  try {
    const settings = await prisma.pdfTemplateSettings.findUnique({ where: { id: "default" } });
    if (settings?.notificationEmail) notificationEmail = settings.notificationEmail;
  } catch { /* ignore */ }

  if (!notificationEmail) return;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const timestamp = new Date().toISOString();
    const leadDetailUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/leads/${leadId}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "kiosk@jewelleryshop.com",
      to: notificationEmail,
      subject: `New Ring Builder Customer — ${firstName}`,
      html: `
        <h2>A new customer has started the ring builder</h2>
        <table border="1" cellpadding="6" cellspacing="0">
          <tr><td><strong>First Name</strong></td><td>${escHtml(firstName)}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escHtml(email)}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${escHtml(phone)}</td></tr>
          <tr><td><strong>Session</strong></td><td>${escHtml(sessionId)}</td></tr>
          <tr><td><strong>Timestamp</strong></td><td>${escHtml(timestamp)}</td></tr>
        </table>
        <p><a href="${escHtml(leadDetailUrl)}">View lead in admin panel</a></p>
      `,
    });
  } catch (err) {
    console.log(JSON.stringify({ level: "warn", event: "lead_notification_email_failed", error: String(err) }));
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
