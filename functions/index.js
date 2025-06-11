const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// CORS middleware
const setCorsHeaders = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
};

exports.shipHeroWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const data = req.body;
    console.log('📥 Received webhook:', {
      type: data.webhook_type,
      orderNumber: data.order_number,
      timestamp: new Date().toISOString(),
      fullPayload: data
    });

    try {
      if (data.webhook_type === 'Order Allocated') {
        const docId = data.order_number;
        const docRef = docId
          ? db.collection('orders').doc(docId)
          : db.collection('orders').doc(); // fallback

        await docRef.set({
          order_uuid: data.order_uuid || null,
          order_number: data.order_number || null,
          account_uuid: data.account_uuid || null,
          allocated_at: data.allocated_at || new Date().toISOString(),
          line_items: data.line_items || [],
          ready_to_ship: data.ready_to_ship === 1,
          status: 'allocated',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Saved allocated order: ${data.order_number}`);
        res.status(200).send('OK');
        return;
      }

      if (data.webhook_type === 'Shipment Update') {
        const shipment = data.fulfillment;

        // Enhanced validation
        if (!shipment || !shipment.order_uuid || !shipment.order_number || !shipment.created_at) {
          console.warn('⚠️ Shipment webhook missing required fields:', {
            hasShipment: !!shipment,
            hasOrderUuid: !!shipment?.order_uuid,
            hasOrderNumber: !!shipment?.order_number,
            hasCreatedAt: !!shipment?.created_at,
            fullPayload: data
          });
          res.status(400).send('Invalid shipment payload - missing required fields');
          return;
        }

        // Validate the created_at date
        const shipmentDate = new Date(shipment.created_at);
        if (isNaN(shipmentDate.getTime())) {
          console.error('❌ Invalid shipment date:', {
            orderNumber: shipment.order_number,
            createdAt: shipment.created_at,
            fullPayload: data
          });
          res.status(400).send('Invalid shipment date');
          return;
        }

        // Additional validation - ensure we have an actual order in our system
        const orderRef = db.collection('orders').doc(shipment.order_number);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
          console.warn(`⚠️ Received shipment webhook for unknown order: ${shipment.order_number}`, {
            shipmentData: shipment,
            fullPayload: data
          });
          res.status(404).send('Order not found in system');
          return;
        }

        console.log('📦 Processing valid shipment webhook:', {
          orderNumber: shipment.order_number,
          createdAt: shipment.created_at,
          trackingNumber: shipment.tracking_number || 'N/A',
          carrier: shipment.shipping_carrier || 'N/A'
        });

        // Save shipment separately
        const docRef = db.collection('orders_shipped').doc(shipment.order_number);

        await docRef.set({
          order_uuid: shipment.order_uuid,
          order_number: shipment.order_number,
          tracking_number: shipment.tracking_number || null,
          shipping_method: shipment.shipping_method || null,
          shipping_carrier: shipment.shipping_carrier || null,
          line_items: shipment.line_items || [],
          shipped_at: shipment.created_at,
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // ✅ Update status in orders collection to "shipped"
        await orderRef.set({
          status: 'shipped',
          shippedAt: admin.firestore.Timestamp.fromDate(shipmentDate),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          webhookProcessedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`✅ Successfully processed shipment for order: ${shipment.order_number}`);
        res.status(200).send('OK');
        return;
      }

      if (data.webhook_type === 'Order Canceled') {
        const docId = data.order_number;
        if (!docId) {
          console.warn('⚠️ Canceled webhook missing order_number');
          res.status(400).send('Missing order_number');
          return;
        }

        console.log('🔄 Processing order cancellation:', {
          orderNumber: docId,
          webhookData: data,
          timestamp: new Date().toISOString()
        });

        try {
          // First, check if the order exists
          const orderRef = db.collection('orders').doc(docId);
          const orderDoc = await orderRef.get();
          
          if (!orderDoc.exists) {
            console.warn(`⚠️ Order ${docId} not found in Firestore`);
            res.status(404).send('Order not found');
            return;
          }

          console.log(`📝 Current order state:`, {
            orderNumber: docId,
            currentData: orderDoc.data()
          });

          await orderRef.set({
            status: 'canceled',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`✅ Successfully marked order ${docId} as canceled`);
          
          // Verify the update
          const updatedDoc = await orderRef.get();
          console.log(`📋 Updated order state:`, {
            orderNumber: docId,
            updatedData: updatedDoc.data()
          });

          res.status(200).send('Order cancellation processed');
        } catch (error) {
          console.error('❌ Error updating canceled order in Firestore:', {
            orderNumber: docId,
            error: error.message,
            errorStack: error.stack
          });
          throw error;
        }
        return;
      }

      if (data.items && Array.isArray(data.items)) {
        const clearedOrderIds = [...new Set(data.items.map(item => item.order_id))]; // Unique order IDs

        const batch = db.batch();

        clearedOrderIds.forEach(orderId => {
          const docRef = db.collection('orders').doc(orderId.toString());
          batch.set(docRef, {
            status: 'cleared',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        await batch.commit();
        console.log(`Cleared tote orders: ${clearedOrderIds.join(', ')}`);
        res.status(200).send('Tote cleared processed');
        return;
      }

      if (data.webhook_type === 'Order Deallocated') {
        const docId = data.order_number;
        if (!docId) {
          console.warn('Deallocated webhook missing order_number');
          res.status(400).send('Missing order_number');
          return;
        }

        await db.collection('orders').doc(docId).set({
          status: 'deallocated',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`Marked order as deallocated: ${docId}`);
        res.status(200).send('Order deallocation processed');
        return;
      }

      // Unrecognized webhook
      console.log('⚪️ Ignored webhook:', data.webhook_type);
      res.status(200).send('Ignored');
    } catch (err) {
      console.error('❌ Firestore error:', err);
      res.status(500).send('Error');
    }
  });
});

const calculateRequiredShipDate = (allocatedAt) => {
  if (!allocatedAt) return null;
  
  // Parse the allocated date
  const alloc = new Date(allocatedAt);
  
  // Work entirely in UTC to avoid timezone conversion issues
  const allocUTC = new Date(alloc);
  
  // Check if we're in DST (same logic as frontend)
  const year = allocUTC.getUTCFullYear();
  const isDST = (date) => {
    const jan = new Date(year, 0, 1).getTimezoneOffset();
    const jul = new Date(year, 6, 1).getTimezoneOffset();
    return Math.max(jan, jul) !== date.getTimezoneOffset();
  };
  
  // Create cutoff: 8 AM Eastern = 12 UTC (DST) or 13 UTC (EST)
  const cutoffHourUTC = isDST(new Date()) ? 12 : 13;
  const cutoffUTC = new Date(allocUTC);
  cutoffUTC.setUTCHours(cutoffHourUTC, 0, 0, 0);
  
  const isBeforeCutoff = allocUTC < cutoffUTC;
  let shipDate = new Date(allocUTC);
  if (!isBeforeCutoff) {
    shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  }
  
  // Skip weekends
  while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0) {
    shipDate.setUTCDate(shipDate.getUTCDate() + 1);
  }
  
  return shipDate;
};

const needsShippedToday = (allocatedAt) => {
  if (!allocatedAt) return false;
  
  const requiredShipDate = calculateRequiredShipDate(allocatedAt);
  if (!requiredShipDate) return false;
  
  // Compare just the date portion (UTC)
  const today = new Date();
  const shipDateStr = requiredShipDate.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  
  return shipDateStr === todayStr;
};

const verifyOrderWithGraphQL = async (orderNumber, retryCount = 0) => {
  try {
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJUQXlOVU13T0Rrd09ETXhSVVZDUXpBNU5rSkVOVVUxUmtNeU1URTRNMEkzTWpnd05ERkdNdyJ9.eyJodHRwOi8vc2hpcGhlcm8tcHVibGljLWFwaS91c2VyaW5mbyI6eyJhY2NvdW50X2lkIjo4MzE4MiwiY2xpZW50X25hbWUiOiJTaGlwaGVybyBQdWJsaWMgQVBJIEdhdGV3YXkiLCJkYXRhIjp7fSwiZW1haWwiOiJpdEBlY29zaGlwLmNvbSIsImZpcnN0X25hbWUiOiJFY29TaGlwICIsImlkIjoibXRjYndxSTJyNjEzRGNPTjNEYlVhSExxUXpRNGRraG4iLCJsYXN0X25hbWUiOiJJVCIsIm5hbWUiOiJFY29TaGlwICBJVCIsIm5pY2tuYW1lIjoiaXQiLCJvcmlnaW5fYXBwIjoidW5rbm93biIsInBpY3R1cmUiOiJodHRwczovL3MuZ3JhdmF0YXIuY29tL2F2YXRhci8xZGFiNDNiY2JmZTZmMjE2M2E1ZGJkMjYzYjFiMmYxNT9zPTQ4MCZyPXBnJmQ9aHR0cHMlM0ElMkYlMkZjZG4uYXV0aDAuY29tJTJGYXZhdGFycyUyRmVpLnBuZyJ9LCJpc3MiOiJodHRwczovL2xvZ2luLnNoaXBoZXJvLmNvbS8iLCJzdWIiOiJhdXRoMHw2Nzc3ZGZiMTU3ZWVhMjM5NWFmYWM0ZjgiLCJhdWQiOlsic2hpcGhlcm8tcHVibGljLWFwaSJdLCJpYXQiOjE3NDc2ODIxNTEsImV4cCI6MTc1MDEwMTM1MSwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSB2aWV3OnByb2R1Y3RzIGNoYW5nZTpwcm9kdWN0cyB2aWV3Om9yZGVycyBjaGFuZ2U6b3JkZXJzIHZpZXc6cHVyY2hhc2Vfb3JkZXJzIGNoYW5nZTpwdXJjaGFzZV9vcmRlcnMgdmlldzpzaGlwbWVudHMgY2hhbmdlOnNoaXBtZW50cyB2aWV3OnJldHVybnMgY2hhbmdlOnJldHVybnMgdmlldzp3YXJlaG91c2VfcHJvZHVjdHMgY2hhbmdlOndhcmVob3VzZV9wcm9kdWN0cyB2aWV3OnBpY2tpbmdfc3RhdHMgdmlldzpwYWNraW5nX3N0YXRzIG9mZmxpbmVfYWNjZXNzIiwiZ3R5IjpbInJlZnJlc2hfdG9rZW4iLCJwYXNzd29yZCJdLCJhenAiOiJtdGNid3FJMnI2MTNEY09OM0RiVWFITHFRelE0ZGtobiJ9.LFXeLDYOIeN9Hoqx6EAdMzNMLDncRnISnN8bXbbo0yE0KrvQO2dMDcZEl5W3G3kwZZtPBRuEC6H6uRq1pI8cFOrWXsDTqOmXfw17eoDe4Ry3aXFM5wSJdqUX8lu-66jtS9XBF0jb2qm7VFzEDc2RIGuXrOpsbVAD5j_hdtMNzW7l1nmchPnECkpLirQ1UymlFIpcDnwks37cFZp4PJSSLUo91uBSm9X5bhlveg7HiRRRSs3JndzdZ4zsIczQt6b5Bi7YzossXDqDWKrB9jAfjHDhCFUVkQW-xtdcyVIjCOnkYEaQSW-e5nR18N9MRmc7wyZb_jqSK-BWl3l2HuTOgg'
      },
      body: JSON.stringify({
        query: `
          query {
            orders(order_number: "${orderNumber}") {
              data {
                edges {
                  node {
                    fulfillment_status
                    shipments {
                      created_date
                    }
                    allocations {
                      ready_to_ship
                    }
                    required_ship_date
                  }
                }
              }
            }
          }
        `
      })
    });

    const data = await response.json();
    
    // Check for rate limiting errors
    if (response.status === 429 || (data.errors && data.errors.some(e => e.message.includes('rate limit')))) {
      console.warn(`⚠️ Rate limited for order ${orderNumber}, attempt ${retryCount + 1}`);
      
      if (retryCount < 3) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, retryCount + 1) * 1000;
        console.log(`⏰ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return verifyOrderWithGraphQL(orderNumber, retryCount + 1);
      } else {
        console.error(`❌ Max retries reached for order ${orderNumber}`);
        return null;
      }
    }
    
    if (data.errors) {
      console.error('GraphQL Errors for order', orderNumber + ':', data.errors);
      return null;
    }

    if (!data?.data?.orders?.data?.edges?.[0]?.node) {
      console.warn('No data found for order', orderNumber);
      return null;
    }

    return data?.data?.orders?.data?.edges?.[0]?.node;
  } catch (error) {
    console.error(`Error verifying order ${orderNumber}:`, error);
    
    // Retry on network errors
    if (retryCount < 2 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      console.log(`🔄 Retrying order ${orderNumber} due to network error...`);
      const delay = (retryCount + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return verifyOrderWithGraphQL(orderNumber, retryCount + 1);
    }
    
    return null;
  }
};

const processOrders = async (ordersToProcess) => {
  setIsRefreshing(true);
  const updatedOrders = [...orders];

  for (const order of ordersToProcess) {
    const result = await verifyOrderWithGraphQL(order.order_number);
    
    if (result) {
      // Find the order in our local state
      const orderIndex = updatedOrders.findIndex(o => o.order_number === order.order_number);
      if (orderIndex === -1) continue;

      // Update based on fulfillment status
      if (result.fulfillment_status === 'fulfilled' || result.fulfillment_status === 'canceled') {
        const newStatus = result.fulfillment_status === 'fulfilled' ? 'shipped' : 'canceled';
        if (updatedOrders[orderIndex].status !== newStatus) {
          setRefreshLog(prev => [...prev, `📝 Order ${order.order_number}: Status changed from ${updatedOrders[orderIndex].status} to ${newStatus}`]);
          updatedOrders[orderIndex].status = newStatus;
        }
      }

      // Update shipped at time if available
      if (result.shipments?.[0]?.created_date) {
        updatedOrders[orderIndex].shippedAt = result.shipments[0].created_date;
      }

      // Check ready_to_ship status
      const isReadyToShip = result.allocations?.[0]?.ready_to_ship ?? true;
      if (!isReadyToShip && updatedOrders[orderIndex].ready_to_ship) {
        // Save to not_ready_to_ship collection
        await db.collection('not_ready_to_ship').doc(order.order_number).set({
          ...updatedOrders[orderIndex],
          ready_to_ship: false,
          removed_at: admin.firestore.FieldValue.serverTimestamp(),
          reason: 'ready_to_ship_false'
        });

        // Update ready_to_ship status in orders collection
        updatedOrders[orderIndex].ready_to_ship = false;
      }

      // Update Firestore
      const docRef = db.collection('orders').doc(order.order_number);
      await docRef.set({
        status: updatedOrders[orderIndex].status,
        shippedAt: updatedOrders[orderIndex].shippedAt,
        ready_to_ship: updatedOrders[orderIndex].ready_to_ship,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update local state after each order
      setOrders([...updatedOrders]);
    }

    // Wait 1 second before next query
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  setIsRefreshing(false);
  setIsRefreshConfirming(false);
};

exports.verifyOrders = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const startTime = Date.now();
    const { ordersToVerify, notReadyOrders } = req.body;

    if (!ordersToVerify || !Array.isArray(ordersToVerify)) {
      console.error('❌ Invalid request: ordersToVerify must be an array');
      res.status(400).json({
        success: false,
        error: 'Invalid request: ordersToVerify must be an array'
      });
      return;
    }

    console.log(`🚀 Starting to process ${ordersToVerify.length} regular orders and ${notReadyOrders?.length || 0} not-ready orders`);
    console.log(`⏰ Function started at: ${new Date().toISOString()}`);

    try {
      const batchSize = 5;
      const results = [];
      let processedCount = 0;
      const timeoutLimit = 520000; // 520 seconds, leaving 20 seconds buffer

      // Process regular orders
      for (let i = 0; i < ordersToVerify.length; i += batchSize) {
        // Check for timeout
        if (Date.now() - startTime > timeoutLimit) {
          console.error('⏰ Function approaching timeout, stopping early');
          break;
        }

        const batch = ordersToVerify.slice(i, i + batchSize);
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ordersToVerify.length/batchSize)} (orders ${i + 1}-${Math.min(i + batchSize, ordersToVerify.length)})`);
        
        // Process each order in batch sequentially with delays
        const batchResults = [];
        for (let j = 0; j < batch.length; j++) {
          const order = batch[j];
          console.log(`🔍 Processing order ${processedCount + j + 1}/${ordersToVerify.length}: ${order.order_number}`);
          
          try {
            const result = await verifyOrderWithGraphQL(order.order_number);
            
            if (result) {
              console.log(`✅ Got GraphQL result for ${order.order_number}`);
              const orderRef = db.collection('orders').doc(order.order_number);
              const orderDoc = await orderRef.get();
              
              if (!orderDoc.exists) {
                console.warn(`⚠️ Order ${order.order_number} not found in database`);
                batchResults.push({
                  order_number: order.order_number,
                  status: 'error',
                  message: 'Order not found in database'
                });
                continue;
              }

              const orderData = orderDoc.data();
              const updates = {};
              let changed = false;

              // Update based on fulfillment status
              if (result.fulfillment_status === 'fulfilled' || result.fulfillment_status === 'canceled' || result.fulfillment_status === 'wholesale') {
                let newStatus;
                if (result.fulfillment_status === 'fulfilled') {
                  newStatus = 'shipped';
                } else if (result.fulfillment_status === 'canceled') {
                  newStatus = 'canceled';
                } else if (result.fulfillment_status === 'wholesale') {
                  newStatus = 'wholesale';
                }
                
                if (orderData.status !== newStatus) {
                  console.log(`📝 Order ${order.order_number}: Status ${orderData.status} -> ${newStatus}`);
                  updates.status = newStatus;
                  changed = true;
                  
                  if (newStatus === 'wholesale') {
                    console.log(`🏢 Order ${order.order_number}: Marked as wholesale - will be removed from ship today list`);
                  }
                }
              }

              // Update shipped at time if available
              if (result.shipments?.[0]?.created_date && !orderData.shippedAt) {
                console.log(`📅 Order ${order.order_number}: Adding shipping date`);
                updates.shippedAt = result.shipments[0].created_date;
                changed = true;
              }

              // Check and update required ship date from ShipHero if available
              if (result.required_ship_date && orderData.allocated_at) {
                // Parse the ShipHero required ship date
                const shipHeroRequiredDate = new Date(result.required_ship_date);
                
                // Calculate our required ship date from allocated_at
                const calculatedDate = calculateRequiredShipDate(orderData.allocated_at);
                
                if (calculatedDate) {
                  // Compare dates (just the date portion, not time)
                  const shipHeroDateStr = shipHeroRequiredDate.toISOString().split('T')[0];
                  const calculatedDateStr = calculatedDate.toISOString().split('T')[0];
                  
                  if (shipHeroDateStr !== calculatedDateStr) {
                    console.log(`📅 Order ${order.order_number}: Required ship date differs`);
                    console.log(`   Our calculation: ${calculatedDateStr}`);
                    console.log(`   ShipHero date: ${shipHeroDateStr}`);
                    console.log(`   Using ShipHero date as override`);
                    
                    // Store the ShipHero required ship date as an override
                    updates.required_ship_date_override = result.required_ship_date;
                    updates.required_ship_date_source = 'shiphero';
                    changed = true;
                    
                    // Check if this affects "ship today" status
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];
                    const wasShipToday = needsShippedToday(orderData.allocated_at);
                    const isNowShipToday = shipHeroDateStr === todayStr;
                    
                    if (wasShipToday !== isNowShipToday) {
                      console.log(`🔄 Order ${order.order_number}: Ship today status changed from ${wasShipToday} to ${isNowShipToday}`);
                      updates.ship_today_override = isNowShipToday;
                    }
                  }
                } else {
                  console.log(`⚠️ Order ${order.order_number}: Could not calculate required ship date from allocated_at`);
                }
              }

              // Check ready_to_ship status
              const isReadyToShip = result.allocations?.[0]?.ready_to_ship ?? true;
              if (!isReadyToShip && orderData.ready_to_ship) {
                console.log(`🚫 Order ${order.order_number}: Not ready to ship`);
                updates.ready_to_ship = false;
                changed = true;

                // Save to not_ready_to_ship collection
                await db.collection('not_ready_to_ship').doc(order.order_number).set({
                  ...orderData,
                  ready_to_ship: false,
                  removed_at: admin.firestore.FieldValue.serverTimestamp(),
                  reason: 'ready_to_ship_false'
                });
              }

              if (changed) {
                updates.lastVerified = admin.firestore.FieldValue.serverTimestamp();
                updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                await orderRef.update(updates);
                console.log(`💾 Updated order ${order.order_number} in database`);
              }

              batchResults.push({
                order_number: order.order_number,
                status: 'success',
                changes: changed ? updates : null
              });
            } else {
              console.error(`❌ Failed to get GraphQL data for ${order.order_number}`);
              batchResults.push({
                order_number: order.order_number,
                status: 'error',
                message: 'Failed to get data from ShipHero'
              });
            }
          } catch (orderError) {
            console.error(`💥 Error processing order ${order.order_number}:`, orderError);
            batchResults.push({
              order_number: order.order_number,
              status: 'error',
              message: `Processing error: ${orderError.message}`
            });
          }

          // Wait 1 second between each individual request
          if (j < batch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        results.push(...batchResults);
        processedCount += batch.length;

        console.log(`📊 Completed batch. Processed ${processedCount}/${ordersToVerify.length} regular orders`);

        // Longer delay between batches (3 seconds)
        if (i + batchSize < ordersToVerify.length) {
          console.log('⏰ Waiting 3 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Process not ready orders with same rate limiting
      if (notReadyOrders && Array.isArray(notReadyOrders) && notReadyOrders.length > 0) {
        console.log(`🔄 Processing ${notReadyOrders.length} not-ready orders`);
        
        for (let i = 0; i < notReadyOrders.length; i += batchSize) {
          // Check for timeout
          if (Date.now() - startTime > timeoutLimit) {
            console.error('⏰ Function approaching timeout, stopping early');
            break;
          }

          const batch = notReadyOrders.slice(i, i + batchSize);
          console.log(`📦 Processing not-ready batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(notReadyOrders.length/batchSize)}`);
          
          // Process each order in batch sequentially with delays
          const batchResults = [];
          for (let j = 0; j < batch.length; j++) {
            const order = batch[j];
            console.log(`🔍 Processing not-ready order: ${order.order_number}`);
            
            try {
              const result = await verifyOrderWithGraphQL(order.order_number);
              
              if (result) {
                const isReadyToShip = result.allocations?.[0]?.ready_to_ship ?? true;
                
                if (isReadyToShip) {
                  console.log(`✅ Order ${order.order_number} is now ready to ship`);
                  // Remove from not_ready_to_ship collection
                  await db.collection('not_ready_to_ship').doc(order.order_number).delete();

                  // Prepare updates for the main orders collection
                  const updates = {
                    ready_to_ship: true,
                    lastVerified: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  };

                  // Check and update required ship date from ShipHero if available
                  if (result.required_ship_date && order.allocated_at) {
                    // Parse the ShipHero required ship date
                    const shipHeroRequiredDate = new Date(result.required_ship_date);
                    
                    // Calculate our required ship date from allocated_at
                    const calculatedDate = calculateRequiredShipDate(order.allocated_at);
                    
                    if (calculatedDate) {
                      // Compare dates (just the date portion, not time)
                      const shipHeroDateStr = shipHeroRequiredDate.toISOString().split('T')[0];
                      const calculatedDateStr = calculatedDate.toISOString().split('T')[0];
                      
                      if (shipHeroDateStr !== calculatedDateStr) {
                        console.log(`📅 Order ${order.order_number}: Required ship date differs`);
                        console.log(`   Our calculation: ${calculatedDateStr}`);
                        console.log(`   ShipHero date: ${shipHeroDateStr}`);
                        console.log(`   Using ShipHero date as override`);
                        
                        // Store the ShipHero required ship date as an override
                        updates.required_ship_date_override = result.required_ship_date;
                        updates.required_ship_date_source = 'shiphero';
                        
                        // Check if this affects "ship today" status
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        const wasShipToday = needsShippedToday(order.allocated_at);
                        const isNowShipToday = shipHeroDateStr === todayStr;
                        
                        if (wasShipToday !== isNowShipToday) {
                          console.log(`🔄 Order ${order.order_number}: Ship today status changed from ${wasShipToday} to ${isNowShipToday}`);
                          updates.ship_today_override = isNowShipToday;
                        }
                      }
                    } else {
                      console.log(`⚠️ Order ${order.order_number}: Could not calculate required ship date from allocated_at`);
                    }
                  }

                  // Update the order in the main orders collection
                  await db.collection('orders').doc(order.order_number).update(updates);

                  batchResults.push({
                    order_number: order.order_number,
                    status: 'success',
                    message: 'Order is now ready to ship',
                    changes: updates
                  });
                } else {
                  console.log(`⏸️ Order ${order.order_number} is still not ready to ship`);
                  batchResults.push({
                    order_number: order.order_number,
                    status: 'success',
                    message: 'Order is still not ready to ship'
                  });
                }
              } else {
                console.error(`❌ Failed to get GraphQL data for not-ready order ${order.order_number}`);
                batchResults.push({
                  order_number: order.order_number,
                  status: 'error',
                  message: 'Failed to get data from ShipHero'
                });
              }
            } catch (orderError) {
              console.error(`💥 Error processing not-ready order ${order.order_number}:`, orderError);
              batchResults.push({
                order_number: order.order_number,
                status: 'error',
                message: `Processing error: ${orderError.message}`
              });
            }

            // Wait 1 second between each individual request
            if (j < batch.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          results.push(...batchResults);
          processedCount += batch.length;

          console.log(`📊 Processed ${processedCount}/${ordersToVerify.length + notReadyOrders.length} total orders`);

          // Longer delay between batches (3 seconds)
          if (i + batchSize < notReadyOrders.length) {
            console.log('⏰ Waiting 3 seconds before next batch...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      
      console.log(`✅ Completed processing ${processedCount} orders in ${totalTime} seconds`);
      console.log(`📈 Updated orders: ${results.filter(r => r.status === 'success' && r.changes).length}`);
      console.log(`❌ Failed orders: ${results.filter(r => r.status === 'error').length}`);

      res.status(200).json({
        success: true,
        processed: processedCount,
        results: results,
        totalTime: totalTime
      });

    } catch (error) {
      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      
      console.error('❌ Error processing orders:', error);
      console.error('❌ Error stack:', error.stack);
      console.log(`⏰ Function failed after ${totalTime} seconds`);
      
      res.status(500).json({
        success: false,
        error: error.message,
        totalTime: totalTime
      });
    }
  });

exports.testVerifyOrders = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const startTime = Date.now();
    const { ordersToVerify } = req.body;

    if (!ordersToVerify || !Array.isArray(ordersToVerify)) {
      console.error('❌ Invalid request: ordersToVerify must be an array');
      res.status(400).json({
        success: false,
        error: 'Invalid request: ordersToVerify must be an array'
      });
      return;
    }

    // Only process first 5 orders for testing
    const testOrders = ordersToVerify.slice(0, 5);
    console.log(`🧪 Test processing ${testOrders.length} orders`);
    console.log(`⏰ Function started at: ${new Date().toISOString()}`);

    try {
      const results = [];

      for (let i = 0; i < testOrders.length; i++) {
        const order = testOrders[i];
        console.log(`🔍 Processing test order ${i + 1}/${testOrders.length}: ${order.order_number}`);
        
        try {
          const result = await verifyOrderWithGraphQL(order.order_number);
          
          if (result) {
            console.log(`✅ Got GraphQL result for ${order.order_number}`);
            results.push({
              order_number: order.order_number,
              status: 'success',
              result: result
            });
          } else {
            console.error(`❌ Failed to get GraphQL data for ${order.order_number}`);
            results.push({
              order_number: order.order_number,
              status: 'error',
              message: 'Failed to get data from ShipHero'
            });
          }
        } catch (orderError) {
          console.error(`💥 Error processing order ${order.order_number}:`, orderError);
          results.push({
            order_number: order.order_number,
            status: 'error',
            message: `Processing error: ${orderError.message}`
          });
        }

        // Wait 2 seconds between requests
        if (i < testOrders.length - 1) {
          console.log('⏰ Waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      
      console.log(`✅ Test completed in ${totalTime} seconds`);

      res.status(200).json({
        success: true,
        processed: testOrders.length,
        results: results,
        totalTime: totalTime
      });

    } catch (error) {
      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      
      console.error('❌ Error in test function:', error);
      console.error('❌ Error stack:', error.stack);
      
      res.status(500).json({
        success: false,
        error: error.message,
        totalTime: totalTime
      });
    }
  });

exports.testConnection = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  console.log('🧪 Test endpoint called');
  res.status(200).json({
    success: true,
    message: 'Function is working!',
    timestamp: new Date().toISOString()
  });
});

exports.fixOrder = functions.https.onRequest(async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { orderNumber } = req.body;

  if (!orderNumber) {
    res.status(400).json({
      success: false,
      error: 'Order number is required'
    });
    return;
  }

  try {
    console.log(`🔧 Fixing order ${orderNumber}...`);
    
    const orderRef = db.collection('orders').doc(orderNumber);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      console.log(`❌ Order ${orderNumber} not found in Firestore`);
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }
    
    const currentData = orderDoc.data();
    console.log(`📋 Current order data for ${orderNumber}:`, currentData);
    
    // Check ShipHero to get the real status
    const shippedData = await verifyOrderWithGraphQL(orderNumber);
    
    if (!shippedData) {
      res.status(500).json({
        success: false,
        error: 'Failed to get order data from ShipHero'
      });
      return;
    }
    
    // Determine correct status
    let correctStatus = 'allocated';
    let shouldRemoveShippedAt = false;
    
    if (shippedData.fulfillment_status === 'fulfilled' && shippedData.shipments?.length > 0) {
      correctStatus = 'shipped';
    } else if (shippedData.fulfillment_status === 'canceled') {
      correctStatus = 'canceled';
    } else {
      // Not actually shipped, should remove shippedAt
      shouldRemoveShippedAt = true;
    }
    
    const updates = {
      status: correctStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastVerified: admin.firestore.FieldValue.serverTimestamp(),
      correctionNote: `Fixed incorrect status - ShipHero fulfillment_status: ${shippedData.fulfillment_status}, shipments: ${shippedData.shipments?.length || 0}`
    };
    
    if (shouldRemoveShippedAt && currentData.shippedAt) {
      updates.shippedAt = admin.firestore.FieldValue.delete();
    } else if (shippedData.shipments?.[0]?.created_date) {
      updates.shippedAt = shippedData.shipments[0].created_date;
    }
    
    await orderRef.update(updates);
    
    console.log(`✅ Order ${orderNumber} has been corrected to status: ${correctStatus}`);
    
    res.status(200).json({
      success: true,
      orderNumber: orderNumber,
      oldStatus: currentData.status,
      newStatus: correctStatus,
      changes: updates
    });
    
  } catch (error) {
    console.error(`❌ Error fixing order ${orderNumber}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});