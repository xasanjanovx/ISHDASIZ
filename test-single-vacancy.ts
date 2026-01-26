// Quick test to verify the fixed selectors
// Run: npx tsx test-single-vacancy.ts

import { parse } from 'node-html-parser';

const TEST_URL = 'https://ishplus.uz/vacancy/3019/eb843e69-01f5-422e-949a-c598f3b7e6a1';

async function testVacancy() {
    console.log('Fetching:', TEST_URL);

    const response = await fetch(TEST_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const html = await response.text();
    console.log('HTML length:', html.length);

    const root = parse(html);

    // New selector logic - matching ishplus.ts
    const findSectionByTitle = (titleText: string): string | undefined => {
        const titles = root.querySelectorAll('.title.text-primary, .title');
        for (const title of titles) {
            const titleContent = title.textContent.trim().toLowerCase();
            if (titleContent.includes(titleText.toLowerCase())) {
                const nextSibling = title.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('list')) {
                    return nextSibling.textContent.trim();
                }
                // Fallback
                const parent = title.parentNode;
                if (parent && 'textContent' in parent) {
                    const fullText = (parent.textContent || '').replace(title.textContent, '').trim();
                    if (fullText && fullText.length > 10) return fullText;
                }
            }
        }
        return undefined;
    };

    const requirements = findSectionByTitle('Talablar');
    const duties = findSectionByTitle('Ish vazifalari');
    const conditions = findSectionByTitle('Ish sharoitlari');

    console.log('\n=== EXTRACTION RESULTS ===');
    console.log('\n--- Talablar ---');
    console.log(requirements || 'NOT FOUND');

    console.log('\n--- Ish vazifalari ---');
    console.log(duties || 'NOT FOUND');

    console.log('\n--- Ish sharoitlari ---');
    console.log(conditions || 'NOT FOUND');

    // Build rawText to test AI extraction length
    const rawText = [
        requirements ? `Talablar: ${requirements}` : '',
        duties ? `Ish vazifalari: ${duties}` : '',
        conditions ? `Ish sharoitlari: ${conditions}` : '',
    ].filter(Boolean).join('\n\n');

    console.log('\n=== RAW TEXT FOR AI ===');
    console.log('Length:', rawText.length, 'chars');
    console.log('Meets 500 char minimum:', rawText.length >= 500 ? 'YES ✅' : 'NO ❌');
}

testVacancy().catch(console.error);
