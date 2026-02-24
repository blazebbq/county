import OpenAI from "openai";
import { getOpenAIClient } from "./client";
import { DesignSpecSchema, DesignSpec } from "./designSpecSchema";
import { readFileSync } from "fs";
import { join } from "path";

const SENSITIVE_PATTERNS = [
  /cost\s+price/i,
  /wholesale/i,
  /margin\s+breakdown/i,
  /profit\s+margin/i,
  /all[\s-]in\s+cost/i,
  /\bcost\b.*\btable/i,
];

function hasSensitiveContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

function loadSystemPrompt(): string {
  try {
    return readFileSync(join(process.cwd(), "prompts", "system.txt"), "utf-8");
  } catch {
    return "You are a jewellery design kiosk assistant. Help customers design rings.";
  }
}

function extractJsonBlock(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function extractCustomerText(text: string): string {
  return text.replace(/```json[\s\S]*?```/g, "").trim();
}

async function callWithRetry(
  client: OpenAI,
  messages: OpenAI.ChatCompletionMessageParam[],
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content ?? "";
    } catch (err) {
      lastError = err as Error;
      console.log(JSON.stringify({ level: "warn", event: "llm_retry", attempt, error: String(err) }));
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("LLM call failed after retries");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  customerText: string;
  designSpec: DesignSpec | null;
  rawAssistantMessage: string;
}

export async function processMessage(
  transcript: ChatMessage[],
  userMessage: string,
  imageDataUrls?: string[]
): Promise<ChatResponse> {
  const client = getOpenAIClient();
  const systemPrompt = loadSystemPrompt();

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...transcript.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (imageDataUrls && imageDataUrls.length > 0) {
    const contentParts: OpenAI.ChatCompletionContentPart[] = [
      { type: "text", text: userMessage },
      ...imageDataUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url, detail: "low" as const },
      })),
    ];
    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  let rawResponse = await callWithRetry(client, messages);

  if (hasSensitiveContent(rawResponse)) {
    console.log(JSON.stringify({ level: "warn", event: "sensitive_content_detected", regenerating: true }));
    messages.push({ role: "assistant", content: rawResponse });
    messages.push({
      role: "user",
      content: "Please rewrite your response without any mention of costs, prices, margins, or financial breakdowns.",
    });
    rawResponse = await callWithRetry(client, messages);
  }

  const customerText = extractCustomerText(rawResponse);
  const jsonBlock = extractJsonBlock(rawResponse);

  let designSpec: DesignSpec | null = null;
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock) as unknown;
      const validated = DesignSpecSchema.safeParse(parsed);
      if (validated.success) {
        designSpec = validated.data;
      } else {
        const repairMessages: OpenAI.ChatCompletionMessageParam[] = [
          ...messages,
          { role: "assistant", content: rawResponse },
          {
            role: "user",
            content: `The JSON in your response failed validation: ${JSON.stringify(validated.error.issues)}. Please fix only the JSON block, keeping the same customer message.`,
          },
        ];
        const repaired = await callWithRetry(client, repairMessages);
        const repairedJson = extractJsonBlock(repaired);
        if (repairedJson) {
          const revalidated = DesignSpecSchema.safeParse(JSON.parse(repairedJson) as unknown);
          if (revalidated.success) designSpec = revalidated.data;
        }
      }
    } catch {
      // JSON parse error - spec remains null
    }
  }

  return { customerText, designSpec, rawAssistantMessage: rawResponse };
}

export async function generateImagePrompts(designSpec: DesignSpec): Promise<string[]> {
  return designSpec.imagePrompts.slice(0, 3);
}
