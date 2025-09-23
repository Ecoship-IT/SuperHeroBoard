// Simple test to search for ANY emails from Kristen's mailbox
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

async function testSimpleSearch() {
  try {
    console.log('🔍 Testing Simple Gmail Search for kristen@ecoship.com...');
    
    // Test with today's date but no business hours restriction
    console.log('\n📅 Testing TODAY (8/14/2025) - ALL DAY:');
    const resultToday = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'kristen@ecoship.com',
      date: '2025-08-14',
      allDay: true // This will be ignored by current function, but let's see what happens
    });
    
    if (resultToday.status !== 200) {
      console.error('❌ Today test failed:', resultToday.status);
      console.error('❌ Full error details:', JSON.stringify(resultToday.data, null, 2));
      return;
    }
    
    const dataToday = resultToday.data;
    if (dataToday.success) {
      console.log('✅ Today - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataToday.data.totalEmails}`);
      console.log(`   Business Hours: ${dataToday.data.businessHours || 'Not shown'}`);
    }
    
    // Let's also test with a different user to see if it's user-specific
    console.log('\n📅 Testing customerservice@higleyenterprises.com (which we know works):');
    const resultCustomerService = await makeRequest('https://us-central1-superheroboardv2.cloudfunctions.net/analyzeGmailResponseTimes', {
      userEmail: 'customerservice@higleyenterprises.com',
      date: '2025-08-14'
    });
    
    if (resultCustomerService.status !== 200) {
      console.error('❌ Customer service test failed:', resultCustomerService.status);
      console.error('❌ Full error details:', JSON.stringify(resultCustomerService.data, null, 2));
      return;
    }
    
    const dataCustomerService = resultCustomerService.data;
    if (dataCustomerService.success) {
      console.log('✅ Customer Service - Gmail Analysis Successful!');
      console.log(`   Total Emails: ${dataCustomerService.data.totalEmails}`);
      console.log(`   Business Hours: ${dataCustomerService.data.businessHours || 'Not shown'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSimpleSearch(); 