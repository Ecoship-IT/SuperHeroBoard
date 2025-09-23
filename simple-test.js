const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-2fb1a9326876.json';

async function simpleTest() {
  console.log('🔍 Simple test...\n');
  
  try {
    console.log('📝 Step 1: Loading credentials...');
    const credentials = require(SERVICE_ACCOUNT_FILE);
    console.log('✅ Credentials loaded');
    console.log('📋 Project ID:', credentials.project_id);
    
    console.log('\n📝 Step 2: Creating auth client...');
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/serviceusage']
    });

    const authClient = await auth.getClient();
    console.log('✅ Auth client created');
    
    console.log('\n📝 Step 3: Testing simple API call...');
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    
    const result = await serviceUsage.services.list({
      parent: `projects/${credentials.project_id}`,
      filter: 'state:ENABLED',
      pageSize: 3
    });
    
    console.log('✅ API call successful!');
    console.log(`📋 Found ${result.data.services?.length || 0} enabled APIs`);
    
    if (result.data.services && result.data.services.length > 0) {
      console.log('📋 First few APIs:');
      result.data.services.forEach((service, index) => {
        const apiName = service.name.split('/').pop();
        console.log(`   ${index + 1}. ${apiName}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Full error:', error);
  }
}

simpleTest(); 