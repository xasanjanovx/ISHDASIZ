/**
 * Job data for Telegram posting
 */
export interface TelegramJobPost {
    id: string;
    titleUz: string;
    titleRu: string;
    descriptionUz: string;
    descriptionRu: string;
    companyName: string;
    districtName: string;
    salaryMin: number;
    salaryMax: number;
    employmentType: string;
    phone?: string;
    telegramContact?: string;
    url: string;
    is_for_students?: boolean;
    is_for_disabled?: boolean;
    is_for_women?: boolean;
}

/**
 * Result of Telegram operation
 */
export interface TelegramResult {
    success: boolean;
    messageId?: number;
    error?: string;
}

/**
 * Telegram subscription for job alerts
 */
export interface TelegramSubscription {
    chatId: number;
    districtId?: string;
    categoryIds?: string[];
    isActive: boolean;
}

/**
 * Telegram adapter interface
 * Handles bot operations and channel posting
 */
export interface TelegramAdapter {
    /**
     * Check if Telegram integration is enabled
     */
    isEnabled(): boolean;

    /**
     * Post a new job to the Telegram channel
     */
    postJobToChannel(job: TelegramJobPost): Promise<TelegramResult>;

    /**
     * Send job notification to a specific chat
     */
    sendJobNotification(chatId: number, job: TelegramJobPost): Promise<TelegramResult>;

    /**
     * Get all active subscriptions
     */
    getSubscriptions(): Promise<TelegramSubscription[]>;

    /**
     * Add/update subscription
     */
    upsertSubscription(subscription: TelegramSubscription): Promise<void>;

    /**
     * Remove subscription
     */
    removeSubscription(chatId: number): Promise<void>;

    /**
     * Format job post for Telegram message
     */
    formatJobMessage(job: TelegramJobPost, lang: 'uz' | 'ru'): string;
}
