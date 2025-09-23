const { google } = require('googleapis');

async function testDifferentEndpoints() {
  console.log('🔍 Testing different Gmail API endpoints...\n');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './superheroboardv2-84db896e1c9c.json',
      scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      subject: 'it@ecoship.com'
    });

    const authClient = await auth.getClient();
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('✅ Gmail service created');

    // Test 1: Try labels endpoint (simpler)
    console.log('\n1️⃣ Testing labels endpoint...');
    try {
      const labels = await gmail.users.labels.list({ userId: 'me' });
      console.log('✅ SUCCESS! Labels endpoint works');
      console.log(`   Found ${labels.data.labels?.length || 0} labels`);
    } catch (error) {
      console.log('❌ Labels failed:', error.message);
    }

    // Test 2: Try threads endpoint
    console.log('\n2️⃣ Testing threads endpoint...');
    try {
      const threads = await gmail.users.threads.list({ 
        userId: 'me', 
        maxResults: 1 
      });
      console.log('✅ SUCCESS! Threads endpoint works');
      console.log(`   Found ${threads.data.threads?.length || 0} threads`);
    } catch (error) {
      console.log('❌ Threads failed:', error.message);
    }

    // Test 3: Try messages endpoint
    console.log('\n3️⃣ Testing messages endpoint...');
    try {
      const messages = await gmail.users.messages.list({ 
        userId: 'me', 
        maxResults: 1 
      });
      console.log('✅ SUCCESS! Messages endpoint works');
      console.log(`   Found ${messages.data.messages?.length || 0} messages`);
    } catch (error) {
      console.log('❌ Messages failed:', error.message);
    }

    // Test 4: Finally try profile (the one that's been failing)
    console.log('\n4️⃣ Testing profile endpoint...');
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ SUCCESS! Profile endpoint works');
      console.log(`   Email: ${profile.data.emailAddress}`);
    } catch (error) {
      console.log('❌ Profile failed:', error.message);
    }

  } catch (authError) {
    console.log('❌ Auth error:', authError.message);
  }
}

testDifferentEndpoints();