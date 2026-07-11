import Redis from "ioredis";
import { env } from "./env";

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

redis.on("error", (err) => {
  // Redis is an optimization (rate limits / caching); the API must not crash without it.
  console.error("[redis]", err.message);
});

export async function connectRedis() {
  try {
    await redis.connect();
    console.log("[redis] connected");
  } catch {
    console.warn("[redis] unavailable — continuing without cache");
  }
}

const CACHE_PREFIX = "vms:cache:";

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60) {
  try {
    await redis.set(CACHE_PREFIX + key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* cache write failures are non-fatal */
  }
}

export async function cacheDel(pattern: string) {
  try {
    const keys = await redis.keys(CACHE_PREFIX + pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* non-fatal */
  }
}
