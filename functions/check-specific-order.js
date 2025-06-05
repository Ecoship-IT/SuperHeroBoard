const fetch = require('node-fetch');

async function checkSpecificOrder() {
  try {
    console.log('🔍 Checking order EFM-278319 in ShipHero...');
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJUQXlOVU13T0Rrd09ETXhSVVZDUXpBNU5rSkVOVVUxUmtNeU1URTRNMEkzTWpnd05ERkdNdyJ9.eyJodHRwOi8vc2hpcGhlcm8tcHVibGljLWFwaS91c2VyaW5mbyI6eyJhY2NvdW50X2lkIjo4MzE4MiwiY2xpZW50X25hbWUiOiJTaGlwaGVybyBQdWJsaWMgQVBJIEdhdGV3YXkiLCJkYXRhIjp7fSwiZW1haWwiOiJpdEBlY29zaGlwLmNvbSIsImZpcnN0X25hbWUiOiJFY29TaGlwICIsImlkIjoibXRjYndxSTJyNjEzRGNPTjNEYlVhSExxUXpRNGRraG4iLCJsYXN0X25hbWUiOiJJVCIsIm5hbWUiOiJFY29TaGlwICBJVCIsIm5pY2tuYW1lIjoiaXQiLCJvcmlnaW5fYXBwIjoidW5rbm93biIsInBpY3R1cmUiOiJodHRwczovL3MuZ3JhdmF0YXIuY29tL2F2YXRhci8xZGFiNDNiY2JmZTZmMjE2M2E1ZGJkMjYzYjFiMmYxNT9zPTQ4MCZyPXBnJmQ9aHR0cHMlM0ElMkYlMkZjZG4uYXV0aDAuY29tJTJGYXZhdGFycyUyRmVpLnBuZyJ9LCJpc3MiOiJodHRwczovL2xvZ2luLnNoaXBoZXJvLmNvbS8iLCJzdWIiOiJhdXRoMHw2Nzc3ZGZiMTU3ZWVhMjM5NWFmYWM0ZjgiLCJhdWQiOlsic2hpcGhlcm8tcHVibGljLWFwaSJdLCJpYXQiOjE3NDc2ODIxNTEsImV4cCI6MTc1MDEwMTM1MSwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSB2aWV3OnByb2R1Y3RzIGNoYW5nZTpwcm9kdWN0cyB2aWV3Om9yZGVycyBjaGFuZ2U6b3JkZXJzIHZpZXc6cHVyY2hhc2Vfb3JkZXJzIGNoYW5nZTpwdXJjaGFzZV9vcmRlcnMgdmlldzpzaGlwbWVudHMgY2hhbmdlOnNoaXBtZW50cyB2aWV3OnJldHVybnMgY2hhbmdlOnJldHVybnMgdmlldzp3YXJlaG91c2VfcHJvZHVjdHMgY2hhbmdlOndhcmVob3VzZV9wcm9kdWN0cyB2aWV3OnBpY2tpbmdfc3RhdHMgdmlldzpwYWNraW5nX3N0YXRzIG9mZmxpbmVfYWNjZXNzIiwiZ3R5IjpbInJlZnJlc2hfdG9rZW4iLCJwYXNzd29yZCJdLCJhenAiOiJtdGNid3FJMnI2MTNEY09OM0RiVWFITHFRelE0ZGtobiJ9.LFXeLDYOIeN9Hoqx6EAdMzNMLDncRnISnN8bXbbo0yE0KrvQO2dMDcZEl5W3G3kwZZtPBRuEC6H6uRq1pI8cFOrWXsDTqOmXfw17eoDe4Ry3aXFM5wSJdqUX8lu-66jtS9XBF0jb2qm7VFzEDc2RIGuXrOpsbVAD5j_hdtMNzW7l1nmchPnECkpLirQ1UymlFIpcDnwks37cFZp4PJSSLUo91uBSm9X5bhlveg7HiRRRSs3JndzdZ4zsIczQt6b5Bi7YzossXDqDWKrB9jAfjHDhCFUVkQW-xtdcyVIjCOnkYEaQSW-e5nR18N9MRmc7wyZb_jqSK-BWl3l2HuTOgg'
      },
      body: JSON.stringify({
        query: `
          query {
            orders(order_number: "EFM-278319") {
              data {
                edges {
                  node {
                    order_number
                    fulfillment_status
                    shipments {
                      id
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
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors);
      return;
    }
    
    if (!data?.data?.orders?.data?.edges?.[0]?.node) {
      console.warn('⚠️ No data found for order EFM-278319');
      console.log('📋 Full response:', JSON.stringify(data, null, 2));
      return;
    }

    const orderData = data.data.orders.data.edges[0].node;
    console.log('📋 ShipHero order data:');
    console.log('   Order Number:', orderData.order_number);
    console.log('   Fulfillment Status:', orderData.fulfillment_status);
    console.log('   Ready to Ship:', orderData.allocations?.[0]?.ready_to_ship);
    console.log('   Shipments:', orderData.shipments?.length || 0);
    
    if (orderData.shipments && orderData.shipments.length > 0) {
      console.log('   Shipment Details:');
      orderData.shipments.forEach((shipment, index) => {
        console.log(`     Shipment ${index + 1}:`);
        console.log(`       ID: ${shipment.id}`);
        console.log(`       Created: ${shipment.created_date}`);
      });
    } else {
      console.log('   No shipments found');
    }
    
    console.log('\n📝 Analysis:');
    if (orderData.fulfillment_status === 'fulfilled' && orderData.shipments?.length > 0) {
      console.log('   ✅ Order appears to be legitimately shipped in ShipHero');
    } else if (orderData.fulfillment_status === 'fulfilled' && (!orderData.shipments || orderData.shipments.length === 0)) {
      console.log('   ⚠️ Order marked as fulfilled but no shipments found - this could be the issue');
    } else if (orderData.fulfillment_status !== 'fulfilled') {
      console.log('   ❌ Order is NOT marked as fulfilled in ShipHero - your Firestore data is incorrect');
    }
    
  } catch (error) {
    console.error('❌ Error checking order:', error);
  }
}

checkSpecificOrder(); 