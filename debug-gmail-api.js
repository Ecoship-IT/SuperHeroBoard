const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';
const IMPERSONATE_USER = 'kristen@ecoship.com';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function debugGmailAPI() {
  try {
    console.log('🔍 Debug Step 1: Testing authentication...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
      subject: IMPERSONATE_USER
    });

    const authClient = await auth.getClient();
    console.log('✅ Auth client created successfully');

    // Test 1: Try to get access token
    console.log('\n🔍 Debug Step 2: Getting access token...');
    const accessToken = await authClient.getAccessToken();
    console.log('✅ Access token obtained:', accessToken.token ? 'SUCCESS' : 'FAILED');

    // Test 2: Try Gmail service creation
    console.log('\n🔍 Debug Step 3: Creating Gmail service...');
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    console.log('✅ Gmail service created');

    // Test 3: Simple profile call with more error detail
    console.log('\n🔍 Debug Step 4: Testing profile access...');
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ SUCCESS! Email:', profile.data.emailAddress);
    } catch (profileError) {
      console.error('❌ Profile Error Details:');
      console.error('Status:', profileError.status);
      console.error('Code:', profileError.code);
      console.error('Message:', profileError.message);
      console.error('Full Error:', JSON.stringify(profileError, null, 2));
    }

  } catch (error) {
    console.error('❌ Authentication Error:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test with different user too
async function testDifferentUser() {
  console.log('\n\n🔍 Testing with different user...');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
      subject: 'customerservice@higleyenterprises.com' // Try original user
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ SUCCESS with customerservice@higleyenterprises.com:', profile.data.emailAddress);
    
  } catch (error) {
    console.error('❌ Failed with customerservice@higleyenterprises.com:', error.message);
  }
}

console.log('🚀 Starting detailed debug...\n');
debugGmailAPI().then(() => testDifferentUser());