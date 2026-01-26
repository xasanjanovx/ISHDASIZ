/**
 * Rate Limiter for AI API
 * Prevents abuse by limiting requests per user
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store (works on serverless, resets on cold start)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const WINDOW_MS = 60 * 1000;    // 1 minute window
const MAX_REQUESTS = 10;        // 10 requests per minute
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean old entries every 5 minutes

// Periodic cleanup to prevent memory leaks
let lastCleanup = Date.now();
function cleanupOldEntries() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;

    lastCleanup = now;
    const entries = Array.from(rateLimitStore.entries());
    for (const [key, entry] of entries) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * Check if user is rate limited
 * @param userId - User identifier (user ID or IP)
 * @returns Rate limit result
 */
export function checkRateLimit(userId: string): RateLimitResult {
    cleanupOldEntries();

    const now = Date.now();
    const key = `rate:${userId}`;
    const entry = rateLimitStore.get(key);

    // No existing entry or window expired
    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(key, {
            count: 1,
            resetAt: now + WINDOW_MS,
        });
        return {
            allowed: true,
            remaining: MAX_REQUESTS - 1,
            resetAt: now + WINDOW_MS,
        };
    }

    // Within window, check count
    if (entry.count >= MAX_REQUESTS) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
        };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
        allowed: true,
        remaining: MAX_REQUESTS - entry.count,
        resetAt: entry.resetAt,
    };
}

/**
 * Get user identifier from request
 * Prioritizes userId, falls back to IP
 */
export function getUserIdentifier(userId?: string, ip?: string): string {
    if (userId) return `user:${userId}`;
    if (ip) return `ip:${ip}`;
    return `anonymous:${Date.now()}`;
}
