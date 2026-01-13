/**
 * OneID OAuth 2.0 Integration
 * https://id.egov.uz - Unified State Authentication System
 */

export const ONEID_CONFIG = {
    authUrl: 'https://sso.egov.uz/sso/oauth/Authorization.do',
    tokenUrl: 'https://sso.egov.uz/sso/oauth/Access.do',
    userInfoUrl: 'https://sso.egov.uz/sso/oauth/UserInfo.do',
    clientId: process.env.ONEID_CLIENT_ID || '',
    clientSecret: process.env.ONEID_CLIENT_SECRET || '',
    redirectUri: (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/auth/oneid/callback',
    scope: 'openid profile'
};

/**
 * Check if OneID is configured
 */
export function isOneIdConfigured(): boolean {
    return !!ONEID_CONFIG.clientId && !!ONEID_CONFIG.clientSecret;
}

/**
 * Generate OAuth authorization URL
 */
export function getOneIdAuthUrl(state: string): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: ONEID_CONFIG.clientId,
        redirect_uri: ONEID_CONFIG.redirectUri,
        scope: ONEID_CONFIG.scope,
        state: state
    });
    return `${ONEID_CONFIG.authUrl}?${params}`;
}

/**
 * Exchange authorization code for access token
 */
export async function getOneIdAccessToken(code: string): Promise<string | null> {
    try {
        const response = await fetch(ONEID_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: ONEID_CONFIG.clientId,
                client_secret: ONEID_CONFIG.clientSecret,
                redirect_uri: ONEID_CONFIG.redirectUri,
            }),
        });

        if (!response.ok) {
            console.error('OneID token error:', await response.text());
            return null;
        }

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('OneID token exception:', error);
        return null;
    }
}

/**
 * Get user data from OneID
 */
export interface OneIdUserData {
    inn: string;
    company_name: string;
    director_name: string;
    legal_address: string;
    pin?: string; // Personal ID
    full_name?: string;
}

export async function getOneIdUserData(accessToken: string): Promise<OneIdUserData | null> {
    try {
        const response = await fetch(ONEID_CONFIG.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.error('OneID user info error:', await response.text());
            return null;
        }

        const data = await response.json();

        // Map OneID response to our format
        return {
            inn: data.tin || data.inn || '',
            company_name: data.org_name || data.company_name || '',
            director_name: data.sur_name + ' ' + data.first_name + ' ' + (data.mid_name || ''),
            legal_address: data.legal_address || data.address || '',
            pin: data.pin,
            full_name: data.full_name || `${data.sur_name} ${data.first_name}`,
        };
    } catch (error) {
        console.error('OneID user info exception:', error);
        return null;
    }
}
