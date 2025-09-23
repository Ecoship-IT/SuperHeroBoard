const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';
const IMPERSONATE_USER = 'it@ecoship.com';

// Try the broader Gmail scope
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

async function testBroaderScope() {
  try {
    console.log('🚀 Testing with BROADER Gmail scope...');
    console.log('   Scope: https://www.googleapis.com/auth/gmail.modify');
    console.log('   User:', IMPERSONATE_USER);
    
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: SCOPES,
      subject: IMPERSONATE_USER
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('✅ Authentication successful!');

    // Test Gmail profile
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ SUCCESS! Email:', profile.data.emailAddress);
    
    // Test message list
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1
    });
    
    console.log('✅ SUCCESS! Found', listResponse.data.messages?.length || 0, 'messages');
    
    console.log('\n🎉 Gmail API is working with the broader scope!');
    console.log('💡 You may need to update your domain delegation to use:');
    console.log('   https://www.googleapis.com/auth/gmail.modify');
    
  } catch (error) {
    console.error('❌ Still failed with broader scope:', error.message);
    
    if (error.status === 403) {
      console.log('\n💡 403 = Domain delegation issue for sure');
      console.log('   The scope in Admin Console needs to match exactly');
    }
  }
}

testBroaderScope();