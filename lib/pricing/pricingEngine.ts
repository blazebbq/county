import { DesignSpec } from "@/lib/llm/designSpecSchema";
import { getMetalSpotRates, getMetalBaseId } from "@/lib/metalSpot";
import pricingConfig from "@/config/pricing.json";
import diamondConfig from "@/config/diamonds_lab.json";

type QualityTier = "good" | "better" | "best";
type StoneKind = "lab_diamond" | "moissanite";
type DiamondPriceTable = Record<StoneKind, Record<QualityTier, Record<string, number>>>;

const diamondPrices = diamondConfig.pricePerCarat as DiamondPriceTable;

interface StaffCosting {
  metalCost: number;
  stoneCost: number;
  labourCost: number;
  overhead: number;
  totalCost: number;
  assumptions: string[];
  timestamp: string;
}

export interface QuoteResult {
  retailPriceGBP: number;
  retailRangeGBP: { min: number; max: number };
  estimateDisclaimer: string;
  customerFacingSummary: {
    metal: string;
    stones: string;
    ringSize: string;
    style: string;
    leadTime: string;
  };
  staffOnlyCosting: StaffCosting;
}

function mmToCaratEstimate(sizeMm: number): number {
  const map = diamondConfig.mmToCaratMap;
  for (const entry of map) {
    if (sizeMm >= entry.mmMin && sizeMm <= entry.mmMax) {
      return entry.caratEst;
    }
  }
  return map[map.length - 1].caratEst;
}

function getStonePricePerUnit(kind: string, tier: string, caratEst: number): number {
  const stoneKind = kind as StoneKind;
  const qualityTier = tier as QualityTier;
  const tierPrices = diamondPrices[stoneKind]?.[qualityTier];
  if (!tierPrices) return 0;

  const caratKeys = Object.keys(tierPrices).map(Number);
  let closest = caratKeys[0] ?? 0;
  let minDiff = Math.abs(caratEst - closest);
  for (const k of caratKeys) {
    const diff = Math.abs(caratEst - k);
    if (diff < minDiff) {
      minDiff = diff;
      closest = k;
    }
  }

  const pricePerCarat = tierPrices[String(closest)] ?? 0;
  return pricePerCarat * caratEst;
}

function formatMetalName(metalType: string): string {
  const names: Record<string, string> = {
    "9k_yellow": "9ct Yellow Gold",
    "14k_yellow": "14ct Yellow Gold",
    "18k_yellow": "18ct Yellow Gold",
    "14k_white": "14ct White Gold",
    "18k_white": "18ct White Gold",
    "sterling_silver": "925 Sterling Silver",
    "platinum_950": "Platinum 950",
  };
  return names[metalType] ?? metalType;
}

function formatStonesDescription(spec: DesignSpec): string {
  if (!spec.stones || spec.stones.kind === "none") return "No stones";
  const { kind, tier, list } = spec.stones;
  const totalCount = list.reduce((sum, s) => sum + s.count, 0);
  const kindName = kind === "lab_diamond" ? "Lab Diamond" : "Moissanite";
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `${totalCount}x ${kindName} (${tierName} quality)`;
}

function getLeadTime(complexity: string | null): string {
  switch (complexity) {
    case "simple": return "2–3 weeks";
    case "medium": return "3–5 weeks";
    case "complex": return "5–8 weeks";
    default: return "3–6 weeks";
  }
}

export async function computeQuote(spec: DesignSpec): Promise<QuoteResult> {
  const spotRates = await getMetalSpotRates();
  const config = pricingConfig;
  const assumptions: string[] = [];

  let metalCost = 0;
  if (spec.metal && spec.estimatedGoldWeightGrams) {
    const baseId = getMetalBaseId(spec.metal.type);
    // Last-resort hardcoded fallback (gold ~£58.50/g) if both spot feed and config are missing
    const DEFAULT_GOLD_SPOT_GBP_PER_GRAM = 58.5;
    const spotGBPPerGram = spotRates[baseId] ?? (config.metalSpotFallbackGBPPerGram as Record<string, number>)[baseId] ?? DEFAULT_GOLD_SPOT_GBP_PER_GRAM;
    const purity = (config.metalPurityMultiplier as Record<string, number>)[spec.metal.type] ?? 0.585;
    const avgWeightG = (spec.estimatedGoldWeightGrams.min + spec.estimatedGoldWeightGrams.max) / 2;
    const rawMetalCost = avgWeightG * purity * spotGBPPerGram;
    const withPremium = rawMetalCost * (1 + config.metalPremiumPercent / 100);
    const withScrap = withPremium * (1 + config.scrapLossPercent / 100);
    metalCost = Math.round(withScrap);
    assumptions.push(`Metal: ${formatMetalName(spec.metal.type)}, ~${avgWeightG.toFixed(1)}g, spot £${spotGBPPerGram.toFixed(2)}/g`);
  } else {
    assumptions.push("Metal: no spec provided, using £0");
  }

  let stoneCost = 0;
  if (spec.stones && spec.stones.kind !== "none" && spec.stones.list.length > 0) {
    for (const stone of spec.stones.list) {
      const caratEst = mmToCaratEstimate(stone.sizeMm);
      const pricePerUnit = getStonePricePerUnit(spec.stones.kind, spec.stones.tier, caratEst);
      stoneCost += pricePerUnit * stone.count;
      assumptions.push(`Stone: ${stone.count}x ${stone.sizeMm}mm (${caratEst}ct est.) ${spec.stones.kind} ${spec.stones.tier} @ £${pricePerUnit.toFixed(0)}/unit`);
    }
    stoneCost = Math.round(stoneCost);
  } else {
    assumptions.push("Stones: none");
  }

  let paveSurcharge = 0;
  if (spec.stones?.list) {
    for (const stone of spec.stones.list) {
      if (stone.setting === "pave") {
        paveSurcharge += stone.count * (config.labourRates.pavePerStone ?? 8);
      }
    }
  }

  const complexity = spec.complexity ?? "medium";
  const labourBase = (config.labourRates as Record<string, number>)[complexity] ?? 220;
  const labourCost = labourBase + paveSurcharge;
  assumptions.push(`Labour: ${complexity} complexity = £${labourBase} + £${paveSurcharge} pavé surcharge`);

  const overhead = config.overheadBuffer;
  const totalCost = metalCost + stoneCost + labourCost + overhead;
  const retail = totalCost * 2;
  const retailRounded = Math.ceil(retail / 10) * 10;
  const rangeMin = Math.floor((retailRounded * 0.8) / 10) * 10;
  const rangeMax = Math.ceil((retailRounded * 1.2) / 10) * 10;

  const staffCosting: StaffCosting = {
    metalCost,
    stoneCost,
    labourCost,
    overhead,
    totalCost,
    assumptions,
    timestamp: new Date().toISOString(),
  };

  return {
    retailPriceGBP: retailRounded,
    retailRangeGBP: { min: rangeMin, max: rangeMax },
    estimateDisclaimer:
      "This is an indicative estimate only. Final price may vary based on exact specifications, current material costs, and craftsperson assessment. VAT may apply. No obligation to purchase.",
    customerFacingSummary: {
      metal: spec.metal ? formatMetalName(spec.metal.type) : "To be confirmed",
      stones: formatStonesDescription(spec),
      ringSize: spec.ringSize ? `${spec.ringSize.system} ${spec.ringSize.value}` : "To be confirmed",
      style: spec.styleTags.slice(0, 3).join(", ") || "Custom",
      leadTime: getLeadTime(spec.complexity),
    },
    staffOnlyCosting: staffCosting,
  };
}
