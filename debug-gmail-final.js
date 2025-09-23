const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-2fb1a9326876.json';

async function debugGmailFinal() {
  console.log('🔍 Final Gmail API Debug...\n');
  
  try {
    // Test 1: Basic auth with broader scopes
    console.log('📝 Test 1: Testing with broader scopes...');
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/serviceusage'
      ],
      subject: 'it@ecoship.com'
    });

    const authClient = await auth.getClient();
    console.log('✅ Auth client created successfully');
    
    // Test 2: Try to get access token
    const tokenResponse = await authClient.getAccessToken();
    console.log('✅ Access token obtained:', tokenResponse.token ? 'SUCCESS' : 'FAILED');
    
    // Test 3: Try Gmail API
    console.log('\n📝 Test 2: Testing Gmail API...');
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('🎉 SUCCESS! Email:', profile.data.emailAddress);
      return true;
    } catch (gmailError) {
      console.log('❌ Gmail API Error:');
      console.log('   Status:', gmailError.status);
      console.log('   Code:', gmailError.code);
      console.log('   Message:', gmailError.message);
      
      if (gmailError.message.includes('Precondition check failed')) {
        console.log('\n💡 Precondition check failed usually means:');
        console.log('   1. User account issues (Gmail not enabled for user)');
        console.log('   2. Domain-wide delegation not properly configured');
        console.log('   3. API restrictions in Google Workspace Admin');
        
        console.log('\n🔧 Try these fixes:');
        console.log('   1. Check if it@ecoship.com has Gmail enabled in Google Workspace Admin');
        console.log('   2. Verify domain-wide delegation in Google Workspace Admin Console');
        console.log('   3. Check API restrictions in Google Workspace Admin > Security > API Controls');
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Auth Error:', error.message);
    return false;
  }
}

debugGmailFinal(); 