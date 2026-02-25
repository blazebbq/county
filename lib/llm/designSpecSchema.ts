import { z } from "zod";

// Normalise "9ct_yellow" → "9k_yellow" etc. (LLM sometimes uses "ct" notation)
function normaliseMetalType(v: unknown): unknown {
  if (typeof v !== "string") return v;
  return v
    .replace(/^9ct_/, "9k_")
    .replace(/^14ct_/, "14k_")
    .replace(/^18ct_/, "18k_")
    .replace(/^22ct_/, "22k_")
    .replace(/^24ct_/, "24k_");
}

// Normalise complexity: "low" → "simple", "high" → "complex"
function normaliseComplexity(v: unknown): unknown {
  if (v === "low") return "simple";
  if (v === "high") return "complex";
  return v;
}

export const RingSizeSchema = z.object({
  system: z.enum(["UK", "US", "EU"]),
  value: z.string(),
});

export const MetalSchema = z.object({
  type: z.preprocess(
    normaliseMetalType,
    z.enum([
      "9k_yellow",
      "14k_yellow",
      "18k_yellow",
      "9k_white",
      "14k_white",
      "18k_white",
      "9k_rose",
      "14k_rose",
      "18k_rose",
      "sterling_silver",
      "platinum_950",
    ])
  ),
  // LLM correctly sends null when finish is not yet known
  finish: z.enum(["polished", "matte", "hammered"]).nullable(),
});

export const StoneItemSchema = z.object({
  position: z.enum(["center", "cluster", "branch", "band"]),
  shape: z.enum(["round", "oval", "cushion", "pear", "emerald", "princess", "marquise", "heart"]),
  sizeMm: z.number().positive(),
  count: z.number().int().positive(),
  setting: z.enum(["pave", "prong", "bezel", "channel", "tension"]),
});

export const StonesSchema = z.object({
  // null when no stones chosen yet
  kind: z.enum(["lab_diamond", "moissanite", "none"]).nullable(),
  tier: z.enum(["good", "better", "best"]).nullable(),
  list: z.array(StoneItemSchema),
});

export const WeightEstimateSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

export const ConstraintsSchema = z.object({
  // LLM sends null when budget is not yet specified
  budgetGBP: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .nullable()
    .optional(),
  wearability: z.enum(["low_profile", "statement"]),
  snagRisk: z.enum(["low", "medium", "high"]),
});

export const DesignSpecSchema = z.object({
  intentSummary: z.string(),
  ringSize: RingSizeSchema.nullable(),
  metal: MetalSchema.nullable(),
  stones: StonesSchema.nullable(),
  estimatedGoldWeightGrams: WeightEstimateSchema.nullable(),
  complexity: z.preprocess(normaliseComplexity, z.enum(["simple", "medium", "complex"]).nullable()),
  styleTags: z.array(z.string()),
  imagePrompts: z.array(z.string()).min(1).max(3),
  constraints: ConstraintsSchema.nullable(),
  questionsNext: z.array(z.string()),
});

export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type Metal = z.infer<typeof MetalSchema>;
export type StoneItem = z.infer<typeof StoneItemSchema>;
export type RingSize = z.infer<typeof RingSizeSchema>;
