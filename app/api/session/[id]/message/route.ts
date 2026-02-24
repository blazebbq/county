import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMessage, ChatMessage } from "@/lib/llm/chatService";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { z } from "zod";

const RequestSchema = z.object({
  message: z.string().min(1).max(2000),
  imageDataUrls: z.array(z.string().startsWith("data:")).max(3).optional(),
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

    const transcript: ChatMessage[] = JSON.parse(session.transcript || "[]") as ChatMessage[];
    if (transcript.length > 40) {
      return NextResponse.json({ error: "Session message limit reached" }, { status: 429 });
    }

    const body = await req.json() as unknown;
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
    }

    const { message, imageDataUrls } = parsed.data;

    const storedImageUrls: string[] = [];
    if (imageDataUrls && imageDataUrls.length > 0) {
      const uploadsDir = join(process.cwd(), "public", "uploads", id);
      await mkdir(uploadsDir, { recursive: true });

      for (const dataUrl of imageDataUrls) {
        const commaIdx = dataUrl.indexOf(",");
        const header = dataUrl.slice(0, commaIdx);
        const base64Data = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:([^;]+);/);
        const mimeType = mimeMatch?.[1] ?? "image/png";
        const ext = mimeType.split("/")[1] ?? "png";
        const filename = `${randomUUID()}.${ext}`;
        const filepath = join(uploadsDir, filename);

        await writeFile(filepath, Buffer.from(base64Data, "base64"));

        await prisma.uploadedAsset.create({
          data: {
            sessionId: id,
            type: "sketch",
            path: `/uploads/${id}/${filename}`,
            mimeType,
          },
        });

        storedImageUrls.push(dataUrl);
      }
    }

    const result = await processMessage(transcript, message, storedImageUrls.length > 0 ? storedImageUrls : undefined);

    const newTranscript: ChatMessage[] = [
      ...transcript,
      { role: "user", content: message },
      { role: "assistant", content: result.rawAssistantMessage },
    ];

    await prisma.session.update({
      where: { id },
      data: {
        transcript: JSON.stringify(newTranscript),
        designSpec: result.designSpec ? JSON.stringify(result.designSpec) : session.designSpec,
      },
    });

    console.log(JSON.stringify({ level: "info", event: "message_processed", sessionId: id }));

    return NextResponse.json({
      reply: result.customerText,
      designSpec: result.designSpec,
      questionsNext: result.designSpec?.questionsNext ?? [],
    });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "message_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
