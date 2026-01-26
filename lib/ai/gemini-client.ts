/**
 * Gemini AI Client for Job Search
 * Supports Smart/Eco modes with automatic switching
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { JobSearchFiltersSchema, type JobSearchFilters, type AiSearchResponse } from './schemas';
import { EXTRACTION_PROMPT, ECO_EXTRACTION_PROMPT, GREETING_RESPONSES } from './prompts';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configuration - Gemini 3 Flash (primary) with Gemini 2.5 Flash (fallback)
const PRIMARY_MODEL_ID = 'gemini-3-flash-preview';
const FALLBACK_MODEL_ID = 'gemini-2.5-flash-preview-04-17';

// Mode configurations
const MODE_CONFIG = {
    smart: {
        maxOutputTokens: 1000,
        temperature: 0.3,
        prompt: EXTRACTION_PROMPT,
    },
    eco: {
        maxOutputTokens: 300,
        temperature: 0.1,
        prompt: ECO_EXTRACTION_PROMPT,
    },
};

export type AiMode = 'smart' | 'eco';

/**
 * Determine which mode to use based on query complexity
 */
export function determineMode(query: string): AiMode {
    const lowerQuery = query.toLowerCase();

    // Use Smart mode for complex queries
    const complexPatterns = [
        /почему|зачем|объясни|расскажи/i,  // Questions needing explanation
        /nima uchun|tushuntir|aytib ber/i, // Uzbek equivalents
        /.{80,}/,                           // Long queries (80+ chars)
    ];

    for (const pattern of complexPatterns) {
        if (pattern.test(query)) {
            return 'smart';
        }
    }

    // Count filter indicators
    const filterIndicators = [
        /maosh|зарплат|salary/i,
        /viloyat|район|регион|tuman|shahar/i,
        /masofaviy|удалён|remote/i,
        /talaba|студент|student/i,
        /tajriba|опыт|experience/i,
    ];

    let filterCount = 0;
    for (const pattern of filterIndicators) {
        if (pattern.test(lowerQuery)) filterCount++;
    }

    // Use Smart if multiple filters detected
    if (filterCount >= 3) return 'smart';

    // Default to Eco mode
    return 'eco';
}

/**
 * Check if query is a simple greeting
 */
function isGreeting(query: string): boolean {
    const greetings = [
        /^(salom|assalom|hello|hi|hey|салом|привет|здравствуй)/i,
        /^(qanday|как дела|nima gap)/i,
    ];

    return greetings.some(p => p.test(query.trim()));
}

/**
 * Get random greeting response
 */
function getGreetingResponse(lang: 'uz' | 'ru'): AiSearchResponse {
    const responses = GREETING_RESPONSES[lang];
    const message = responses[Math.floor(Math.random() * responses.length)];

    return {
        intent: 'greeting',
        filters: { keywords: [] },
        reply_language: lang,
        user_message: message,
    };
}

/**
 * Parse JSON from Gemini response
 * Handles markdown code blocks and edge cases
 */
function parseGeminiJson(text: string): unknown {
    // Remove markdown code blocks if present
    let cleaned = text
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/gi, '')
        .trim();

    // Try to find JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }

    try {
        return JSON.parse(cleaned);
    } catch {
        console.error('[Gemini] Failed to parse JSON:', text);
        throw new Error('Invalid JSON response from AI');
    }
}

/**
 * Call Gemini API to extract filters from query
 */
export async function extractFilters(
    query: string,
    lang: 'uz' | 'ru' = 'uz',
    mode?: AiMode
): Promise<{ result: AiSearchResponse; mode: AiMode }> {
    // Handle greetings without API call
    if (isGreeting(query)) {
        return {
            result: getGreetingResponse(lang),
            mode: 'eco',
        };
    }

    // Determine mode if not specified
    const selectedMode = mode || determineMode(query);
    const config = MODE_CONFIG[selectedMode];
    const prompt = `${config.prompt}\n\nQuery: "${query}"`;

    // Try primary model (Gemini 3 Flash), fallback to Gemini 2.5 Flash
    async function tryModel(modelId: string): Promise<string> {
        const model = genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                maxOutputTokens: config.maxOutputTokens,
                temperature: config.temperature,
            },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    try {
        let text: string;
        let usedModel = PRIMARY_MODEL_ID;

        try {
            // Try Gemini 3 Flash first
            text = await tryModel(PRIMARY_MODEL_ID);
            console.log(`[Gemini] Using primary model: ${PRIMARY_MODEL_ID}`);
        } catch (primaryError: any) {
            // Fallback to Gemini 2.5 Flash
            console.warn(`[Gemini] Primary model failed, trying fallback: ${primaryError.message}`);
            text = await tryModel(FALLBACK_MODEL_ID);
            usedModel = FALLBACK_MODEL_ID;
            console.log(`[Gemini] Using fallback model: ${FALLBACK_MODEL_ID}`);
        }

        // Parse and validate response
        const parsed = parseGeminiJson(text);

        // Validate with Zod schema (lenient)
        const validated: AiSearchResponse = {
            intent: (parsed as any).intent || 'search',
            filters: JobSearchFiltersSchema.parse((parsed as any).filters || {}),
            reply_language: (parsed as any).reply_language || lang,
            user_message: (parsed as any).user_message,
        };

        return { result: validated, mode: selectedMode };

    } catch (error: any) {
        console.error('[Gemini] All models failed:', error.message);

        // Return fallback response (no AI)
        return {
            result: {
                intent: 'search',
                filters: {
                    keywords: query.split(/\s+/).filter(w => w.length > 2).slice(0, 3),
                },
                reply_language: lang,
            },
            mode: 'eco',
        };
    }
}

/**
 * Check if Gemini API is available
 */
export async function checkGeminiHealth(): Promise<boolean> {
    try {
        const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL_ID });
        const result = await model.generateContent('Say "ok"');
        return result.response.text().length > 0;
    } catch {
        return false;
    }
}
