/**
 * Company data from HR system
 */
export interface HRCompany {
    id: string;
    inn: string;
    name: string;
    legalForm?: string;
    districtId?: string;
    employeeCount?: number;
    isActive: boolean;
    syncedAt: Date;
}

/**
 * Sync result from HR system
 */
export interface HRSyncResult {
    success: boolean;
    companiesUpdated: number;
    companiesCreated: number;
    errors: string[];
}

/**
 * HR System adapter interface
 * Implementations: GovHRAdapter (future), MockHRAdapter (placeholder)
 */
export interface HRAdapter {
    /**
     * Check if HR sync is enabled
     */
    isEnabled(): boolean;

    /**
     * Fetch company by INN from HR system
     */
    getCompanyByINN(inn: string): Promise<HRCompany | null>;

    /**
     * Sync all companies from HR system
     * Should be called periodically (e.g., daily cron)
     */
    syncAllCompanies(): Promise<HRSyncResult>;

    /**
     * Verify if a company is registered and active
     */
    verifyCompany(inn: string): Promise<boolean>;

    /**
     * Get provider name
     */
    getProviderName(): string;
}
