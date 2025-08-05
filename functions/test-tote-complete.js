const fetch = require('node-fetch');

const testToteComplete = async () => {
  const webhookUrl = 'https://us-central1-superheroboardv2.cloudfunctions.net/shipHeroWebhook';
  
  const testData = {
    "webhook_type": "Tote Complete",
    "totes": [
      {
        "tote_name": "Test-Tote-123",
        "tote_uuid": "VGVzdFRvdGUxMjM=",
        "tote_barcode": "123456789",
        "orders": [
          {
            "order_number": "TEST001",
            "gift_note": "",
            "items": [
              {
                "quantity": 1,
                "sku": "TEST-SKU-1",
                "weight": "0.0500 oz",
                "height": "1.00 in",
                "width": "1.00 in",
                "length": "1.00 in"
              }
            ]
          },
          {
            "order_number": "TEST002",
            "gift_note": "",
            "items": [
              {
                "quantity": 2,
                "sku": "TEST-SKU-2",
                "weight": "0.1000 oz",
                "height": "2.00 in",
                "width": "2.00 in",
                "length": "2.00 in"
              }
            ]
          }
        ]
      }
    ],
    "batch_id": "test_batch_" + Date.now()
  };

  try {
    console.log('🧪 Testing Tote Complete webhook...');
    console.log('📤 Sending test data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const responseText = await response.text();
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Test successful! Tote Complete webhook is working.');
    } else {
      console.log('❌ Test failed. Check the function logs.');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

testToteComplete(); 