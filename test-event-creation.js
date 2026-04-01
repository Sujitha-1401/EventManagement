// Test script to create an event
const API_URL = 'http://localhost:5000/api';

async function makeRequest(method, endpoint, body = null, token = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(`Network error: ${error.message}`);
        }
        throw error;
    }
}

async function testEventCreation() {
    try {
        console.log('Starting event creation test...\n');

        // Step 1: Login as admin to get token
        console.log('1. Logging in as admin...');
        const loginData = await makeRequest('POST', '/auth/login', {
            email: 'admin@campus.com',
            password: 'admin123'
        });

        const token = loginData.token;
        console.log('✅ Login successful');
        console.log(`Token: ${token.substring(0, 20)}...\n`);

        // Step 2: Get available venues
        console.log('2. Fetching available venues...');
        const venues = await makeRequest('GET', '/venues', null, token);

        console.log(`✅ Found ${venues.length} venues`);
        console.log(`Venues: ${venues.map(v => v.name).join(', ')}\n`);

        // Step 3: Create event
        console.log('3. Creating event "Red Hat"...');

        // Use random future date within 30 days
        const randomDays = Math.floor(Math.random() * 30) + 1;
        const eventDate = new Date();
        eventDate.setDate(eventDate.getDate() + randomDays);
        const dateStr = eventDate.toISOString().split('T')[0];

        // Random time between 9:00 and 17:00
        const randomHour = Math.floor(Math.random() * 8) + 9;
        const randomMinute = Math.random() > 0.5 ? '00' : '30';
        const startTime = `${String(randomHour).padStart(2, '0')}:${randomMinute}`;
        
        // End time is 2 hours later
        const endHour = randomHour + 2;
        const endTime = `${String(endHour).padStart(2, '0')}:${randomMinute}`;

        console.log(`Event Date: ${dateStr}`);
        console.log(`Start Time: ${startTime}`);
        console.log(`End Time: ${endTime}\n`);

        const eventData = {
            title: 'red hat',
            description: 'Testing event creation for Red Hat workshop',
            date: dateStr,
            time: startTime,
            endTime: endTime,
            location: venues[0].name, // Use first available venue
            capacity: 100,
            category: 'Workshop'
        };

        console.log('Event Data:', JSON.stringify(eventData, null, 2), '\n');

        const event = await makeRequest('POST', '/events', eventData, token);

        console.log('✅ Event created successfully!\n');
        console.log('Event Details:');
        console.log(JSON.stringify(event, null, 2));

        return event;
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testEventCreation().then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
});
