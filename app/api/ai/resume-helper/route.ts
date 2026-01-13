import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
let openai: OpenAI | null = null;

function getOpenAI() {
    if (!openai && process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openai;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, content, title, jobTitle } = body;

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                error: "AI xizmati sozlanmagan. OPENAI_API_KEY ni qo'shing.",
                fallback: true
            }, { status: 503 });
        }

        const systemPrompt = `Sen professional HR maslahatchisisan. O'zbek tilida (lotin alifbosida) javob ber. Maqsad: Nomzodning rezyumesini professional va jozibador qilish.`;

        if (action === 'improve_about') {
            if (!content && !title) {
                return NextResponse.json({ error: 'Content or Title is required' }, { status: 400 });
            }

            const prompt = `Quyidagi "O'zi haqida" matnini yoki nomzodning lavozimidan kelib chiqib professional rezyume uchun "O'zi haqida" (About) qismini yozib ber. 
            
            Lavozim: ${title || 'Noma\'lum'}
            Hozirgi matn: ${content || '(bo\'sh)'}

            Talablar:
            - Professional uslubda yoz.
            - Nomzodning kuchli tomonlarini va maqsadlarini ta'kidla.
            - Grammatik xatolarni to'g'irla.
            - 3-5 gapdan oshmasin.
            
            Faqat matnni yoz.`;

            const completion = await getOpenAI()!.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });

            return NextResponse.json({
                success: true,
                result: completion.choices[0]?.message?.content || ""
            });
        }

        if (action === 'improve_experience') {
            if (!content && !jobTitle) {
                return NextResponse.json({ error: 'Content or Job Title is required' }, { status: 400 });
            }

            const prompt = `Quyidagi ish tajribasi tavsifini yoki lavozim nomidan kelib chiqib, rezyume uchun vazifalar va yutuqlar ro'yxatini yozib ber.

            Lavozim: ${jobTitle}
            Hozirgi matn: ${content || '(bo\'sh)'}

            Talablar:
            - "•" belgilari bilan ro'yxat shaklida yoz.
            - Aniq yutuqlar va mas'uliyatlarni keltir.
            - Professional so'zlardan foydalan.
            - 5 ta punktdan oshmasin.
            
            Faqat ro'yxatni yoz.`;

            const completion = await getOpenAI()!.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });

            return NextResponse.json({
                success: true,
                result: completion.choices[0]?.message?.content || ""
            });
        }

        if (action === 'suggest_skills') {
            if (!title) {
                return NextResponse.json({ error: 'Title is required' }, { status: 400 });
            }

            const prompt = `"${title}" lavozimi uchun eng muhim 10 ta professional ko'nikmani (hard skills & soft skills) vergul bilan ajratib yoz. Faqat ko'nikmalar nomini yoz.`;

            const completion = await getOpenAI()!.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 200,
            });

            const text = completion.choices[0]?.message?.content || "";
            // Split based on comma or newline
            const skills = text.split(/,|\n/).map(s => s.trim().replace(/^[-•]\s*/, '')).filter(s => s.length > 0);

            return NextResponse.json({
                success: true,
                result: skills
            });
        }

        if (action === 'parse_resume') {
            const { content, categories, districts } = body;
            if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

            const prompt = `
            Quyidagi matndan rezyume ma'lumotlarini ajratib ol va JSON formatida qaytar.
            
            Matn: "${content}"

            Mavjud Kategoriyalar: ${JSON.stringify(categories.map((c: any) => ({ id: c.id, name: c.name })))}
            Mavjud Tumanlar: ${JSON.stringify(districts.map((d: any) => ({ id: d.id, name: d.name })))}

            Quyidagi strukturada JSON qaytar:
            {
                "title": "Lavozim nomi (masalan: Buxgalter, Sotuvchi). Agar matnda yo'q bo'lsa, tajribasidan kelib chiqib nomla.",
                "full_name": "F.I.O",
                "phone": "Telefon raqami (agar bo'lsa)",
                "birth_date": "Tug'ilgan sana YYYY-MM-DD formatida (yoki yoshidan hisobla)",
                "gender": "male yoki female (ismidan aniqla)",
                "about": "Professional 'O'zi haqida' matni. Nomzodning kuchli tomonlari, yutuqlari va maqsadlarini ta'kidlaydigan, 3-4 gapdan iborat jozibali matn.",
                "skills": ["ko'nikma1", "ko'nikma2", ...],
                "salary_min": "Kutilayotgan minimal maosh (raqamda, so'mda)",
                "salary_max": "Kutilayotgan maksimal maosh (raqamda, so'mda)",
                "category_id": "eng mos kategoriya ID si (yoki null)",
                "district_id": "eng mos tuman ID si (yoki null)",
                "experience_level": "no_experience, 1_year, 3_years, 5_years, yoki 10_years (matndan aniqla)",
                "experience_years_count": 0, // Aniq necha yil tajribasi borligi (aniqlay olmasang 0)
                "education_level": "secondary, vocational, higher, yoki master (matndan aniqla)",
                "languages": [ "Rus tili", "Ingliz tili" ] // Matnda tilga olingan tillar
            }

            Faqat JSON formatida javob ber. Hech qanday qo'shimcha so'z yozma.
            `;


            const completion = await getOpenAI()!.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: "Sen ma'lumotlarni strukturalashtiruvchi AI yordamchisan. Faqat valid JSON qaytar." },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0]?.message?.content || "{}");

            return NextResponse.json({
                success: true,
                result: result
            });
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
