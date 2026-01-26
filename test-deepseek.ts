// Test DeepSeek extraction
// Run: npx tsx test-deepseek.ts

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { extractVacancyData, cleanHtmlForAI } from './lib/ai/deepseek';
import { parse } from 'node-html-parser';

const TEST_URL = 'https://ishplus.uz/vacancy/3019/eb843e69-01f5-422e-949a-c598f3b7e6a1';

async function testDeepSeek() {
    console.log('=== Testing DeepSeek Extraction ===\n');
    console.log('Fetching:', TEST_URL);

    const response = await fetch(TEST_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const html = await response.text();
    const root = parse(html);

    // Extract sections using fixed selectors
    const findSectionByTitle = (titleText: string): string | undefined => {
        const titles = root.querySelectorAll('.title.text-primary, .title');
        for (const title of titles) {
            const titleContent = title.textContent.trim().toLowerCase();
            if (titleContent.includes(titleText.toLowerCase())) {
                const nextSibling = title.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('list')) {
                    return nextSibling.textContent.trim();
                }
            }
        }
        return undefined;
    };

    const requirements = findSectionByTitle('Talablar');
    const duties = findSectionByTitle('Ish vazifalari');
    const conditions = findSectionByTitle('Ish sharoitlari');

    const rawText = [
        requirements ? `Talablar: ${requirements}` : '',
        duties ? `Ish vazifalari: ${duties}` : '',
        conditions ? `Ish sharoitlari: ${conditions}` : '',
    ].filter(Boolean).join('\n\n');

    console.log('\n--- Raw Text (before cleaning) ---');
    console.log(rawText.slice(0, 500));
    console.log(`\nLength: ${rawText.length} chars`);

    // Clean the text
    const cleanedText = cleanHtmlForAI(rawText);
    console.log('\n--- Cleaned Text ---');
    console.log(cleanedText.slice(0, 500));
    console.log(`\nLength: ${cleanedText.length} chars`);

    // Extract with DeepSeek
    console.log('\n--- Calling DeepSeek API ---');
    const result = await extractVacancyData(rawText, 'Qadoqlovchi ayol', '"Minora" MChJ');

    console.log('\n--- Extraction Results ---');
    console.log('Meta:', JSON.stringify(result.meta, null, 2));
    console.log('\nSections:');
    console.log('  Talablar:', result.sections.talablar);
    console.log('  Ish vazifalari:', result.sections.ish_vazifalari);
    console.log('  Qulayliklar:', result.sections.qulayliklar);
    console.log('  Tillar:', result.sections.tillar);
    console.log('  Skills:', result.sections.skills);

    console.log('\n=== Test Complete ===');
}

testDeepSeek().catch(console.error);
