// Test ShipHero API connection
// Run this with: node test-shiphero-connection.js

const fetch = require('node-fetch').default;

async function testShipHeroConnection() {
  const apiToken = process.env.VITE_SHIPHERO_API_TOKEN || 'your_token_here';
  
  if (apiToken === 'your_token_here') {
    console.log('❌ Please set VITE_SHIPHERO_API_TOKEN environment variable');
    return;
  }

  try {
    console.log('🔍 Testing ShipHero API connection...');
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        query: `
          query {
            orders {
              data {
                edges {
                  node {
                    order_number
                    fulfillment_status
                  }
                }
              }
            }
          }
        `
      })
    });

    console.log(`📥 Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors);
      return;
    }

    console.log('✅ ShipHero API connection successful!');
    console.log('📦 Sample order data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testShipHeroConnection();
