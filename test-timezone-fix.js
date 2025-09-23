// Test script to verify timezone fix
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
          console.log(`🔍 Raw response: ${responseData}`);
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (error) {
          console.error(`❌ Parse error: ${error.message}`);
          console.error(`❌ Raw response: ${responseData}`);
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

async function testTimezoneFix() {
  try {
    console.log('🧪 Testing Timezone Fix...');
    
    // Test with a specific date to see business hours calculation
    const testDate = '2025-08-19';
    console.log(`📅 Testing with date: ${testDate}`);
    
    const result = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: testDate
    });
    
    if (result.status !== 200) {
      console.error('❌ Test failed:', result.status);
      return;
    }
    
    const data = result.data;
    if (data.success) {
      console.log('✅ Test successful!');
      console.log(`📊 Date being analyzed: ${data.data.date}`);
      console.log(`📊 Total responses: ${data.data.totalResponses}`);
      
      // The key test: check if the date matches what we expect
      if (data.data.date === '8/19/2025') {
        console.log('✅ Timezone fix working! Date matches expected: 8/19/2025');
      } else {
        console.log('❌ Timezone issue still exists!');
        console.log(`   Expected: 8/19/2025`);
        console.log(`   Got: ${data.data.date}`);
      }
      
      // Additional debugging info
      console.log(`\n🔍 Debug Info:`);
      console.log(`   Input date: 2025-08-19`);
      console.log(`   Response date: ${data.data.date}`);
      console.log(`   Total responses: ${data.data.totalResponses}`);
      console.log(`   Response rate: ${data.data.responseRate}%`);
      console.log(`   Average response time: ${data.data.averageResponseTime} hours`);
    } else {
      console.error('❌ Function returned error:', data.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTimezoneFix(); 