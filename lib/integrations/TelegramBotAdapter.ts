import type { TelegramAdapter, TelegramJobPost, TelegramResult, TelegramSubscription } from './TelegramAdapter';
import { featureFlags } from '@/lib/feature-flags';
import { formatSpecialCategoriesForTelegram } from '@/lib/special-categories';

/**
 * Telegram Bot adapter (PLACEHOLDER)
 * 
 * This implementation provides the interface for Telegram integration.
 * The actual bot logic will be implemented in the next phase.
 */
export class TelegramBotAdapter implements TelegramAdapter {
    private botToken: string | undefined;
    private channelId: string | undefined;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.channelId = process.env.TELEGRAM_CHANNEL_ID;
    }

    isEnabled(): boolean {
        return featureFlags.ENABLE_TELEGRAM && !!this.botToken && !!this.channelId;
    }

    async postJobToChannel(job: TelegramJobPost): Promise<TelegramResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: 'Telegram integration is disabled or not configured',
            };
        }

        // TODO: Implement in next phase
        // Will use: POST https://api.telegram.org/bot{token}/sendMessage
        console.log('[TelegramAdapter] Would post job to channel:', job.id);

        return {
            success: false,
            error: 'Telegram posting not yet implemented',
        };
    }

    async sendJobNotification(chatId: number, job: TelegramJobPost): Promise<TelegramResult> {
        if (!this.isEnabled()) {
            return {
                success: false,
                error: 'Telegram integration is disabled',
            };
        }

        // TODO: Implement in next phase
        console.log('[TelegramAdapter] Would send notification to:', chatId, 'job:', job.id);

        return {
            success: false,
            error: 'Telegram notifications not yet implemented',
        };
    }

    async getSubscriptions(): Promise<TelegramSubscription[]> {
        // TODO: Fetch from seeker_preferences or telegram_subscriptions table
        return [];
    }

    async upsertSubscription(_subscription: TelegramSubscription): Promise<void> {
        // TODO: Save to database
        console.log('[TelegramAdapter] Would save subscription');
    }

    async removeSubscription(_chatId: number): Promise<void> {
        // TODO: Remove from database
        console.log('[TelegramAdapter] Would remove subscription');
    }

    formatJobMessage(job: TelegramJobPost, lang: 'uz' | 'ru'): string {
        const title = lang === 'uz' ? job.titleUz : job.titleRu;
        const description = lang === 'uz' ? job.descriptionUz : job.descriptionRu;

        // Truncate description to keep post readable
        const maxDescLength = 500;
        let truncatedDesc = description;
        if (description.length > maxDescLength) {
            const lastPeriod = description.lastIndexOf('.', maxDescLength);
            truncatedDesc = lastPeriod > 100
                ? description.substring(0, lastPeriod + 1) + '...'
                : description.substring(0, maxDescLength) + '...';
        }

        const salaryText = job.salaryMin === 0 && job.salaryMax === 0
            ? (lang === 'uz' ? 'Kelishiladi' : 'Договорная')
            : `${(job.salaryMin / 1000000).toFixed(1)} – ${(job.salaryMax / 1000000).toFixed(1)} mln`;

        const contactText = job.phone ? `📞 ${job.phone}` : '';

        // Special categories block
        const specialCategoriesText = formatSpecialCategoriesForTelegram(job, lang);

        return `📋 ${title}

🏢 ${job.companyName}
📍 ${job.districtName}
💰 ${salaryText}
${contactText}

${truncatedDesc}${specialCategoriesText}`.trim();
    }
}
