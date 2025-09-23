const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-2fb1a9326876.json';

async function forceEnableGmail() {
  console.log('🔧 Force enabling Gmail API...\n');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: [
        'https://www.googleapis.com/auth/serviceusage',
        'https://www.googleapis.com/auth/cloud-platform'
      ]
    });

    const authClient = await auth.getClient();
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    const credentials = require(SERVICE_ACCOUNT_FILE);
    
    console.log('📋 Project ID:', credentials.project_id);
    
    // Try to enable Gmail API
    console.log('\n📝 Attempting to enable Gmail API...');
    try {
      const result = await serviceUsage.services.enable({
        name: `projects/${credentials.project_id}/services/gmail.googleapis.com`
      });
      
      console.log('✅ Gmail API enable request sent!');
      console.log('📋 Response:', result.data.state);
      
    } catch (enableError) {
      console.log('❌ Could not enable Gmail API:', enableError.message);
      
      if (enableError.message.includes('already enabled')) {
        console.log('💡 Gmail API is already enabled but not showing up in the list');
      }
    }
    
    // Wait a moment and check again
    console.log('\n⏳ Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check enabled services again
    console.log('\n📝 Checking enabled services again...');
    try {
      const result = await serviceUsage.services.list({
        parent: `projects/${credentials.project_id}`,
        filter: 'state:ENABLED',
        pageSize: 10
      });
      
      console.log(`📋 Found ${result.data.services?.length || 0} enabled APIs`);
      
      // Look for Gmail API specifically
      const gmailAPI = result.data.services?.find(service => 
        service.name.includes('gmail.googleapis.com')
      );
      
      if (gmailAPI) {
        console.log('🎉 Gmail API is now enabled!');
        console.log('📋 State:', gmailAPI.state);
      } else {
        console.log('❌ Gmail API still not found');
        console.log('📋 Available APIs:');
        result.data.services?.forEach(service => {
          const apiName = service.name.split('/').pop();
          console.log(`   - ${apiName}`);
        });
      }
      
    } catch (listError) {
      console.log('❌ Could not list services:', listError.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceEnableGmail(); 