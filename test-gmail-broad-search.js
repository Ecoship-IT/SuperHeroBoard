// Test script to search for emails over a broader date range
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

async function testBroadSearch() {
  try {
    console.log('🔍 Testing Gmail Search Over Broader Date Range for kristen@ecoship.com...');
    
    // Test with last week's date
    console.log('\n📅 Testing with LAST WEEK (8/7/2025):');
    const resultLastWeek = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-08-07'
    });
    
    // Test with last month's date
    console.log('\n📅 Testing with LAST MONTH (7/14/2025):');
    const resultLastMonth = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-07-14'
    });
    
    // Process last week's result
    if (resultLastWeek.status !== 200) {
      console.error('❌ Last week test failed:', resultLastWeek.status);
      console.error('❌ Full error details:', JSON.stringify(resultLastWeek.data, null, 2));
      return;
    }
    
    const dataLastWeek = resultLastWeek.data;
    if (dataLastWeek.success) {
      console.log('✅ Last Week - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataLastWeek.data.totalEmails}`);
      console.log(`   Responded Within 4 Hours: ${dataLastWeek.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${dataLastWeek.data.responseRate}%`);
    }
    
    // Process last month's result
    if (resultLastMonth.status !== 200) {
      console.error('❌ Last month test failed:', resultLastMonth.status);
      console.error('❌ Full error details:', JSON.stringify(resultLastMonth.data, null, 2));
      return;
    }
    
    const dataLastMonth = resultLastMonth.data;
    if (dataLastMonth.success) {
      console.log('✅ Last Month - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataLastMonth.data.totalEmails}`);
      console.log(`   Responded Within 4 Hours: ${dataLastMonth.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${dataLastMonth.data.responseRate}%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBroadSearch(); 