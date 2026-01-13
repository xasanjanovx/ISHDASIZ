/**
 * Integration Layer - Factory Functions
 * 
 * This module provides factory functions to get the appropriate
 * adapter implementation based on feature flags.
 */

import { featureFlags } from '@/lib/feature-flags';

// Types
export type { AuthAdapter, AuthResult, AuthUser, AuthCompanyInfo } from './AuthAdapter';
export type { HRAdapter, HRCompany, HRSyncResult } from './HRAdapter';
export type { TelegramAdapter, TelegramJobPost, TelegramResult, TelegramSubscription } from './TelegramAdapter';

// Implementations
import { SupabaseAuthAdapter } from './SupabaseAuthAdapter';
import { OneIDAuthAdapter } from './OneIDAuthAdapter';
import { GovHRAdapter } from './GovHRAdapter';
import { TelegramBotAdapter } from './TelegramBotAdapter';

// Singleton instances
let authAdapterInstance: SupabaseAuthAdapter | OneIDAuthAdapter | null = null;
let hrAdapterInstance: GovHRAdapter | null = null;
let telegramAdapterInstance: TelegramBotAdapter | null = null;

/**
 * Get the active authentication adapter
 * Returns OneIDAuthAdapter if ENABLE_ONEID is true, otherwise SupabaseAuthAdapter
 */
export function getAuthAdapter(): SupabaseAuthAdapter | OneIDAuthAdapter {
    if (!authAdapterInstance) {
        authAdapterInstance = featureFlags.ENABLE_ONEID
            ? new OneIDAuthAdapter()
            : new SupabaseAuthAdapter();
    }
    return authAdapterInstance;
}

/**
 * Get the HR system adapter
 * Returns GovHRAdapter (currently a placeholder)
 */
export function getHRAdapter(): GovHRAdapter {
    if (!hrAdapterInstance) {
        hrAdapterInstance = new GovHRAdapter();
    }
    return hrAdapterInstance;
}

/**
 * Get the Telegram bot adapter
 */
export function getTelegramAdapter(): TelegramBotAdapter {
    if (!telegramAdapterInstance) {
        telegramAdapterInstance = new TelegramBotAdapter();
    }
    return telegramAdapterInstance;
}

/**
 * Reset all adapter instances (useful for testing)
 */
export function resetAdapters(): void {
    authAdapterInstance = null;
    hrAdapterInstance = null;
    telegramAdapterInstance = null;
}

/**
 * Get status of all integrations
 */
export function getIntegrationStatus() {
    return {
        auth: {
            provider: featureFlags.ENABLE_ONEID ? 'oneid' : 'supabase',
            enabled: true,
        },
        hr: {
            provider: 'gov_hr_system',
            enabled: featureFlags.ENABLE_HR_SYNC,
        },
        telegram: {
            provider: 'telegram_bot',
            enabled: featureFlags.ENABLE_TELEGRAM,
        },
    };
}
