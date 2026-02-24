import { z } from "zod";

export const RingSizeSchema = z.object({
  system: z.enum(["UK", "US", "EU"]),
  value: z.string(),
});

export const MetalSchema = z.object({
  type: z.enum([
    "9k_yellow",
    "14k_yellow",
    "18k_yellow",
    "14k_white",
    "18k_white",
    "sterling_silver",
    "platinum_950",
  ]),
  finish: z.enum(["polished", "matte", "hammered"]),
});

export const StoneItemSchema = z.object({
  position: z.enum(["center", "cluster", "branch", "band"]),
  shape: z.enum(["round", "oval", "cushion", "pear", "emerald", "princess", "marquise", "heart"]),
  sizeMm: z.number().positive(),
  count: z.number().int().positive(),
  setting: z.enum(["pave", "prong", "bezel", "channel", "tension"]),
});

export const StonesSchema = z.object({
  kind: z.enum(["lab_diamond", "moissanite", "none"]),
  tier: z.enum(["good", "better", "best"]),
  list: z.array(StoneItemSchema),
});

export const WeightEstimateSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
});

export const ConstraintsSchema = z.object({
  budgetGBP: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  wearability: z.enum(["low_profile", "statement"]),
  snagRisk: z.enum(["low", "medium", "high"]),
});

export const DesignSpecSchema = z.object({
  intentSummary: z.string(),
  ringSize: RingSizeSchema.nullable(),
  metal: MetalSchema.nullable(),
  stones: StonesSchema.nullable(),
  estimatedGoldWeightGrams: WeightEstimateSchema.nullable(),
  complexity: z.enum(["simple", "medium", "complex"]).nullable(),
  styleTags: z.array(z.string()),
  imagePrompts: z.array(z.string()).min(1).max(3),
  constraints: ConstraintsSchema.nullable(),
  questionsNext: z.array(z.string()),
});

export type DesignSpec = z.infer<typeof DesignSpecSchema>;
export type Metal = z.infer<typeof MetalSchema>;
export type StoneItem = z.infer<typeof StoneItemSchema>;
export type RingSize = z.infer<typeof RingSizeSchema>;
