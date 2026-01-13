import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, jobTitle, description, prompt, categories, districts } = body;

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                error: "AI xizmati sozlanmagan. OPENAI_API_KEY ni qo'shing.",
                fallback: true
            }, { status: 503 });
        }

        const systemPrompt = `Sen professional HR mutaxassisisisan. O'zbek tilida (lotin alifbosida) yoz. Qisqa va aniq bo'l.`;

        // New: Full form generation from natural language
        if (action === 'full_generate') {
            if (!prompt) {
                return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
            }

            const categoriesList = categories?.map((c: any) => `${c.id}: ${c.name}`).join('\n') || '';
            const districtsList = districts?.map((d: any) => `${d.id}: ${d.name}`).join('\n') || '';

            const fullPrompt = `Foydalanuvchi quyidagi vakansiya haqida yozdi:
"${prompt}"

Quyidagi JSON formatida javob ber (faqat JSON, boshqa hech narsa emas):

{
  "title": "lavozim nomi",
  "category_id": "kategoriya ID (quyidagi ro'yxatdan tanlash)",
  "district_id": "tuman ID (quyidagi ro'yxatdan tanlash)",
  "employment_type": "full_time|part_time|contract|internship|remote",
  "experience": "no_experience|1_3|3_6|6_plus",
  "salary_min": number or null,
  "salary_max": number or null,
  "salary_negotiable": true|false,
  "gender": "any|male|female",
  "age_min": number or null,
  "age_max": number or null,
  "tasks_requirements": "talablar va vazifalar matni (har bir punkt • belgisi bilan)",
  "benefits": "qulayliklar matni (har bir punkt • belgisi bilan)"
}

Mavjud kategoriyalar:
${categoriesList}

Mavjud tumanlar:
${districtsList}

Agar matnda ma'lumot bo'lmasa, null yoki default qiymat qo'y.
Faqat JSON javob ber, boshqa izoh kerak emas.`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: fullPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1500,
            });

            const resultText = completion.choices[0]?.message?.content || "";

            try {
                // Extract JSON from response (might have markdown code blocks)
                let jsonStr = resultText;
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[0];
                }

                const parsed = JSON.parse(jsonStr);

                return NextResponse.json({
                    success: true,
                    action: 'full_generate',
                    result: parsed
                });
            } catch (parseError) {
                console.error('Failed to parse AI response:', resultText);
                // Fallback: just return tasks_requirements
                return NextResponse.json({
                    success: true,
                    action: 'full_generate',
                    result: {
                        tasks_requirements: resultText
                    }
                });
            }
        }

        // Original: Generate from job title only
        if (action === 'generate') {
            if (!jobTitle) {
                return NextResponse.json({ error: 'jobTitle is required' }, { status: 400 });
            }

            const genPrompt = `"${jobTitle}" lavozimi uchun to'liq vakansiya tavsifini yoz.

Format (har bir bo'limni yangi qatordan boshla):

MAS'ULIYATLAR:
• [3-5 ta asosiy vazifa]

TALABLAR:
• [3-5 ta talab]

BIZ TAKLIF QILAMIZ:
• [3-4 ta afzallik]

Faqat matnni yoz, qo'shimcha tushuntirishlar kerak emas.`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: genPrompt }
                ],
                temperature: 0.7,
                max_tokens: 800,
            });

            const result = completion.choices[0]?.message?.content || "";

            return NextResponse.json({
                success: true,
                action: 'generate',
                result: result
            });

        } else if (action === 'improve') {
            if (!description) {
                return NextResponse.json({ error: 'description is required' }, { status: 400 });
            }

            const improvePrompt = `Quyidagi vakansiya tavsifini professional qilib qayta yoz.
- Grammatik xatolarni tuzat
- Aniqroq va tushunarli qil
- Professional uslubda yoz

Original matn:
${description}

Yaxshilangan versiyani yoz:`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: improvePrompt }
                ],
                temperature: 0.7,
                max_tokens: 800,
            });

            const result = completion.choices[0]?.message?.content || "";

            return NextResponse.json({
                success: true,
                action: 'improve',
                result: result
            });

        } else if (action !== 'full_generate') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ error: 'Unknown error' }, { status: 500 });

    } catch (error) {
        console.error('AI Vacancy Helper error:', error);
        return NextResponse.json(
            { error: "AI xizmatida xatolik yuz berdi." },
            { status: 500 }
        );
    }
}
