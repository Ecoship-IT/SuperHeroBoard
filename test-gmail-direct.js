// Test Gmail API directly using the same authentication as the Firebase Function
const { google } = require('googleapis');
const fs = require('fs');

async function testGmailDirect() {
  try {
    console.log('🔍 Testing Gmail API Directly...');
    
    // Read the service account key file
    const keyFile = JSON.parse(fs.readFileSync('./superheroboardv2-22da6951042a.json', 'utf8'));
    
    console.log('🔑 Service Account Email:', keyFile.client_email);
    
    // Test with customerservice@higleyenterprises.com (which we know works)
    const userEmail = 'customerservice@higleyenterprises.com';
    
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly'
      ],
      subject: userEmail
    });
    
    console.log('🔐 Authenticating...');
    await auth.authorize();
    console.log('✅ Authentication successful!');
    
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Test 1: Simple search - get any emails
    console.log('\n🔍 Test 1: Simple search (no date filter)');
    const simpleResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10
    });
    
    console.log('📧 Simple Search Results:');
    console.log(`   Total: ${simpleResponse.data.resultSizeEstimate || 0}`);
    if (simpleResponse.data.messages) {
      console.log(`   Messages found: ${simpleResponse.data.messages.length}`);
      console.log(`   First message ID: ${simpleResponse.data.messages[0]?.id}`);
    }
    
    // Test 2: Date-restricted search
    console.log('\n🔍 Test 2: Date-restricted search');
    const startTime = new Date('2025-08-14T12:00:00.000Z'); // 8 AM Eastern
    const endTime = new Date('2025-08-14T19:00:00.000Z');   // 3 PM Eastern
    
    const query = `after:${startTime.toISOString()} before:${endTime.toISOString()}`;
    console.log(`🔍 Search Query: "${query}"`);
    
    const dateResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 10
    });
    
    console.log('📧 Date Search Results:');
    console.log(`   Total: ${dateResponse.data.resultSizeEstimate || 0}`);
    if (dateResponse.data.messages) {
      console.log(`   Messages found: ${dateResponse.data.messages.length}`);
    }
    
    // Test 3: Different date format
    console.log('\n🔍 Test 3: Different date format (YYYY/MM/DD)');
    const query2 = `after:2025/08/14 before:2025/08/15`;
    console.log(`🔍 Search Query: "${query2}"`);
    
    const dateResponse2 = await gmail.users.messages.list({
      userId: 'me',
      q: query2,
      maxResults: 10
    });
    
    console.log('📧 Alternative Date Format Results:');
    console.log(`   Total: ${dateResponse2.data.resultSizeEstimate || 0}`);
    if (dateResponse2.data.messages) {
      console.log(`   Messages found: ${dateResponse2.data.messages.length}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }
  }
}

// Run the test
testGmailDirect(); 