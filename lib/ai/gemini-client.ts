/**
 * Gemini AI Client for Job Search
 * Supports Smart/Eco modes with automatic switching
 */

import { generateVertexText } from './vertex-client';
import { JobSearchFiltersSchema, type JobSearchFilters, type AiSearchResponse } from './schemas';
import { EXTRACTION_PROMPT, ECO_EXTRACTION_PROMPT, GREETING_RESPONSES } from './prompts';


// Vertex AI models; both primary and fallback stay on the Cloud endpoint.
const PRIMARY_MODEL_ID = process.env.VERTEX_MODEL || 'gemini-2.5-flash';
const FALLBACK_MODEL_ID = process.env.VERTEX_FALLBACK_MODEL || 'gemini-2.5-flash-lite';

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
        console.error('[Vertex] Failed to parse JSON:', text);
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

    // Try the configured primary and fallback models through Vertex AI.
    async function tryModel(modelId: string): Promise<string> {
        return generateVertexText(prompt, { model: modelId, maxOutputTokens: config.maxOutputTokens, temperature: config.temperature });
    }

    try {
        let text: string;
        let usedModel = PRIMARY_MODEL_ID;

        try {
            // Try the configured Vertex primary model first
            text = await tryModel(PRIMARY_MODEL_ID);
            console.log(`[Vertex] Using primary model: ${PRIMARY_MODEL_ID}`);
        } catch (primaryError: any) {
            // Fallback to another Vertex model
            console.warn(`[Vertex] Primary model failed, trying fallback: ${primaryError.message}`);
            text = await tryModel(FALLBACK_MODEL_ID);
            usedModel = FALLBACK_MODEL_ID;
            console.log(`[Vertex] Using fallback model: ${FALLBACK_MODEL_ID}`);
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
        console.error('[Vertex] All models failed:', error.message);

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
        return (await generateVertexText('Say "ok"', { model: PRIMARY_MODEL_ID, maxOutputTokens: 16 })).length > 0;
    } catch {
        return false;
    }
}
