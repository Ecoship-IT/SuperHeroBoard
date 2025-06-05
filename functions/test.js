const fetch = require('node-fetch');

async function checkOrder() {
  try {
    const response = await fetch('https://public-api.shiphero.com/graphql', {
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
                    shipments {
                      created_date
                    }
                    allocations {
                      ready_to_ship
                    }
                  }
                }
              }
            }
          }
        `
      })
    });

    const data = await response.json();
    console.log('Order status:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrder(); 