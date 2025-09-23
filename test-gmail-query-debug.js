// Debug script to see the exact Gmail search query being generated
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

async function testQueryDebug() {
  try {
    console.log('🔍 Debugging Gmail Search Query...');
    
    // Test with a simple date to see the query
    console.log('\n📅 Testing with simple date (8/14/2025):');
    const result = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-08-14'
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
      console.log(`   Responded Within 4 Hours: ${data.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${data.data.responseRate}%`);
      console.log(`   Average Response Time: ${data.data.averageResponseTime} hours`);
      
      // Check if we can see the search query in the response
      if (data.data.searchQuery) {
        console.log(`   Search Query: ${data.data.searchQuery}`);
      }
      
      // Check if we can see the business hours
      if (data.data.businessHours) {
        console.log(`   Business Hours: ${data.data.businessHours}`);
      }
      
      // Check if we can see the start/end times
      if (data.data.startTime && data.data.endTime) {
        console.log(`   Start Time: ${data.data.startTime}`);
        console.log(`   End Time: ${data.data.endTime}`);
      }
      
      // Show some email details if available
      if (data.data.details && data.data.details.length > 0) {
        console.log(`\n📧 Email Details (showing first 3):`);
        data.data.details.slice(0, 3).forEach((email, index) => {
          console.log(`   ${index + 1}. From: ${email.from}`);
          console.log(`      Subject: ${email.subject}`);
          console.log(`      Responded: ${email.responded ? 'Yes' : 'No'}`);
          if (email.responded) {
            console.log(`      Response Time: ${email.responseTimeHours?.toFixed(2)} hours`);
            console.log(`      Within 4 Hours: ${email.respondedWithin4Hours ? 'Yes' : 'No'}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testQueryDebug(); 