const { google } = require('googleapis');

const SERVICE_ACCOUNT_FILE = './superheroboardv2-84db896e1c9c.json';

async function checkEnabledAPIs() {
  try {
    console.log('🔍 Checking enabled APIs...');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/cloud-platform.read-only']
    });

    const authClient = await auth.getClient();
    const serviceUsage = google.serviceusage({ version: 'v1', auth: authClient });
    
    // Get project ID from service account
    const serviceAccount = require('./superheroboardv2-84db896e1c9c.json');
    const projectId = serviceAccount.project_id;
    
    console.log(`📋 Project: ${projectId}`);
    
    // Check Gmail API specifically
    try {
      const gmailService = await serviceUsage.services.get({
        name: `projects/${projectId}/services/gmail.googleapis.com`
      });
      
      console.log('📧 Gmail API Status:', gmailService.data.state);
      
    } catch (error) {
      console.log('❌ Gmail API not found or not enabled');
    }
    
  } catch (error) {
    console.error('❌ Error checking APIs:', error.message);
    console.log('\n💡 Manual check required - go to Google Cloud Console');
  }
}

checkEnabledAPIs();