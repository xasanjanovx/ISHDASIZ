const ESKIZ_EMAIL = 'xasanjanov.x@gmail.com';
const ESKIZ_PASSWORD = 'V3yhmGbyobaBBwlZ4UD632tUp0oDZVdzI6AUheuH';

(async () => {
    console.log('STARTING SCRIPT');
    try {
        // Method 1: URLSearchParams
        console.log('Testing with URLSearchParams...');
        const params = new URLSearchParams();
        params.append('email', ESKIZ_EMAIL);
        params.append('password', ESKIZ_PASSWORD);

        const res1 = await fetch('https://notify.eskiz.uz/api/auth/login', {
            method: 'POST',
            body: params,
        });

        console.log('Status (URLSearchParams):', res1.status);
        const text1 = await res1.text();
        console.log('Body (URLSearchParams):', text1);

        // Method 2: FormData
        console.log('\nTesting with FormData...');
        const formData = new FormData();
        formData.append('email', ESKIZ_EMAIL);
        formData.append('password', ESKIZ_PASSWORD);

        const res2 = await fetch('https://notify.eskiz.uz/api/auth/login', {
            method: 'POST',
            body: formData,
        });

        console.log('Status (FormData):', res2.status);
        const text2 = await res2.text();
        console.log('Body (FormData):', text2);

    } catch (e) {
        console.error('Error:', e);
    }
    console.log('DONE');
})();
