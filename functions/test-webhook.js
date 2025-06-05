const fetch = require('node-fetch');

async function testWebhook() {
  try {
    // Test data simulating a ShipHero webhook payload
    const webhookData = {
      webhook_type: 'Order Canceled',
      order_number: 'EFM-276599', // Using the actual order number you mentioned
      order_uuid: 'test-uuid',
      account_uuid: 'QWNjb3VudDo4NDg3Mg==', // Earth Fed Muscle account
      allocated_at: new Date().toISOString(),
      line_items: [
        { sku: 'TEST-SKU', quantity: 1 }
      ],
      ready_to_ship: 1
    };

    console.log('🔄 Sending test webhook:', webhookData);

    const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/shipHeroWebhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    const responseText = await response.text();
    console.log('📥 Response:', {
      status: response.status,
      text: responseText
    });

    // Wait a moment and then verify the order status
    await new Promise(resolve => setTimeout(resolve, 2000));

    const verifyResponse = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 3cedf16a-9d42-4ed4-9e6c-e8f850f3b2e3'
      },
      body: JSON.stringify({
        query: `
          query {
            orders(order_number: "EFM-276599") {
              data {
                edges {
                  node {
                    order_number
                    fulfillment_status
                    status
                  }
                }
              }
            }
          }
        `
      })
    });

    const verifyData = await verifyResponse.json();
    console.log('📋 Order status after webhook:', JSON.stringify(verifyData, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWebhook(); 