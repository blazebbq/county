import pricingConfig from "@/config/pricing.json";

interface MetalSpotCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: MetalSpotCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getMetalSpotRates(): Promise<Record<string, number>> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const metalsApiKey = process.env.METALS_API_KEY;
  if (metalsApiKey) {
    try {
      const response = await fetch(
        `https://metals-api.com/api/latest?access_key=${metalsApiKey}&base=GBP&symbols=XAU,XAG,XPT`,
        { next: { revalidate: 3600 } }
      );
      if (response.ok) {
        const data = await response.json() as { rates?: Record<string, number>; success?: boolean };
        if (data.success && data.rates) {
          const rates: Record<string, number> = {
            "24k_gold": (1 / data.rates["XAU"]) / 31.1035,
            "sterling_silver": (1 / data.rates["XAG"]) / 31.1035,
            "platinum": (1 / data.rates["XPT"]) / 31.1035,
          };
          cache = { rates, fetchedAt: now };
          console.log(JSON.stringify({ level: "info", event: "metal_spot_fetched", rates }));
          return rates;
        }
      }
    } catch (err) {
      console.log(JSON.stringify({ level: "warn", event: "metal_spot_fetch_failed", error: String(err) }));
    }
  }

  const fallback = pricingConfig.metalSpotFallbackGBPPerGram as Record<string, number>;
  if (!cache) {
    cache = { rates: fallback, fetchedAt: now - CACHE_TTL_MS + 300_000 };
  }
  return cache?.rates ?? fallback;
}

export function getMetalBaseId(metalType: string): string {
  if (metalType.includes("silver")) return "sterling_silver";
  if (metalType.includes("platinum")) return "platinum";
  return "24k_gold";
}
