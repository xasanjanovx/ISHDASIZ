
import 'dotenv/config';

const API_VACANCIES = 'https://osonish.uz/api/api/v1/vacancies?page=1&per_page=50&status=2';
const API_DETAIL_BASE = 'https://osonish.uz/api/api/v1/vacancies/';

// Helper to strip HTML for benefits check
function stripHtml(html: string) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function analyze() {
    console.log('Fetching OsonIsh list...');
    const res = await fetch(API_VACANCIES);
    const json = await res.json();
    const list = json.data.data;

    console.log(`Fetched ${list.length} items. Fetching details...`);

    const details = [];
    for (const item of list.slice(0, 50)) { // Analyze 50 items
        try {
            const dRes = await fetch(API_DETAIL_BASE + item.id);
            const dJson = await dRes.json();
            if (dJson.success && dJson.data) {
                details.push(dJson.data);
            }
        } catch (e) { console.error('Error fetching', item.id); }
    }

    console.log('\n=== CATEGORY ANALYSIS (mmk_group) ===');
    const categories = new Set();
    details.forEach(d => {
        const g = d.mmk_group;
        if (g) {
            const key = `CAT1: "${g.cat1}" | CAT2: "${g.cat2}" | CAT3: "${g.cat3}"`;
            if (!categories.has(key)) {
                console.log(key);
                console.log(`    Sample Title: ${d.title}`);
                categories.add(key);
            }
        }
    });

    console.log('\n=== GENDER ANALYSIS ===');
    const genders = new Map();
    details.forEach(d => {
        const g = d.gender; // 1, 2, 3
        if (!genders.has(g)) genders.set(g, 0);
        genders.set(g, genders.get(g) + 1);
    });
    console.log('Gender Counts (Raw IDs):', Object.fromEntries(genders));

    console.log('\n=== BENEFITS ANALYSIS (Info HTML) ===');
    details.forEach(d => {
        const info = d.info || '';
        const lower = info.toLowerCase();
        // Check for common benefit phrases
        const hasTibbiy = lower.includes('tibbiy ko');
        const hasModdiy = lower.includes('moddiy rag');
        const hasTransport = lower.includes('transport');

        if (hasTibbiy || hasModdiy || hasTransport) {
            console.log(`[ID ${d.id}] Found benefits in HTML:`);
            if (hasTibbiy) console.log('   - Tibbiy ko‘rik');
            if (hasModdiy) console.log('   - Moddiy rag‘batlantirish');
            if (hasTransport) console.log('   - Transport');
            console.log(`   - API benefit_ids: ${JSON.stringify(d.benefit_ids)}`);
            console.log(`   - HTML snippet: ${info.substring(0, 100)}...`);
            console.log('---');
        }
    });
}

analyze();
