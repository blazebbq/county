import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DesignSpecSchema } from "@/lib/llm/designSpecSchema";
import { computeQuote } from "@/lib/pricing/pricingEngine";
import { z } from "zod";
import nodemailer from "nodemailer";

const DEFAULT_SMTP_PORT = 587;

/** Escape HTML special characters to prevent XSS in email HTML body. */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SubmitQuoteSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email(),
  renderImageUrl: z.string().optional(),
  recipientEmail: z.string().email().optional(),
});

export async function POST(
  req: NextRequest,
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

    const body = await req.json() as unknown;
    const parsed = SubmitQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid fields", details: parsed.error.issues }, { status: 400 });
    }

    const { customerName, customerEmail, renderImageUrl, recipientEmail } = parsed.data;

    // Parse and validate the design spec
    const parsedSpec = DesignSpecSchema.safeParse(JSON.parse(session.designSpec) as unknown);
    if (!parsedSpec.success) {
      return NextResponse.json({ error: "Invalid design spec" }, { status: 400 });
    }

    // Always recompute quote fresh
    const quoteResult = await computeQuote(parsedSpec.data);

    // Update session quote in DB
    await prisma.session.update({
      where: { id },
      data: {
        quote: JSON.stringify(quoteResult),
        customerEmail,
      },
    });

    // Save QuoteSubmission to local SQLite
    await prisma.quoteSubmission.create({
      data: {
        sessionId: id,
        customerName,
        customerEmail,
        designSpecJson: session.designSpec,
        renderImageUrl: renderImageUrl ?? null,
        priceEstimate: quoteResult.retailPriceGBP,
      },
    });

    // Send email if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const toAddress = recipientEmail ?? process.env.SMTP_TO ?? process.env.SMTP_FROM;

    if (smtpHost && toAddress) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT ?? String(DEFAULT_SMTP_PORT), 10),
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });

        // Escape all user-supplied values before inserting into HTML
        const safeCustomerName = escHtml(customerName);
        const safeCustomerEmail = escHtml(customerEmail);
        const designSummary = escHtml(parsedSpec.data.intentSummary ?? "Custom ring design");
        const metal = escHtml(parsedSpec.data.metal?.type ?? "TBC");
        const ringSize = parsedSpec.data.ringSize
          ? escHtml(`${parsedSpec.data.ringSize.system} ${parsedSpec.data.ringSize.value}`)
          : "TBC";
        const stones = parsedSpec.data.stones?.kind !== "none"
          ? escHtml(`${parsedSpec.data.stones?.kind} (${parsedSpec.data.stones?.tier})`)
          : "No stones";
        const complexity = escHtml(parsedSpec.data.complexity ?? "TBC");
        const styleTags = escHtml(parsedSpec.data.styleTags.join(", "));
        const timestamp = escHtml(new Date().toISOString());
        const safeSessionId = escHtml(id);
        const safeSpecJson = escHtml(JSON.stringify(parsedSpec.data, null, 2));
        // renderImageUrl is a server-stored path, not user-supplied — safe to use but still escape
        const safeRenderUrl = renderImageUrl ? escHtml(renderImageUrl) : null;

        const htmlBody = `
          <h2>New Ring Design Quote</h2>
          <h3>Customer Details</h3>
          <p><strong>Name:</strong> ${safeCustomerName}</p>
          <p><strong>Email:</strong> ${safeCustomerEmail}</p>
          <h3>Design Summary</h3>
          <p>${designSummary}</p>
          <table border="1" cellpadding="6" cellspacing="0">
            <tr><td><strong>Metal</strong></td><td>${metal}</td></tr>
            <tr><td><strong>Ring Size</strong></td><td>${ringSize}</td></tr>
            <tr><td><strong>Stones</strong></td><td>${stones}</td></tr>
            <tr><td><strong>Complexity</strong></td><td>${complexity}</td></tr>
            <tr><td><strong>Style</strong></td><td>${styleTags}</td></tr>
          </table>
          <h3>Price Estimate</h3>
          <p><strong>Retail Price:</strong> £${quoteResult.retailPriceGBP.toLocaleString()}</p>
          <p><strong>Range:</strong> £${quoteResult.retailRangeGBP.min.toLocaleString()} – £${quoteResult.retailRangeGBP.max.toLocaleString()}</p>
          <p><em>${escHtml(quoteResult.estimateDisclaimer)}</em></p>
          ${safeRenderUrl ? `<h3>Render</h3><p><a href="${safeRenderUrl}">View render image</a></p>` : ""}
          <h3>Full Design Spec JSON</h3>
          <pre style="background:#f0f0f0;padding:12px;font-size:12px;">${safeSpecJson}</pre>
          <p style="color:#666;font-size:12px;">Submitted: ${timestamp} | Session: ${safeSessionId}</p>
        `;

        await transporter.sendMail({
          from: process.env.SMTP_FROM ?? "kiosk@jewelleryshop.com",
          to: toAddress,
          subject: `New Ring Design Quote — ${customerName} — £${quoteResult.retailPriceGBP}`,
          html: htmlBody,
        });

        console.log(JSON.stringify({ level: "info", event: "quote_email_sent", sessionId: id, to: toAddress }));
      } catch (emailErr) {
        // Log but don't fail the request — email is best-effort
        console.log(JSON.stringify({ level: "warn", event: "quote_email_failed", sessionId: id, error: String(emailErr) }));
      }
    } else {
      console.log(JSON.stringify({ level: "info", event: "quote_email_skipped", reason: "no_smtp_config" }));
    }

    console.log(JSON.stringify({ level: "info", event: "quote_submitted", sessionId: id, customer: customerEmail }));

    return NextResponse.json({
      success: true,
      quote: {
        retailPriceGBP: quoteResult.retailPriceGBP,
        retailRangeGBP: quoteResult.retailRangeGBP,
        estimateDisclaimer: quoteResult.estimateDisclaimer,
        customerFacingSummary: quoteResult.customerFacingSummary,
      },
    });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "submit_quote_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to submit quote" }, { status: 500 });
  }
}
