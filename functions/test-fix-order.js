const fetch = require('node-fetch');

async function testFixOrder() {
  try {
    console.log('🔧 Testing fixOrder function for EFM-278319...');
    
    const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/fixOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderNumber: 'EFM-278319'
      })
    });

    const result = await response.json();
    console.log('📋 Fix result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Order has been fixed successfully!');
      console.log(`   Old Status: ${result.oldStatus}`);
      console.log(`   New Status: ${result.newStatus}`);
    } else {
      console.log('❌ Failed to fix order:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing fix function:', error);
  }
}

testFixOrder(); 