const { google } = require('googleapis');

async function checkProjectAPIs() {
  try {
    console.log('🔍 Checking which project Gmail API is enabled for...\n');
    
    const serviceAccount = require('./superheroboardv2-84db896e1c9c.json');
    console.log('📋 Service Account Details:');
    console.log('   Project ID:', serviceAccount.project_id);
    console.log('   Project Number:', serviceAccount.project_number);
    console.log('   Client ID:', serviceAccount.client_id);
    
    // Test direct API call without domain delegation
    console.log('\n🧪 Testing direct Gmail API call (no impersonation)...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: './superheroboardv2-84db896e1c9c.json',
      scopes: ['https://www.googleapis.com/auth/gmail.modify']
      // NO subject - just service account
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });
    
    try {
      // This should fail, but the ERROR will tell us if API is enabled
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('   😱 Unexpected success:', profile.data);
      
    } catch (directError) {
      console.log('   Expected error:', directError.message);
      
      if (directError.message.includes('Gmail API has not been used')) {
        console.log('\n❌ FOUND THE PROBLEM!');
        console.log('   Gmail API is NOT enabled for project:', serviceAccount.project_id);
        console.log('\n🔧 Fix: Go to Google Cloud Console');
        console.log('   1. Make sure you\'re in project "superheroboardv2"');
        console.log('   2. Go to APIs & Services > Library');
        console.log('   3. Search "Gmail API" and ENABLE it');
        
      } else if (directError.message.includes('insufficient authentication')) {
        console.log('\n✅ Gmail API is enabled for this project');
        console.log('   The issue is definitely domain delegation setup');
        
      } else if (directError.message.includes('Precondition check failed')) {
        console.log('\n🤔 Same precondition error even without impersonation');
        console.log('   This could be a project/API configuration issue');
        
      } else {
        console.log('\n🤷‍♂️ Different error - this might be helpful info');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProjectAPIs();