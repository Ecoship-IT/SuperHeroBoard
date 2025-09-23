// Test script to manually test the scheduled function logic
const https = require('https');

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'us-central1-superheroboardv2.cloudfunctions.net',
      path: '/collectDailyGmailResponseTime',
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

async function testScheduledFunction() {
  try {
    console.log('🧪 Testing Scheduled Function Logic...');
    
    // Test with yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    console.log(`📅 Testing with yesterday's date: ${dateStr}`);
    
    const result = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/collectDailyGmailResponseTime', {
      // Scheduled functions typically don't take POST data, but let's test the endpoint
    });
    
    if (result.status !== 200) {
      console.error('❌ Test failed:', result.status);
      return;
    }
    
    const data = result.data;
    console.log('✅ Test successful!');
    console.log(`📊 Response:`, JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testScheduledFunction(); 