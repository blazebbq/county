import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenAIClient } from "@/lib/llm/client";
import { DesignSpecSchema } from "@/lib/llm/designSpecSchema";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

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
      return NextResponse.json({ error: "No design spec available. Please complete the design first." }, { status: 400 });
    }

    const parsedSpec = DesignSpecSchema.safeParse(JSON.parse(session.designSpec) as unknown);
    if (!parsedSpec.success) {
      return NextResponse.json({ error: "Invalid design spec" }, { status: 400 });
    }

    const spec = parsedSpec.data;
    // Generate exactly one image using the first available prompt
    const prompts = spec.imagePrompts.slice(0, 1);

    if (prompts.length === 0) {
      return NextResponse.json({ error: "No image prompts in design spec" }, { status: 400 });
    }

    const client = getOpenAIClient(); // throws if OPENAI_API_KEY missing
    const generatedUrls: string[] = [];
    const uploadsDir = join(process.cwd(), "public", "uploads", id);
    await mkdir(uploadsDir, { recursive: true });

    for (const prompt of prompts) {
      try {
        // gpt-image-1 uses response_format: "b64_json" (returns base64-encoded PNG data).
        // The API accepts response_format on the images.generate call for this model.
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt: `Professional jewellery photography: ${prompt}. White background, studio lighting, photorealistic, high detail.`,
          n: 1,
          size: "1024x1024",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response_format: "b64_json" as any, // required for gpt-image-1 to return base64
        });

        // gpt-image-1 always returns b64_json
        const b64 = response.data?.[0]?.b64_json;
        if (b64) {
          const buffer = Buffer.from(b64, "base64");
          const filename = `generated_${randomUUID()}.png`;
          const filepath = join(uploadsDir, filename);
          await writeFile(filepath, buffer);

          const localPath = `/uploads/${id}/${filename}`;
          await prisma.uploadedAsset.create({
            data: {
              sessionId: id,
              type: "generated",
              path: localPath,
              mimeType: "image/png",
            },
          });

          generatedUrls.push(localPath);
        } else {
          // Fallback: some responses may still include url field
          const imageUrl = response.data?.[0]?.url;
          if (imageUrl) {
            const imgResponse = await fetch(imageUrl);
            const buffer = Buffer.from(await imgResponse.arrayBuffer());
            const filename = `generated_${randomUUID()}.png`;
            const filepath = join(uploadsDir, filename);
            await writeFile(filepath, buffer);

            const localPath = `/uploads/${id}/${filename}`;
            await prisma.uploadedAsset.create({
              data: {
                sessionId: id,
                type: "generated",
                path: localPath,
                mimeType: "image/png",
              },
            });

            generatedUrls.push(localPath);
          }
        }
      } catch (err) {
        console.log(JSON.stringify({ level: "warn", event: "image_gen_failed", prompt: prompt.slice(0, 50), error: String(err) }));
      }
    }

    if (generatedUrls.length === 0) {
      return NextResponse.json({ error: "Image generation failed. Please try again." }, { status: 500 });
    }

    const existingRefs: string[] = JSON.parse(session.imageRefs || "[]") as string[];
    await prisma.session.update({
      where: { id },
      data: { imageRefs: JSON.stringify([...existingRefs, ...generatedUrls]) },
    });

    console.log(JSON.stringify({ level: "info", event: "images_generated", sessionId: id, count: generatedUrls.length }));

    return NextResponse.json({ imageUrls: generatedUrls });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", event: "generate_images_failed", sessionId: id, error: String(err) }));
    return NextResponse.json({ error: "Failed to generate images" }, { status: 500 });
  }
}
