const { google } = require('googleapis');

// Use the Default compute service account instead
const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';
const IMPERSONATE_USER = 'kristen@ecoship.com';

async function testWithDefaultService() {
  console.log('🔧 Testing with Default compute service account...\n');
  
  try {
    console.log('📝 Step 1: Loading credentials...');
    const credentials = require(SERVICE_ACCOUNT_FILE);
    console.log('✅ Credentials loaded');
    console.log('📋 Service Account:', credentials.client_email);
    
    console.log('\n📝 Step 2: Testing Gmail API with domain-wide delegation...');
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      subject: IMPERSONATE_USER
    });

    const authClient = await auth.getClient();
    console.log('✅ Auth client created');
    
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    console.log('\n📧 Testing Gmail profile...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('🎉 SUCCESS! Email:', profile.data.emailAddress);
    
    console.log('\n📥 Testing message list...');
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 3
    });
    
    console.log(`✅ Found ${messages.data.messages?.length || 0} messages`);
    console.log('\n🎉 Gmail API is working with Default compute service account!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Precondition check failed')) {
      console.log('\n💡 Still getting precondition error - this confirms it\'s a domain-wide delegation issue');
      console.log('💡 The problem is in Google Workspace Admin Console, not the service account');
    }
  }
}

testWithDefaultService(); 