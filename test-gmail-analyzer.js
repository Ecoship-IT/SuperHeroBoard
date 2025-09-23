// Test script for the deployed Gmail Response Time Analyzer function
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

async function testGmailAnalyzer() {
  try {
    console.log('🧪 Testing Gmail Response Time Analyzer for kristen@ecoship.com...');
    
    // Test with today's date
    console.log('\n📅 Testing with TODAY (8/14/2025):');
    const resultToday = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-08-14'
    });
    
    // Test with yesterday's date
    console.log('\n📅 Testing with YESTERDAY (8/13/2025):');
    const resultYesterday = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-08-13'
    });
    
    // Process today's result
    if (resultToday.status !== 200) {
      console.error('❌ Today test failed:', resultToday.status);
      console.error('❌ Full error details:', JSON.stringify(resultToday.data, null, 2));
      return;
    }
    
    const dataToday = resultToday.data;
    if (dataToday.success) {
      console.log('✅ Today - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataToday.data.totalEmails}`);
      console.log(`   Responded Within 4 Hours: ${dataToday.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${dataToday.data.responseRate}%`);
    }
    
    // Process yesterday's result
    if (resultYesterday.status !== 200) {
      console.error('❌ Yesterday test failed:', resultYesterday.status);
      console.error('❌ Full error details:', JSON.stringify(resultYesterday.data, null, 2));
      return;
    }
    
    const dataYesterday = resultYesterday.data;
    if (dataYesterday.success) {
      console.log('✅ Yesterday - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataYesterday.data.totalEmails}`);
      console.log(`   Responded Within 4 Hours: ${dataYesterday.data.respondedWithin4Hours}`);
      console.log(`   Response Rate: ${dataYesterday.data.responseRate}%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testGmailAnalyzer(); 