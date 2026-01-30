
const html = `<div data-v-359245d2="" class="mb-8"><h3 data-v-359245d2="" class="text-[22px] font-bold text-[#252525] mb-3">Ijtimоiy paketlar:</h3><div data-v-359245d2="" class="flex flex-wrap gap-2"><span data-v-359245d2="" class="px-2.5 py-1 bg-[#E5F5F8] text-[#004754] rounded-[8px] text-base font-medium">Tibbiy ko‘rik mavjud</span><span data-v-359245d2="" class="px-2.5 py-1 bg-[#E5F5F8] text-[#004754] rounded-[8px] text-base font-medium">Moddiy rag‘batlantirish mavjud</span></div><hr data-v-359245d2="" class="text-[#E5E7EB] my-9"></div>`;

function extractBenefitsFromHtml(html?: string): number[] {
    if (!html) return [];
    const benefits: number[] = [];

    // Normalize HTML content for searching
    const content = html.toLowerCase();

    // Common mappings based on text
    const textToId: Record<string, number> = {
        'moddiy rag': 1, // Moddiy rag‘batlantirish mavjud
        'tibbiy sug': 2, // Tibbiy sug'urta
        'maxsus kiyim': 3, // Maxsus kiyim bilan ta'minlanadi
        'transport': 4, // Transport xizmati
        'ovqat': 5, // Bepul ovqatlanish
        'malaka oshirish': 6, // Malaka oshirish
        'bonus': 7, // Bonus tizimi
        'dam olish': 8, // Dam olish kunlari
        'tibbiy ko': 9, // Tibbiy ko'rik mavjud
        'sport': 10 // Sport zali
    };

    for (const [key, id] of Object.entries(textToId)) {
        if (content.includes(key)) {
            console.log(`Matched: "${key}" -> ID ${id}`);
            benefits.push(id);
        }
    }

    return benefits;
}

const result = extractBenefitsFromHtml(html);
console.log('Result:', result);
