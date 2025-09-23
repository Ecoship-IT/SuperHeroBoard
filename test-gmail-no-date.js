// Test script to search for emails WITHOUT date restrictions
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

async function testNoDate() {
  try {
    console.log('🔍 Testing Gmail Search WITHOUT Date Restrictions...');
    
    // Test with no date parameter to see if we can access emails at all
    console.log('\n📅 Testing with NO DATE (should default to today):');
    const result = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'customerservice@higleyenterprises.com'
      // No date parameter
    });
    
    if (result.status !== 200) {
      console.error('❌ Test failed:', result.status);
      console.error('❌ Full error details:', JSON.stringify(result.data, null, 2));
      return;
    }
    
    const data = result.data;
    if (data.success) {
      console.log('✅ Function Response:');
      console.log(`   Total Emails: ${data.data.totalEmails}`);
      console.log(`   Date: ${data.data.date}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testNoDate(); 