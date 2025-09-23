// Test script to run Kristen's Gmail analysis for today using the same logic as the scheduled function
const https = require('https');

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'us-central1-superheroboardv2.cloudfunctions.net',
      path: '/analyzeGmailResponseTimes',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testKristenToday() {
  try {
    console.log('🧪 Testing Kristen\'s Gmail Response Time for TODAY...');
    
    // Get today's date in YYYY-MM-DD format (Eastern timezone)
    const today = new Date();
    const easternDate = new Date(today.toLocaleString('en-US', {timeZone: 'America/New_York'}));
    const dateStr = easternDate.toISOString().split('T')[0];
    
    console.log(`📅 Testing date: ${dateStr}`);
    
    const result = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: dateStr
    });
    
    if (result.status !== 200) {
      console.error('❌ Test failed:', result.status);
      console.error('❌ Full error details:', JSON.stringify(result.data, null, 2));
      return;
    }
    
    const data = result.data;
    if (data.success) {
      console.log('✅ Gmail Analysis Successful!');
      console.log('📊 Results:');
      console.log(`   User: ${data.data.userEmail}`);
      console.log(`   Date: ${data.data.date}`);
      console.log(`   Total Responses: ${data.data.totalResponses}`);
      console.log(`   Responded Within 4 Hours: ${data.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${data.data.responseRate}%`);
      console.log(`   Average Response Time: ${data.data.averageResponseTime} hours`);
      
      // Show some email details if available
      if (data.data.details && data.data.details.length > 0) {
        console.log(`\n📧 Response Details (showing all ${data.data.details.length}):`);
        data.data.details.forEach((response, index) => {
          console.log(`   ${index + 1}. Subject: ${response.subject}`);
          console.log(`      Sent: ${new Date(response.sentTime).toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`      Raw ISO: ${response.sentTime}`);
          console.log(`      UTC: ${new Date(response.sentTime).toISOString()}`);
          console.log(`      EST: ${new Date(response.sentTime).toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`      Response Time: ${response.responseTimeHours?.toFixed(2)} hours`);
          console.log(`      Within 4 Hours: ${response.respondedWithin4Hours ? 'Yes' : 'No'}`);
          if (response.previousMessageTime) {
            console.log(`      Previous: ${new Date(response.previousMessageTime).toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          }
          if (response.effectiveMessageTime) {
            console.log(`      Effective: ${new Date(response.effectiveMessageTime).toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          }
          console.log('');
        });
      }
    } else {
      console.error('❌ Function returned error:', data.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testKristenToday(); 