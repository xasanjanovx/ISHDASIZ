/**
 * Feature Flags for ISHDASIZ
 * 
 * Controls which integrations are enabled.
 * These can be overridden via environment variables.
 */

export const featureFlags = {
    /**
     * Enable OneID authentication integration
     * When false, uses Supabase Auth
     */
    ENABLE_ONEID: process.env.NEXT_PUBLIC_ENABLE_ONEID === 'true' || false,

    /**
     * Enable HR system synchronization
     * When false, company data is managed manually
     */
    ENABLE_HR_SYNC: process.env.NEXT_PUBLIC_ENABLE_HR_SYNC === 'true' || false,

    /**
     * Enable Telegram integration (bot + auto-posting)
     * When true, published jobs are sent to Telegram channel
     */
    ENABLE_TELEGRAM: process.env.NEXT_PUBLIC_ENABLE_TELEGRAM === 'true' || true,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
    return featureFlags[flag];
}
