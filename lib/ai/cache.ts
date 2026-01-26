/**
 * Simple In-Memory Cache for AI Responses
 * Reduces API costs by caching frequent queries
 */

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

// In-memory cache store
const cache = new Map<string, CacheEntry<unknown>>();

// Configuration
const DEFAULT_TTL_MS = 5 * 60 * 1000;      // 5 minutes for Smart mode
const ECO_TTL_MS = 15 * 60 * 1000;         // 15 minutes for Eco mode
const MAX_CACHE_SIZE = 1000;               // Maximum entries
const CLEANUP_THRESHOLD = 800;             // Start cleanup at 80%

/**
 * Generate cache key from query
 * Normalizes query for better hit rate
 */
export function generateCacheKey(query: string, lang: string): string {
    const normalized = query
        .toLowerCase()
        .replace(/[^\w\sа-яўғқҳёa-z]/gi, '') // Keep only letters and spaces
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100); // Limit key length

    return `ai:${lang}:${normalized}`;
}

/**
 * Get cached response
 */
export function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

/**
 * Set cache entry
 */
export function setCache<T>(key: string, data: T, isEcoMode: boolean = true): void {
    // Cleanup if cache is getting full
    if (cache.size >= CLEANUP_THRESHOLD) {
        cleanupExpired();
    }

    // If still too full, remove oldest entries
    if (cache.size >= MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(cache.keys()).slice(0, 100);
        keysToDelete.forEach(k => cache.delete(k));
    }

    const ttl = isEcoMode ? ECO_TTL_MS : DEFAULT_TTL_MS;

    cache.set(key, {
        data,
        expiresAt: Date.now() + ttl,
    });
}

/**
 * Remove expired entries
 */
function cleanupExpired(): void {
    const now = Date.now();
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
        if (entry.expiresAt < now) {
            cache.delete(key);
        }
    }
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats(): { size: number; maxSize: number } {
    return {
        size: cache.size,
        maxSize: MAX_CACHE_SIZE,
    };
}

/**
 * Clear all cache (for testing/debugging)
 */
export function clearCache(): void {
    cache.clear();
}
