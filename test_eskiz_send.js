const ESKIZ_EMAIL = 'xasanjanov.x@gmail.com';
const ESKIZ_PASSWORD = 'V3yhmGbyobaBBwlZ4UD632tUp0oDZVdzI6AUheuH';

(async () => {
    console.log('STARTING SEND TEST');
    try {
        const params = new URLSearchParams();
        params.append('email', ESKIZ_EMAIL);
        params.append('password', ESKIZ_PASSWORD);

        console.log('Logging in...');
        const loginRes = await fetch('https://notify.eskiz.uz/api/auth/login', {
            method: 'POST',
            body: params,
        });
        const loginData = await loginRes.json();
        const token = loginData.data.token;
        console.log('Token:', token ? 'OK' : 'FAIL');

        if (token) {
            console.log('Sending SMS to 998900000000...');
            const formData = new FormData();
            formData.append('mobile_phone', '998900000000');
            formData.append('message', 'Test message from debugging');
            formData.append('from', '4546');

            const sendRes = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            console.log('Send Status:', sendRes.status);
            const sendText = await sendRes.text();
            console.log('Send Response:', sendText);

            // Try with URLSearchParams in case FormData fails for Send specifically
            console.log('\nSending SMS (URLSearchParams) to 998900000000...');
            const params2 = new URLSearchParams();
            params2.append('mobile_phone', '998900000000');
            params2.append('message', 'Test message URLSearchParams');
            params2.append('from', '4546');

            const sendRes2 = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: params2
            });
            console.log('Send Status 2:', sendRes2.status);
            const sendText2 = await sendRes2.text();
            console.log('Send Response 2:', sendText2);
        }

    } catch (e) {
        console.error('Error:', e);
    }
    console.log('DONE');
})();
