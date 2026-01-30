
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Copy of normalization functions from route.ts
const GEO_FIXES: Record<string, string> = {
    'shaxrisabz': 'shahrisabz',
    // ... (abbreviated for test)
};

const GEO_ALIASES: Record<string, string> = {
    'tashkent': 'toshkent',
    // ...
};

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyReplaceMap(value: string, map: Record<string, string>): string {
    let updated = value;
    for (const [from, to] of Object.entries(map)) {
        const pattern = new RegExp(`(^|\\s)${escapeRegExp(from)}(?=\\s|$)`, 'g');
        updated = updated.replace(pattern, `$1${to}`);
    }
    return updated;
}

function normalizeGeoName(value: string): string {
    if (!value) return '';
    let text = value.toLowerCase().trim();

    text = text
        .replace(/\bsh\.\b/g, 'shahri')
        .replace(/\bvil\.\b/g, 'viloyati')
        .replace(/\bvil\b/g, 'viloyati')
        .replace(/р-?н/g, 'район');

    text = text
        .replace(/[\u2018\u2019\u00B4\u02BB\u02BC]/g, "'")
        .replace(/['"]/g, '')
        .replace(/[^0-9a-z\u0400-\u04FF]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    text = applyReplaceMap(text, GEO_FIXES);
    text = applyReplaceMap(text, GEO_ALIASES);
    return text;
}

function stripGeoTypeTokens(value: string): string {
    return value
        .replace(/(^|\s)(shahri|shahar|gorod|город|city|tuman|tumani|rayon|район|viloyat|viloyati|oblast|область|respublika|respublikasi|republic|республика)(?=\s|$)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

async function debugLookup() {
    console.log('Loading regions from DB...');
    const { data: regions } = await supabaseAdmin.from('regions').select('*');
    if (!regions) { console.log('No regions found'); return; }

    console.log(`Loaded ${regions.length} regions.`);

    const needle = "Namangan viloyati";
    const needleNorm = normalizeGeoName(needle);
    const needleLoose = stripGeoTypeTokens(needleNorm);

    console.log(`Needle: "${needle}"`);
    console.log(`Norm: "${needleNorm}"`);
    console.log(`Loose: "${needleLoose}"`);

    console.log('\nChecking matches:');
    for (const r of regions) {
        const rNorm = normalizeGeoName(r.name_uz);
        const rLoose = stripGeoTypeTokens(rNorm);

        const matchFull = rNorm.includes(needleNorm);
        const matchLoose = rLoose === needleLoose;

        if (matchFull || matchLoose) {
            console.log(`MATCH FOUND: ID=${r.id}, Name=${r.name_uz}`);
            console.log(`  Region Norm: "${rNorm}"`);
            console.log(`  Region Loose: "${rLoose}"`);
        } else if (r.name_uz.toLowerCase().includes('namangan')) {
            console.log(`NEAR MISS: ID=${r.id}, Name=${r.name_uz}`);
            console.log(`  Region Norm: "${rNorm}"`);
            console.log(`  Region Loose: "${rLoose}"`);
        }
    }
}

debugLookup();
