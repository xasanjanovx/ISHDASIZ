import type { AuthAdapter, AuthResult, AuthUser, AuthCompanyInfo } from './AuthAdapter';
import { featureFlags } from '@/lib/feature-flags';

/**
 * OneID authentication adapter (PLACEHOLDER)
 * 
 * This is a stub implementation that will be replaced
 * when OneID integration becomes available.
 * 
 * All methods return disabled/not-implemented responses.
 */
export class OneIDAuthAdapter implements AuthAdapter {
    private static readonly NOT_IMPLEMENTED = 'OneID integration is not yet available';

    isEnabled(): boolean {
        return featureFlags.ENABLE_ONEID;
    }

    getProviderName(): 'oneid' {
        return 'oneid';
    }

    async signIn(_credentials: { email?: string; password?: string }): Promise<AuthResult> {
        // OneID uses redirect-based OAuth, not password auth
        return {
            success: false,
            user: null,
            session: null,
            error: OneIDAuthAdapter.NOT_IMPLEMENTED,
        };
    }

    async signOut(): Promise<void> {
        console.warn(OneIDAuthAdapter.NOT_IMPLEMENTED);
    }

    async getCurrentUser(): Promise<AuthUser | null> {
        console.warn(OneIDAuthAdapter.NOT_IMPLEMENTED);
        return null;
    }

    async verifyToken(_token: string): Promise<AuthUser | null> {
        console.warn(OneIDAuthAdapter.NOT_IMPLEMENTED);
        return null;
    }

    async getCompanyInfo(_userId: string): Promise<AuthCompanyInfo | null> {
        // OneID provides company info for verified employers
        // This will be implemented when OneID is available
        console.warn(OneIDAuthAdapter.NOT_IMPLEMENTED);
        return null;
    }

    /**
     * Get OneID authorization URL (for future use)
     */
    getAuthorizationUrl(): string {
        // Will be: https://id.egov.uz/oauth/authorize?client_id=...
        throw new Error(OneIDAuthAdapter.NOT_IMPLEMENTED);
    }

    /**
     * Handle OAuth callback (for future use)
     */
    async handleCallback(_code: string): Promise<AuthResult> {
        throw new Error(OneIDAuthAdapter.NOT_IMPLEMENTED);
    }
}
