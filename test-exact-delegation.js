const { google } = require('googleapis');

async function testExactDelegation() {
  console.log('🎯 Testing EXACT domain delegation setup...\n');
  
  const CLIENT_ID = '117706433447438028506';
  const EXACT_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
  const TEST_USER = 'it@ecoship.com';
  
  console.log('📋 Configuration to verify in Google Admin Console:');
  console.log(`   Client ID: ${CLIENT_ID}`);
  console.log(`   OAuth Scopes: ${EXACT_SCOPE}`);
  console.log(`   Test User: ${TEST_USER}`);
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './superheroboardv2-84db896e1c9c.json',
      scopes: [EXACT_SCOPE],
      subject: TEST_USER
    });

    const authClient = await auth.getClient();
    
    // Get the actual token to see what's happening
    console.log('\n🔍 Getting access token details...');
    const tokenResponse = await authClient.getAccessToken();
    
    if (tokenResponse.token) {
      console.log('✅ Access token obtained successfully');
      
      // Decode the token to see claims (basic info)
      const tokenParts = tokenResponse.token.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('🔍 Token claims:');
          console.log('   Subject (sub):', payload.sub);
          console.log('   Scope:', payload.scope);
          console.log('   Audience (aud):', payload.aud);
        } catch (e) {
          console.log('⚠️  Could not decode token (normal for some token types)');
        }
      }
    }
    
    // Now try the Gmail call with detailed error info
    console.log('\n📧 Attempting Gmail API call...');
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('🎉 SUCCESS! Profile:', profile.data.emailAddress);
      
    } catch (gmailError) {
      console.log('❌ Gmail API Error Details:');
      console.log('   Status:', gmailError.status);
      console.log('   Code:', gmailError.code);
      console.log('   Message:', gmailError.message);
      
      if (gmailError.response && gmailError.response.data) {
        console.log('   Full Error:', JSON.stringify(gmailError.response.data, null, 2));
      }
      
      // Specific troubleshooting
      if (gmailError.status === 400 && gmailError.message.includes('Precondition check failed')) {
        console.log('\n💡 TROUBLESHOOTING STEPS:');
        console.log('1. Double-check domain delegation in Google Admin Console');
        console.log('2. Make sure the scope is EXACTLY: https://www.googleapis.com/auth/gmail.modify');
        console.log('3. Verify you clicked "Authorize" after making changes');
        console.log('4. Try removing and re-adding the delegation entry');
        console.log('5. Make sure it@ecoship.com is a valid Google Workspace user');
      }
    }
    
  } catch (authError) {
    console.log('❌ Authentication Error:', authError.message);
  }
}

testExactDelegation();