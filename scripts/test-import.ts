/**
 * Test script to diagnose import issues
 * Run: npx tsx scripts/test-import.ts
 */

async function testOsonish() {
    console.log('\n=== Testing OSONISH.UZ ===\n');

    const url = 'https://osonish.uz/api/api/v1/vacancies?page=1&per_page=5&status=2';
    console.log('URL:', url);

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'ru,en-US;q=0.9,en;q=0.8,uz;q=0.7',
                'Referer': 'https://osonish.uz/vacancies',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        });

        console.log('Status:', response.status);

        if (!response.ok) {
            console.log('Error body:', await response.text());
            return;
        }

        const data = await response.json();
        console.log('Total vacancies:', data.data?.total);
        console.log('Sample items:', data.data?.data?.length);

        if (data.data?.data?.[0]) {
            console.log('\nFirst vacancy:');
            console.log('- ID:', data.data.data[0].id);
            console.log('- Title:', data.data.data[0].title);
            console.log('- Status:', data.data.data[0].status);
        }
    } catch (err) {
        console.error('Osonish error:', err);
    }
}

async function main() {
    await testOsonish();
    console.log('\n=== DONE ===');
}

main();

