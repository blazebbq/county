import OpenAI from "openai";
import { getOpenAIClient } from "./client";
import { DesignSpecSchema, DesignSpec } from "./designSpecSchema";
import { readFileSync } from "fs";
import { join } from "path";

// Log model configuration at module load time (server startup)
const TEXT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-mini";
const MAX_OUTPUT_TOKENS = 4000;
console.log(JSON.stringify({ level: "info", event: "model_config", textModel: TEXT_MODEL, imageModel: "gpt-image-1" }));

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

/** One message entry for the Responses API. */
type EasyMsg = OpenAI.Responses.EasyInputMessage;

/** Build a user message — plain text or multimodal (text + images). */
function buildUserMessage(text: string, imageDataUrls?: string[]): EasyMsg {
  if (!imageDataUrls || imageDataUrls.length === 0) {
    return { role: "user", content: text };
  }
  const contentParts: OpenAI.Responses.ResponseInputContent[] = [
    { type: "input_text", text },
    ...imageDataUrls.map((url): OpenAI.Responses.ResponseInputImage => ({
      type: "input_image",
      image_url: url,
      detail: "low",
    })),
  ];
  return { role: "user", content: contentParts };
}

async function callWithRetry(
  client: OpenAI,
  input: EasyMsg[],
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.responses.create({
        model: TEXT_MODEL,
        input,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      });
      return response.output_text ?? "";
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

  // Build input array: system → transcript history → new user message
  const input: EasyMsg[] = [
    { role: "system", content: systemPrompt },
    ...transcript.map((m): EasyMsg => ({ role: m.role, content: m.content })),
    buildUserMessage(userMessage, imageDataUrls),
  ];

  let rawResponse = await callWithRetry(client, input);

  if (hasSensitiveContent(rawResponse)) {
    console.log(JSON.stringify({ level: "warn", event: "sensitive_content_detected", regenerating: true }));
    // Append assistant response + sanitise request, then retry
    const repairInput: EasyMsg[] = [
      ...input,
      { role: "assistant", content: rawResponse },
      { role: "user", content: "Please rewrite your response without any mention of costs, prices, margins, or financial breakdowns." },
    ];
    rawResponse = await callWithRetry(client, repairInput);
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
        // Ask the model to repair the JSON
        const repairInput: EasyMsg[] = [
          ...input,
          { role: "assistant", content: rawResponse },
          {
            role: "user",
            content: `The JSON in your response failed validation: ${JSON.stringify(validated.error.issues)}. Please fix only the JSON block, keeping the same customer message.`,
          },
        ];
        const repaired = await callWithRetry(client, repairInput);
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

