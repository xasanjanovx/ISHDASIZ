import type { HRAdapter, HRCompany, HRSyncResult } from './HRAdapter';
import { featureFlags } from '@/lib/feature-flags';

/**
 * Government HR System adapter (PLACEHOLDER)
 * 
 * This is a stub implementation that will be replaced
 * when HR system integration becomes available.
 * 
 * All methods return disabled/not-implemented responses.
 */
export class GovHRAdapter implements HRAdapter {
    private static readonly NOT_IMPLEMENTED = 'HR system integration is not yet available';

    isEnabled(): boolean {
        return featureFlags.ENABLE_HR_SYNC;
    }

    getProviderName(): string {
        return 'gov_hr_system';
    }

    async getCompanyByINN(_inn: string): Promise<HRCompany | null> {
        if (!this.isEnabled()) {
            console.warn(GovHRAdapter.NOT_IMPLEMENTED);
            return null;
        }

        // Future: fetch from government HR API
        console.warn(GovHRAdapter.NOT_IMPLEMENTED);
        return null;
    }

    async syncAllCompanies(): Promise<HRSyncResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                companiesUpdated: 0,
                companiesCreated: 0,
                errors: [GovHRAdapter.NOT_IMPLEMENTED],
            };
        }

        // Future: sync all companies from HR system
        console.warn(GovHRAdapter.NOT_IMPLEMENTED);
        return {
            success: false,
            companiesUpdated: 0,
            companiesCreated: 0,
            errors: [GovHRAdapter.NOT_IMPLEMENTED],
        };
    }

    async verifyCompany(_inn: string): Promise<boolean> {
        if (!this.isEnabled()) {
            console.warn(GovHRAdapter.NOT_IMPLEMENTED);
            return false;
        }

        // Future: verify company exists in government registry
        console.warn(GovHRAdapter.NOT_IMPLEMENTED);
        return false;
    }
}
