/**
 * Vacancy Helper API - Gemini Powered
 * Helps employers create better job postings with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

async function callGemini(prompt: string, maxTokens: number = 500): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({
            model: PRIMARY_MODEL,
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch {
        // Fallback
        const model = genAI.getGenerativeModel({
            model: FALLBACK_MODEL,
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 }
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, title, description, category } = body;

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({
                error: "AI xizmati sozlanmagan. GEMINI_API_KEY ni qo'shing.",
                fallback: true
            }, { status: 503 });
        }

        const systemPrompt = `Sen professional HR mutaxassisisisan. O'zbek tilida (lotin alifbosida) javob ber. Maqsad: Ish beruvchiga professional va jozibador vakansiya e'loni yaratishda yordam berish.`;

        if (action === 'improve_description') {
            if (!title && !description) {
                return NextResponse.json({ error: 'Title or description is required' }, { status: 400 });
            }

            const prompt = `${systemPrompt}

Quyidagi vakansiya tavsifini professional uslubda qayta yozib ber.

Lavozim: ${title || 'Noma\'lum'}
Kategoriya: ${category || 'Noma\'lum'}
Hozirgi tavsif: ${description || '(bo\'sh)'}

Talablar:
- Professional HR uslubida yoz
- Kompaniya madaniyati va imtiyozlarni ta'kidla
- Grammatik xatolarni to'g'irla
- 3-5 paragrafdan oshmasin

Faqat tavsifni yoz.`;

            const result = await callGemini(prompt);
            return NextResponse.json({ success: true, result });
        }

        if (action === 'generate_requirements') {
            if (!title) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }

            const prompt = `${systemPrompt}

"${title}" lavozimi uchun talablar va vazifalar ro'yxatini yozib ber.

Kategoriya: ${category || 'Umumiy'}

Format:
TALABLAR:
• ...
• ...

VAZIFALAR:
• ...
• ...

Har birida 4-6 ta punkt bo'lsin.`;

            const result = await callGemini(prompt, 600);
            return NextResponse.json({ success: true, result });
        }

        if (action === 'suggest_salary') {
            if (!title) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }

            const prompt = `O'zbekiston mehnat bozorida "${title}" lavozimi uchun o'rtacha maoshni so'mda taxmin qil. Faqat quyidagi formatda javob ber:
{"min": 3000000, "max": 6000000}
Boshqa hech narsa yozma.`;

            const text = await callGemini(prompt, 100);

            let result = { min: 3000000, max: 5000000 }; // default
            try {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    result = JSON.parse(match[0]);
                }
            } catch {
                console.error('[Vacancy Helper] Failed to parse salary JSON');
            }

            return NextResponse.json({ success: true, result });
        }

        if (action === 'generate_benefits') {
            if (!title) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }

            const prompt = `"${title}" lavozimi uchun O'zbekiston kompaniyalarida odatda beriladigan qulayliklar va imtiyozlar ro'yxatini yoz.

Format:
• ...
• ...

5-8 ta punkt yoz. Faqat ro'yxatni yoz.`;

            const result = await callGemini(prompt, 400);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('AI Vacancy Helper error:', error);
        return NextResponse.json(
            { error: "AI xizmatida xatolik yuz berdi." },
            { status: 500 }
        );
    }
}
