
const url = 'https://osonish.uz/api/api/v1/system-configs';
const headers = {
    'Accept': 'application/json',
    'Accept-Language': 'ru,en-US;q=0.9,en;q=0.8,uz;q=0.7',
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vb3NvbmlzaC51ei9hcGkvYXBpL3YxL3Bob25lL2NvbmZpcm0tc21zIiwiaWF0IjoxNzY5NTA4MTI0LCJleHAiOjE3Njk1NTEzMjQsIm5iZiI6MTc2OTUwODEyNCwianRpIjoiMjRqOGVGZnI1aFBDNmZIdSIsInN1YiI6IjEwMDk1IiwicHJ2IjoiMjNiZDVjODk0OWY2MDBhZGIzOWU3MDFjNDAwODcyZGI3YTU5NzZmNyJ9.YTus9wNyUY4rVOT2cI3t2igXgluFUWTRB1hFKGb34mw',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    'x-current-user-id': '10095'
};

async function fetchConfigs() {
    try {
        console.log('Fetching system configs...');
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Body:', text);
            return;
        }
        const json = await response.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

fetchConfigs();
