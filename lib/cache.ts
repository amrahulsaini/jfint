import { createHash } from 'crypto';
import { createClient } from 'redis';

type MemoryEntry = {
  raw: string;
  expiresAt: number;
};

const REDIS_URL = String(process.env.REDIS_URL || '').trim();
type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient | null> | null = null;
const memoryCache = new Map<string, MemoryEntry>();

function cleanupMemoryCache() {
  if (memoryCache.size === 0) return;
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

async function getRedisClient(): Promise<RedisClient | null> {
  if (!REDIS_URL) return null;

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({ url: REDIS_URL });
        client.on('error', () => {
          // Keep serving via in-process cache on redis connection issues.
        });
        await client.connect();
        return client;
      } catch {
        return null;
      }
    })();
  }

  return redisClientPromise;
}

async function setRaw(key: string, raw: string, ttlSeconds: number): Promise<void> {
  const safeTtl = Math.max(1, Math.floor(ttlSeconds));
  const redis = await getRedisClient();

  if (redis?.isOpen) {
    try {
      await redis.set(key, raw, { EX: safeTtl });
      return;
    } catch {
      // Fall back to in-process cache.
    }
  }

  cleanupMemoryCache();
  memoryCache.set(key, {
    raw,
    expiresAt: Date.now() + safeTtl * 1000,
  });
}

async function getRaw(key: string): Promise<string | null> {
  const redis = await getRedisClient();
  if (redis?.isOpen) {
    try {
      return await redis.get(key);
    } catch {
      // Fall back to in-process cache.
    }
  }

  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.raw;
}

export async function cacheSetJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await setRaw(key, JSON.stringify(value), ttlSeconds);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await getRaw(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetString(key: string, value: string, ttlSeconds: number): Promise<void> {
  await setRaw(key, value, ttlSeconds);
}

export async function cacheGetString(key: string): Promise<string | null> {
  return getRaw(key);
}

export async function cacheIncrement(key: string): Promise<number> {
  const redis = await getRedisClient();
  if (redis?.isOpen) {
    try {
      const next = await redis.incr(key);
      await redis.expire(key, 60 * 60 * 24 * 30);
      return Number(next);
    } catch {
      // Fall back to in-process cache.
    }
  }

  cleanupMemoryCache();
  const current = Number(memoryCache.get(key)?.raw || '0');
  const next = Number.isFinite(current) ? current + 1 : 1;
  memoryCache.set(key, {
    raw: String(next),
    expiresAt: Date.now() + 60 * 60 * 24 * 30 * 1000,
  });
  return next;
}

export async function cacheDelete(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];

  const redis = await getRedisClient();
  if (redis?.isOpen) {
    try {
      if (list.length > 0) {
        await redis.del(list);
      }
    } catch {
      // Continue with in-process cleanup.
    }
  }

  for (const key of list) {
    memoryCache.delete(key);
  }
}

export function stableCacheHash(input: unknown): string {
  const json = JSON.stringify(input);
  return createHash('sha1').update(json).digest('hex');
}
