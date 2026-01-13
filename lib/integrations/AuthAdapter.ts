import { User, Session } from '@supabase/supabase-js';

/**
 * Authentication result from any auth provider
 */
export interface AuthResult {
    success: boolean;
    user: AuthUser | null;
    session: Session | null;
    error?: string;
}

/**
 * Unified user profile across auth providers
 */
export interface AuthUser {
    id: string;
    email?: string;
    phone?: string;
    fullName?: string;
    role: 'seeker' | 'employer' | 'admin';
    companyId?: string;
    verified: boolean;
    provider: 'supabase' | 'oneid';
    rawData?: Record<string, unknown>;
}

/**
 * Company information from auth provider (OneID provides this)
 */
export interface AuthCompanyInfo {
    inn?: string;
    name?: string;
    legalForm?: string;
    address?: string;
}

/**
 * Authentication adapter interface
 * Implementations: SupabaseAuthAdapter, OneIDAuthAdapter
 */
export interface AuthAdapter {
    /**
     * Sign in with email/password (Supabase) or redirect to OneID
     */
    signIn(credentials: { email?: string; password?: string }): Promise<AuthResult>;

    /**
     * Sign out current user
     */
    signOut(): Promise<void>;

    /**
     * Get current authenticated user
     */
    getCurrentUser(): Promise<AuthUser | null>;

    /**
     * Verify a token (for API routes)
     */
    verifyToken(token: string): Promise<AuthUser | null>;

    /**
     * Get company info for authenticated employer (OneID provides this)
     */
    getCompanyInfo(userId: string): Promise<AuthCompanyInfo | null>;

    /**
     * Check if this adapter is enabled
     */
    isEnabled(): boolean;

    /**
     * Get provider name
     */
    getProviderName(): 'supabase' | 'oneid';
}
