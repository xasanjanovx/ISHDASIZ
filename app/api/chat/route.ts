import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { message, history = [], userId } = await request.json();

        if (!message && (!history || history.length === 0)) {
            return NextResponse.json({ error: 'Message or history is required' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                response: "AI xizmati hozircha mavjud emas. Iltimos, keyinroq urinib ko'ring.",
                fallback: true
            });
        }

        // 1. Get User Profile Context if logged in
        let userContext = "";
        if (userId) {
            const { data: profile } = await supabase
                .from('job_seeker_profiles')
                .select('full_name, city')
                .eq('user_id', userId)
                .single();

            if (profile) {
                userContext = `\nFoydalanuvchi ma'lumiotlari:\n- Ism: ${profile.full_name}\n- Hudud: ${profile.city || 'Noma\'lum'}\n`;
            }
        }

        // 2. Define Tools for OpenAI
        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: "search_jobs",
                    description: "Vakansiyalarni butun O'zbekiston bo'ylab (Toshkent, Samarqand, Andijon va h.k.) qidirish",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Lavozim yoki kalit so'z (masalan: 'dasturchi', 'haydovchi')" },
                            category_id: { type: "string", description: "Kategoriya UUID si" },
                            district_id: { type: "string", description: "Tuman UUID si" },
                            salary_min: { type: "number", description: "Minimal maosh" },
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_location_info",
                    description: "Andijon viloyati tumanlari va shaharlari ro'yxatini olish",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_categories",
                    description: "Ish kategoriyalari (sohalar) ro'yxatini olish",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_job_details",
                    description: "Muayyan vakansiya haqida batafsil ma'lumot olish (talablar, sharoitlar)",
                    parameters: {
                        type: "object",
                        properties: {
                            job_id: { type: "string", description: "Vakansiya UUID si" }
                        },
                        required: ["job_id"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_special_filters",
                    description: "Talabalar, ayollar yoki nogironligi bor shaxslar uchun mos ish filtrlari haqida ma'lumot",
                    parameters: { type: "object", properties: {} }
                }
            }
        ];

        // 3. Prepare Messages for OpenAI
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: `Sen "ISHDASIZ" portalining professional HR-ekspertisan. Maqsading: Foydalanuvchiga eng mos ishni topib berish.
    
    MUHIM QOIDALAR (Step-by-Step):
    1. **Tahlil**: Foydalanuvchi so'rovini diqqat bilan o'qi. Agar faqat "Ish kerak" desa, darhol qayerdaligini (Viloyat, Tuman) va qanday ish (Soha) izlayotganini so'ra.
    2. **Joylashuvni Aniqlash**: Agar foydalanuvchi shahar yoki tuman nomini aytsa (masalan "Chilonzor", "Samarqand"), AVVAL "get_location_info" funksiyasini chaqirib, ushbu joyning ID sini top.
    3. **Qidiruv**: Joylashuv ID si va kalit so'zlar bilan "search_jobs" funksiyasini chaqir.
    4. **Natija**:
       - Agar vakansiyalar topilsa: Ularni qisqacha ta'riflab ber va "Qaysi biri haqida batafsil ma'lumot beray?" deb so'ra.
       - Agar topilmasa: "Kechirasiz, [Hudud]da [Lavozim] bo'yicha hozircha vakansiya yo'q. Lekin mana bu o'xshash variantlarni ko'rishingiz mumkin" deb, qidiruvni kengaytirib (masalan, qo'shni tuman yoki faqat soha bo'yicha) qayta qidirib ko'r.
    5. **Muloqot**: Doimo xushmuomala, professional va yordamga tayyor bo'l. Javoblarni faqat O'zbek tilida (lotin yozuvida) ber.
    
    ${userContext}`
            },
            ...history,
            { role: 'user', content: message }
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.7,
        });

        const assistantMessage = response.choices[0].message;

        // 4. Handle Tool Calls
        if (assistantMessage.tool_calls) {
            const toolResults = [];

            for (const toolCall of assistantMessage.tool_calls) {
                const tc = toolCall as any;
                const functionName = tc.function.name;
                const args = JSON.parse(tc.function.arguments);

                let result;
                if (functionName === 'search_jobs') {
                    let queryBuilder = supabase
                        .from('jobs')
                        .select('*, districts(name_uz, regions(name_uz)), categories(name_uz)')
                        .eq('status', 'active')
                        .limit(10);

                    if (args.query) {
                        // Search in title, description, and company name
                        queryBuilder = queryBuilder.or(`title_uz.ilike.%${args.query}%,title_ru.ilike.%${args.query}%,description_uz.ilike.%${args.query}%,description_ru.ilike.%${args.query}%,company_name.ilike.%${args.query}%`);
                    }
                    if (args.category_id) queryBuilder = queryBuilder.eq('category_id', args.category_id);

                    // Improved Location Filtering
                    if (args.district_id) {
                        queryBuilder = queryBuilder.eq('district_id', args.district_id);
                    } else if (args.region_id) {
                        queryBuilder = queryBuilder.eq('region_id', args.region_id);
                    }

                    if (args.salary_min) queryBuilder = queryBuilder.gte('salary_min', args.salary_min);

                    const { data } = await queryBuilder;
                    result = data || [];
                } else if (functionName === 'get_location_info') {
                    // Fetch all regions and districts to help AI map names to IDs
                    const { data } = await supabase
                        .from('districts')
                        .select('id, name_uz, regions(id, name_uz)')
                        .order('name_uz');
                    result = data;
                } else if (functionName === 'get_categories') {
                    const { data } = await supabase.from('categories').select('id, name_uz').order('name_uz');
                    result = data;
                } else if (functionName === 'get_job_details') {
                    const { data } = await supabase
                        .from('jobs')
                        .select('*, districts(name_uz), categories(name_uz)')
                        .eq('id', args.job_id)
                        .single();
                    result = data;
                } else if (functionName === 'get_special_filters') {
                    result = {
                        is_for_students: "Talabalar uchun mos ishlar",
                        is_for_women: "Ayollar uchun mos ishlar",
                        is_for_disabled: "Nogironligi bor shaxslar uchun mos ishlar"
                    };
                }

                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(result),
                });
            }

            // Get final response after tools
            const finalResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [...messages, assistantMessage, ...(toolResults as any)],
            });

            // Extract jobs from results if it was a search
            const searchToolCall = assistantMessage.tool_calls.find(tc => (tc as any).function.name === 'search_jobs');
            let foundJobs = [];
            if (searchToolCall) {
                const searchResult = toolResults.find(tr => tr.tool_call_id === searchToolCall.id);
                if (searchResult) foundJobs = JSON.parse(searchResult.content);
            }

            return NextResponse.json({
                response: finalResponse.choices[0].message.content,
                jobs: foundJobs
            });
        }

        return NextResponse.json({
            response: assistantMessage.content,
            jobs: []
        });

    } catch (error: any) {
        console.error('AI Chat error:', error);
        return NextResponse.json(
            { error: "AI xizmatida xatolik yuz berdi.", fallback: true },
            { status: 500 }
        );
    }
}
