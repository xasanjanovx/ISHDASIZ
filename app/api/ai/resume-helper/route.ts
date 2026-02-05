/**
 * Resume Helper API - DeepSeek Powered
 * Helps users improve their resumes with AI suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeekText } from '@/lib/ai/deepseek';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, content, title, jobTitle } = body;

        if (!process.env.DEEPSEEK_API_KEY) {
            return NextResponse.json({
                error: "AI xizmati sozlanmagan. DEEPSEEK_API_KEY ni qo'shing.",
                fallback: true
            }, { status: 503 });
        }

        const systemPrompt = `Sen professional HR maslahatchisisan. O'zbek tilida (lotin alifbosida) javob ber. Maqsad: Nomzodning rezyumesini professional va jozibador qilish.`;

        if (action === 'improve_about') {
            if (!content && !title) {
                return NextResponse.json({ error: 'Content or Title is required' }, { status: 400 });
            }

            const prompt = `${systemPrompt}

Quyidagi "O'zi haqida" matnini yoki nomzodning lavozimidan kelib chiqib professional rezyume uchun "O'zi haqida" (About) qismini yozib ber. 

Lavozim: ${title || 'Noma\'lum'}
Hozirgi matn: ${content || '(bo\'sh)'}

Talablar:
- Professional uslubda yoz.
- Nomzodning kuchli tomonlarini va maqsadlarini ta'kidla.
- Grammatik xatolarni to'g'irla.
- 3-5 gapdan oshmasin.

Faqat matnni yoz.`;

            const result = await callDeepSeekText(prompt);
            return NextResponse.json({ success: true, result });
        }

        if (action === 'improve_experience') {
            if (!content && !jobTitle) {
                return NextResponse.json({ error: 'Content or Job Title is required' }, { status: 400 });
            }

            const prompt = `${systemPrompt}

Quyidagi ish tajribasi tavsifini yoki lavozim nomidan kelib chiqib, rezyume uchun vazifalar va yutuqlar ro'yxatini yozib ber.

Lavozim: ${jobTitle}
Hozirgi matn: ${content || '(bo\'sh)'}

Talablar:
- "•" belgilari bilan ro'yxat shaklida yoz.
- Aniq yutuqlar va mas'uliyatlarni keltir.
- Professional so'zlardan foydalan.
- 5 ta punktdan oshmasin.

Faqat ro'yxatni yoz.`;

            const result = await callDeepSeekText(prompt);
            return NextResponse.json({ success: true, result });
        }

        if (action === 'suggest_skills') {
            if (!title) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }

            const prompt = `"${title}" lavozimi uchun eng muhim 10 ta professional ko'nikmani (hard skills & soft skills) vergul bilan ajratib yoz. Faqat ko'nikmalar nomini yoz.`;

            const text = await callDeepSeekText(prompt, 200);
            const skills = text.split(/,|\n/).map(s => s.trim().replace(/^[-•]\s*/, '')).filter(s => s.length > 0);

            return NextResponse.json({ success: true, result: skills });
        }

        if (action === 'parse_resume') {
            const { content, categories, districts } = body;
            if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

            const prompt = `
Sen ma'lumotlarni strukturalashtiruvchi AI yordamchisan. Faqat valid JSON qaytar.

Quyidagi matndan rezyume ma'lumotlarini ajratib ol va JSON formatida qaytar.

Matn: "${content}"

Mavjud Kategoriyalar: ${JSON.stringify(categories?.map((c: any) => ({ id: c.id, name: c.name })) || [])}
Mavjud Tumanlar: ${JSON.stringify(districts?.map((d: any) => ({ id: d.id, name: d.name })) || [])}

Quyidagi strukturada JSON qaytar:
{
    "title": "Lavozim nomi",
    "full_name": "F.I.O",
    "phone": "Telefon raqami",
    "birth_date": "YYYY-MM-DD formatida",
    "gender": "male yoki female",
    "about": "Professional 'O'zi haqida' matni 3-4 gap",
    "skills": ["ko'nikma1", "ko'nikma2"],
    "salary_min": null,
    "salary_max": null,
    "category_id": null,
    "district_id": null,
    "experience_level": "no_experience yoki 1_year yoki 3_years",
    "experience_years_count": 0,
    "education_level": "secondary yoki vocational yoki higher",
    "languages": ["Rus tili", "Ingliz tili"]
}

Faqat JSON formatida javob ber.`;

            const text = await callDeepSeekText(prompt, 800, undefined, 0.2);

            // Parse JSON
            let result = {};
            try {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) {
                    result = JSON.parse(match[0]);
                }
            } catch {
                console.error('[Resume Helper] Failed to parse JSON:', text);
            }

            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('AI Resume Helper error:', error);
        return NextResponse.json(
            { error: "AI xizmatida xatolik yuz berdi." },
            { status: 500 }
        );
    }
}

