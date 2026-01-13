/**
 * ERI (Electronic Digital Signature) Integration
 * Elektron Raqamli Imzo verification
 */

export const ERI_CONFIG = {
    authUrl: 'https://dsvs.uz/api/auth',
    verifyUrl: 'https://dsvs.uz/api/verify',
    clientId: process.env.ERI_CLIENT_ID || '',
    clientSecret: process.env.ERI_CLIENT_SECRET || '',
    redirectUri: (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000') + '/api/auth/eri/callback',
};

/**
 * Check if ERI is configured
 */
export function isEriConfigured(): boolean {
    return !!ERI_CONFIG.clientId && !!ERI_CONFIG.clientSecret;
}

/**
 * Generate ERI authorization URL
 */
export function getEriAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: ERI_CONFIG.clientId,
        redirect_uri: ERI_CONFIG.redirectUri,
        state: state
    });
    return `${ERI_CONFIG.authUrl}?${params}`;
}

/**
 * Verify ERI signature and get user data
 */
export interface EriUserData {
    inn: string;
    company_name: string;
    director_name: string;
    certificate_serial: string;
    valid_until: string;
}

export async function verifyEriSignature(signedData: string): Promise<EriUserData | null> {
    try {
        const response = await fetch(ERI_CONFIG.verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Id': ERI_CONFIG.clientId,
                'X-Client-Secret': ERI_CONFIG.clientSecret,
            },
            body: JSON.stringify({ signed_data: signedData }),
        });

        if (!response.ok) {
            console.error('ERI verify error:', await response.text());
            return null;
        }

        const data = await response.json();

        return {
            inn: data.inn || data.tin || '',
            company_name: data.organization || '',
            director_name: data.common_name || '',
            certificate_serial: data.serial_number || '',
            valid_until: data.valid_to || '',
        };
    } catch (error) {
        console.error('ERI verify exception:', error);
        return null;
    }
}
