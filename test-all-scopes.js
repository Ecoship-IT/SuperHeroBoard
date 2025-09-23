const { google } = require('googleapis');

async function testAllScopes() {
  console.log('🔍 Testing with comprehensive Gmail scopes...\n');
  
  // Try the most comprehensive Gmail scope combination
  const COMPREHENSIVE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.settings.basic',
    'https://www.googleapis.com/auth/gmail.settings.sharing'
  ];
  
  console.log('📋 COPY THIS EXACT SCOPE STRING TO GOOGLE ADMIN:');
  console.log(COMPREHENSIVE_SCOPES.join(','));
  console.log('\n');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './superheroboardv2-84db896e1c9c.json',
      scopes: COMPREHENSIVE_SCOPES,
      subject: 'customerservice@higleyenterprises.com'
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('✅ Auth successful with comprehensive scopes');

    // Test simple call
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('🎉 SUCCESS! Gmail API is working!');
    console.log('📧 Email:', profile.data.emailAddress);
    
  } catch (error) {
    console.log('❌ Still failed with comprehensive scopes:', error.message);
    
    console.log('\n🤔 At this point, if you\'ve tried:');
    console.log('   ✅ Removed and re-added domain delegation');
    console.log('   ✅ Used comprehensive scopes');
    console.log('   ✅ Verified you\'re Super Admin');
    console.log('   ✅ Verified Gmail API is enabled');
    console.log('   ✅ Verified user exists and has Gmail');
    console.log('\n💡 This might be a Google Workspace admin setting issue.');
    console.log('   Check: Admin Console > Security > API Controls > App access control');
    console.log('   Make sure "Trust internal apps" is enabled or Gmail API is explicitly allowed.');
  }
}

testAllScopes();