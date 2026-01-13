import { supabase } from '@/lib/supabase';
import type { AuthAdapter, AuthResult, AuthUser, AuthCompanyInfo } from './AuthAdapter';

/**
 * Supabase-based authentication adapter
 * This is the default/active implementation
 */
export class SupabaseAuthAdapter implements AuthAdapter {
    isEnabled(): boolean {
        return true;
    }

    getProviderName(): 'supabase' {
        return 'supabase';
    }

    async signIn(credentials: { email?: string; password?: string }): Promise<AuthResult> {
        if (!credentials.email || !credentials.password) {
            return {
                success: false,
                user: null,
                session: null,
                error: 'Email and password are required',
            };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            return {
                success: false,
                user: null,
                session: null,
                error: error.message,
            };
        }

        const user = data.user ? await this.mapToAuthUser(data.user.id) : null;

        return {
            success: true,
            user,
            session: data.session,
        };
    }

    async signOut(): Promise<void> {
        await supabase.auth.signOut();
    }

    async getCurrentUser(): Promise<AuthUser | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        return this.mapToAuthUser(user.id);
    }

    async verifyToken(token: string): Promise<AuthUser | null> {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return null;
        return this.mapToAuthUser(user.id);
    }

    async getCompanyInfo(_userId: string): Promise<AuthCompanyInfo | null> {
        // Supabase Auth doesn't provide company info
        // This will be populated from HR adapter or manual entry
        return null;
    }

    private async mapToAuthUser(userId: string): Promise<AuthUser | null> {
        const { data: profile } = await supabase
            .from('admin_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        const { data: { user } } = await supabase.auth.getUser();

        return {
            id: userId,
            email: user?.email,
            phone: user?.phone,
            fullName: profile?.full_name,
            role: profile?.role === 'super_admin' ? 'admin' : 'employer',
            verified: true,
            provider: 'supabase',
            rawData: profile,
        };
    }
}
