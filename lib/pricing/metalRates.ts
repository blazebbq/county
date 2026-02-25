import { prisma } from "@/lib/db";

// Fallback constants (GBP per gram)
const FALLBACK_GOLD_GBP_PER_GRAM_24K = 58.5;
const FALLBACK_SILVER_GBP_PER_GRAM = 0.65;
const FALLBACK_PLATINUM_GBP_PER_GRAM = 28.0;

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

// In-memory cache layer on top of DB to avoid hitting DB on every pricing call
interface MemCache {
  goldGBPPerGram24k: number;
  silverGBPPerGram: number;
  platinumGBPPerGram: number;
  updatedAt: Date;
  source: string;
  fetchedAt: number; // epoch ms
}

let memCache: MemCache | null = null;

export interface MetalRates {
  goldGBPPerGram24k: number;
  silverGBPPerGram: number;
  platinumGBPPerGram: number;
  updatedAt: Date;
  source: string;
}

async function fetchFromApi(): Promise<{
  goldGBPPerGram24k: number;
  silverGBPPerGram: number;
  platinumGBPPerGram: number;
  source: string;
} | null> {
  const apiKey = process.env.METALS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://metals-api.com/api/latest?access_key=${apiKey}&base=GBP&symbols=XAU,XAG,XPT`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;

    const data = await response.json() as { rates?: Record<string, number>; success?: boolean };
    if (!data.success || !data.rates) return null;

    // metals-api returns GBP per troy-oz inverse; XAU = GBP/troy-oz⁻¹ so price = 1/rate / 31.1035 g
    const goldGBPPerGram24k = (1 / data.rates["XAU"]) / 31.1035;
    const silverGBPPerGram = (1 / data.rates["XAG"]) / 31.1035;
    const platinumGBPPerGram = (1 / data.rates["XPT"]) / 31.1035;

    return { goldGBPPerGram24k, silverGBPPerGram, platinumGBPPerGram, source: "metals-api.com" };
  } catch (err) {
    console.log(JSON.stringify({ level: "warn", event: "metal_rates_fetch_failed", error: String(err) }));
    return null;
  }
}

/**
 * Refresh metal rates from the live API and persist to DB.
 * Called proactively (e.g., by a background trigger or admin action).
 */
export async function refreshMetalRates(): Promise<void> {
  const live = await fetchFromApi();
  if (!live) {
    console.log(JSON.stringify({ level: "warn", event: "metal_rates_refresh_skipped", reason: "no_api_key_or_fetch_failed" }));
    return;
  }

  await prisma.metalRateCache.upsert({
    where: { id: "default" },
    create: { id: "default", ...live },
    update: live,
  });

  memCache = { ...live, updatedAt: new Date(), fetchedAt: Date.now() };
  console.log(JSON.stringify({ level: "info", event: "metal_rates_refreshed", goldGBPPerGram24k: live.goldGBPPerGram24k }));
}

/**
 * Get metal rates with caching: memory → DB → live API → hardcoded fallback.
 * Automatically refreshes if cache is stale (> 1 hour).
 */
export async function getMetalRates(): Promise<MetalRates> {
  const now = Date.now();

  // 1. Memory cache hit
  if (memCache && now - memCache.fetchedAt < CACHE_TTL_MS) {
    return {
      goldGBPPerGram24k: memCache.goldGBPPerGram24k,
      silverGBPPerGram: memCache.silverGBPPerGram,
      platinumGBPPerGram: memCache.platinumGBPPerGram,
      updatedAt: memCache.updatedAt,
      source: memCache.source,
    };
  }

  // 2. DB cache
  try {
    const dbRow = await prisma.metalRateCache.findUnique({ where: { id: "default" } });
    if (dbRow) {
      const dbAgeMs = now - dbRow.updatedAt.getTime();
      if (dbAgeMs < CACHE_TTL_MS) {
        // Still fresh — use DB values and prime memory cache
        memCache = {
          goldGBPPerGram24k: dbRow.goldGBPPerGram24k,
          silverGBPPerGram: dbRow.silverGBPPerGram,
          platinumGBPPerGram: dbRow.platinumGBPPerGram,
          updatedAt: dbRow.updatedAt,
          source: dbRow.source,
          fetchedAt: now,
        };
        return {
          goldGBPPerGram24k: dbRow.goldGBPPerGram24k,
          silverGBPPerGram: dbRow.silverGBPPerGram,
          platinumGBPPerGram: dbRow.platinumGBPPerGram,
          updatedAt: dbRow.updatedAt,
          source: dbRow.source,
        };
      }
    }
  } catch (err) {
    console.log(JSON.stringify({ level: "warn", event: "metal_rates_db_read_failed", error: String(err) }));
  }

  // 3. Stale or missing — try live API
  const live = await fetchFromApi();
  if (live) {
    try {
      await prisma.metalRateCache.upsert({
        where: { id: "default" },
        create: { id: "default", ...live },
        update: live,
      });
    } catch { /* ignore DB write failures */ }

    const updatedAt = new Date();
    memCache = { ...live, updatedAt, fetchedAt: now };
    return { ...live, updatedAt };
  }

  // 4. Last-known stale DB row (fallback even if old)
  try {
    const dbRow = await prisma.metalRateCache.findUnique({ where: { id: "default" } });
    if (dbRow) {
      console.log(JSON.stringify({ level: "warn", event: "metal_rates_using_stale_db" }));
      return {
        goldGBPPerGram24k: dbRow.goldGBPPerGram24k,
        silverGBPPerGram: dbRow.silverGBPPerGram,
        platinumGBPPerGram: dbRow.platinumGBPPerGram,
        updatedAt: dbRow.updatedAt,
        source: `${dbRow.source} (stale)`,
      };
    }
  } catch { /* ignore */ }

  // 5. Hardcoded fallback
  console.log(JSON.stringify({ level: "warn", event: "metal_rates_using_hardcoded_fallback" }));
  return {
    goldGBPPerGram24k: FALLBACK_GOLD_GBP_PER_GRAM_24K,
    silverGBPPerGram: FALLBACK_SILVER_GBP_PER_GRAM,
    platinumGBPPerGram: FALLBACK_PLATINUM_GBP_PER_GRAM,
    updatedAt: new Date(0),
    source: "hardcoded-fallback",
  };
}
