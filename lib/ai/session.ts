/**
 * Session State Management for AI Chat
 * 
 * Stores user profile and conversation state between messages
 * Uses in-memory Map with TTL (30 minutes)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
    category_id?: string;
    category_name?: string;
    experience?: string;        // "0" | "1-2" | "3+"
    region_name?: string;
    region_id?: number;
    district_name?: string;
    salary_min?: number;
    work_mode?: 'remote' | 'onsite' | 'any';
    gender?: 'male' | 'female';
    is_student?: boolean;
    is_disabled?: boolean;
    age?: number;
    education?: string;
    skills?: string[];
    keywords?: string[];
}

export type ConversationStage =
    | 'greeting'
    | 'category'
    | 'experience'
    | 'region'
    | 'salary'
    | 'work_mode'
    | 'ready'
    | 'searching'
    | 'results'
    | 'feedback';

export interface UserSession {
    id: string;
    profile: UserProfile;
    stage: ConversationStage;
    missingFields: string[];
    history: { role: 'user' | 'assistant'; content: string }[];
    lastSearchResults?: any[];
    lastSearchFilters?: any;
    feedbackCount: number;
    createdAt: number;
    updatedAt: number;
}

// ============================================================================
// SESSION STORE
// ============================================================================

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const sessionStore = new Map<string, UserSession>();

// Cleanup expired sessions periodically
setInterval(() => {
    const now = Date.now();
    const entries = Array.from(sessionStore.entries());
    for (const [key, session] of entries) {
        if (now - session.updatedAt > SESSION_TTL_MS) {
            sessionStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// ============================================================================
// SESSION FUNCTIONS
// ============================================================================

export function getSession(userId: string): UserSession {
    let session = sessionStore.get(userId);

    if (!session) {
        session = createNewSession(userId);
        sessionStore.set(userId, session);
    }

    // Update timestamp
    session.updatedAt = Date.now();
    return session;
}

export function updateSession(userId: string, updates: Partial<UserSession>): UserSession {
    const session = getSession(userId);

    // Merge updates
    Object.assign(session, updates, { updatedAt: Date.now() });

    // Update missing fields
    session.missingFields = getMissingFields(session.profile);

    sessionStore.set(userId, session);
    return session;
}

export function updateProfile(userId: string, profileUpdates: Partial<UserProfile>): UserSession {
    const session = getSession(userId);
    session.profile = { ...session.profile, ...profileUpdates };
    session.missingFields = getMissingFields(session.profile);
    session.updatedAt = Date.now();
    sessionStore.set(userId, session);
    return session;
}

export function addToHistory(userId: string, role: 'user' | 'assistant', content: string): void {
    const session = getSession(userId);
    session.history.push({ role, content });

    // Keep only last 10 messages
    if (session.history.length > 10) {
        session.history = session.history.slice(-10);
    }

    session.updatedAt = Date.now();
    sessionStore.set(userId, session);
}

export function clearSession(userId: string): void {
    sessionStore.delete(userId);
}

export function resetToSearch(userId: string): UserSession {
    const session = getSession(userId);
    session.stage = 'searching';
    session.lastSearchResults = undefined;
    session.updatedAt = Date.now();
    sessionStore.set(userId, session);
    return session;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createNewSession(userId: string): UserSession {
    const now = Date.now();
    return {
        id: userId,
        profile: {},
        stage: 'greeting',
        missingFields: ['category', 'region', 'salary'],
        history: [],
        feedbackCount: 0,
        createdAt: now,
        updatedAt: now,
    };
}

function getMissingFields(profile: UserProfile): string[] {
    const required = ['category_id', 'region_name'];
    const missing: string[] = [];

    if (!profile.category_id && !profile.category_name && !profile.keywords?.length) {
        missing.push('category');
    }
    if (!profile.region_name) {
        missing.push('region');
    }

    return missing;
}

export function isProfileReady(profile: UserProfile): boolean {
    // Profile is ready if we have at least category OR keywords
    const hasCategory = Boolean(profile.category_id || profile.category_name);
    const hasKeywords = Boolean(profile.keywords && profile.keywords.length > 0);

    return hasCategory || hasKeywords;
}

export function getNextQuestion(session: UserSession): { stage: ConversationStage; question: string } | null {
    const { profile, stage } = session;

    // If we already have enough info, go to search
    if (isProfileReady(profile)) {
        return null;
    }

    // Determine next question based on what's missing
    if (!profile.category_id && !profile.category_name && !profile.keywords?.length) {
        return {
            stage: 'category',
            question: "Qaysi sohada ish qidiryapsiz? Masalan: IT, Savdo, Haydovchi, Qurilish, Tibbiyot..."
        };
    }

    if (!profile.region_name) {
        return {
            stage: 'region',
            question: "Qaysi shaharda ishlashni xohlaysiz?"
        };
    }

    if (!profile.experience) {
        return {
            stage: 'experience',
            question: "Qancha ish tajribangiz bor? (Tajribasiz / 1-2 yil / 3+ yil)"
        };
    }

    if (!profile.salary_min) {
        return {
            stage: 'salary',
            question: "Minimal qancha maosh kutasiz? (masalan: 3 mln)"
        };
    }

    if (!profile.work_mode) {
        return {
            stage: 'work_mode',
            question: "Ish joyida ishlaysizmi yoki masofaviy ham bo‘ladimi?"
        };
    }

    return null;
}

// ============================================================================
// PROFILE PARSING FROM TEXT
// ============================================================================

export function parseProfileFromText(text: string, currentProfile: UserProfile): Partial<UserProfile> {
    const lower = text.toLowerCase().replace(/[''`ʻ]/g, "'");
    const updates: Partial<UserProfile> = {};

    // ---- Category detection ----
    const categoryPatterns: Record<string, { name: string; id: string }> = {
        'it|dasturchi|developer|programmer|frontend|backend|web|mobile': {
            name: 'IT va Texnologiyalar',
            id: '6cdb160a-f3a9-4d7b-944a-d34df1ebd730'
        },
        'savdo|sotuvchi|seller|kassir|merchandiser|sales': {
            name: 'Savdo',
            id: '7617126a-86cc-4004-8c61-e8524c6d71a8'
        },
        'haydovchi|driver|transport|yuk|logist|kurier': {
            name: 'Transport',
            id: '47c173e0-f08a-4193-95e5-3415b3074db3'
        },
        'shifokor|doctor|hamshira|nurse|tibbiyot|medical': {
            name: "Sog'liqni saqlash",
            id: 'd2feedaf-2647-42f8-9635-addcfd7c1f95'
        },
        'oqituvchi|teacher|talim|education|ustoz': {
            name: "Ta'lim",
            id: 'bf249262-28c6-401f-981a-27e70d676572'
        },
        'qurilish|builder|ishchi|usta|elektrik|santexnik': {
            name: 'Qurilish',
            id: '9bccd2f5-0ff2-4ee0-ad36-835dfeded9ef'
        },
        'buxgalter|accountant|moliya|finance|bank': {
            name: 'Moliya',
            id: '475e42a1-ee6f-4a88-a1d0-8876a56351f3'
        },
        'oshpaz|cook|ofitsiant|waiter|xizmat|service|farrosh|qorovul': {
            name: 'Xizmatlar',
            id: '5484a5cc-f487-4fef-a211-f4f9520a5639'
        },
        'ishlab chiqarish|production|zavod|factory|operator': {
            name: 'Ishlab chiqarish',
            id: 'efd4213a-e9a0-4c0e-b908-b83c8cf27c99'
        },
    };

    for (const [pattern, category] of Object.entries(categoryPatterns)) {
        if (new RegExp(pattern, 'i').test(lower)) {
            updates.category_id = category.id;
            updates.category_name = category.name;
            break;
        }
    }

    // ---- Region detection ----
    const regionPatterns: [RegExp, string][] = [
        [/andijon/i, 'Andijon viloyati'],
        [/toshkent\s*shahri?(?!\s*viloyat)/i, 'Toshkent shahri'],
        [/toshkent(?!\s*shahri)/i, 'Toshkent shahri'],
        [/toshkent\s*viloyat/i, 'Toshkent viloyati'],
        [/samarqand/i, 'Samarqand viloyati'],
        [/buxoro/i, 'Buxoro viloyati'],
        [/farg['o]?na/i, "Farg'ona viloyati"],
        [/namangan/i, 'Namangan viloyati'],
        [/qashqadaryo/i, 'Qashqadaryo viloyati'],
        [/surxondaryo/i, 'Surxondaryo viloyati'],
        [/navoiy/i, 'Navoiy viloyati'],
        [/xorazm/i, 'Xorazm viloyati'],
        [/jizzax/i, 'Jizzax viloyati'],
        [/sirdaryo/i, 'Sirdaryo viloyati'],
        [/qoraqalpog/i, "Qoraqalpog'iston Respublikasi"],
    ];

    for (const [pattern, regionName] of regionPatterns) {
        if (pattern.test(lower)) {
            updates.region_name = regionName;
            break;
        }
    }

    // ---- Experience detection ----
    if (/tajribasiz|no\s*experience|0\s*yil/i.test(lower)) {
        updates.experience = '0';
    } else if (/1[-–]2\s*yil|1\s*yil|2\s*yil/i.test(lower)) {
        updates.experience = '1-2';
    } else if (/3\+?\s*yil|5\s*yil|10\s*yil|tajribali/i.test(lower)) {
        updates.experience = '3+';
    }

    // ---- Salary detection ----
    const salaryMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(mln|million|миллион)/i);
    if (salaryMatch) {
        updates.salary_min = parseFloat(salaryMatch[1].replace(',', '.')) * 1000000;
    }

    // ---- Work mode detection ----
    if (/masofaviy|remote|uzoqdan|uydan/i.test(lower)) {
        updates.work_mode = 'remote';
    } else if (/ofis|office|onsite/i.test(lower)) {
        updates.work_mode = 'onsite';
    } else if (/farqi\s*yoq|farq\s*qilmaydi|hammasi/i.test(lower)) {
        updates.work_mode = 'any';
    }

    // ---- Gender detection ----
    if (/erkak|erkaklar/i.test(lower)) {
        updates.gender = 'male';
    } else if (/ayol|ayollar/i.test(lower)) {
        updates.gender = 'female';
    }

    // ---- Student detection ----
    if (/talaba|student|bitiruvchi|graduate/i.test(lower)) {
        updates.is_student = true;
    }

    // ---- Disabled detection ----
    if (/nogiron|disabled/i.test(lower)) {
        updates.is_disabled = true;
    }

    // ---- Extract keywords ----
    if (!updates.category_id) {
        const words = text.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0 && words.length <= 5) {
            updates.keywords = words.slice(0, 3);
        }
    }

    return updates;
}

// ============================================================================
// FEEDBACK DETECTION
// ============================================================================

export function detectFeedback(text: string): { type: string; action: string } | null {
    const lower = text.toLowerCase();

    // Negative feedback about category
    if (/bu\s*(IT|ish|vakansiya)?\s*(emas|xato)/i.test(lower) ||
        /mos\s*(kelmaydi|emas)/i.test(lower)) {
        return { type: 'wrong_category', action: 'exclude_and_retry' };
    }

    // Salary too low
    if (/maosh\s*(kam|past|oz)/i.test(lower)) {
        return { type: 'salary_low', action: 'increase_salary' };
    }

    // Different region
    if (/boshqa\s*(hudud|shahar|viloyat)/i.test(lower)) {
        return { type: 'change_region', action: 'ask_region' };
    }

    // Want more results
    if (/yana|boshqa|ko'proq/i.test(lower)) {
        return { type: 'more_results', action: 'next_page' };
    }

    return null;
}
