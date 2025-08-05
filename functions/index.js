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

      if (data.webhook_type === 'Tote Complete') {
        console.log('📦 Processing Tote Complete webhook:', {
          batchId: data.batch_id,
          totesCount: data.totes?.length || 0,
          timestamp: new Date().toISOString()
        });

        if (!data.totes || !Array.isArray(data.totes)) {
          console.warn('⚠️ Tote Complete webhook missing totes array');
          res.status(400).send('Missing totes data');
          return;
        }

        const batch = db.batch();
        const processedOrders = [];

        // Extract all orders from all totes
        data.totes.forEach(tote => {
          if (tote.orders && Array.isArray(tote.orders)) {
            tote.orders.forEach(order => {
              if (order.order_number) {
                const docRef = db.collection('orders').doc(order.order_number);
                batch.set(docRef, {
                  tote_completed: true,
                  tote_completed_at: admin.firestore.FieldValue.serverTimestamp(),
                  tote_name: tote.tote_name || null,
                  tote_uuid: tote.tote_uuid || null,
                  tote_barcode: tote.tote_barcode || null,
                  batch_id: data.batch_id || null,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                processedOrders.push(order.order_number);
              }
            });
          }
        });

        if (processedOrders.length === 0) {
          console.warn('⚠️ No orders found in Tote Complete webhook');
          res.status(400).send('No orders found in totes');
          return;
        }

        await batch.commit();
        console.log(`✅ Marked ${processedOrders.length} orders as tote complete:`, processedOrders);
        res.status(200).send(`Processed ${processedOrders.length} tote completed orders`);
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

      if (data.webhook_type === 'Tote Complete') {
        console.log('📋 Processing Tote Complete webhook:', {
          timestamp: new Date().toISOString(),
          batchId: data.batch_id,
          toteCount: data.totes?.length || 0,
          fullPayload: data
        });

        if (!data.totes || !Array.isArray(data.totes)) {
          console.warn('⚠️ Tote Complete webhook missing totes array');
          res.status(400).send('Invalid tote complete payload - missing totes');
          return;
        }

        const batch = db.batch();
        let totalOrdersProcessed = 0;

        // Process each tote
        for (const tote of data.totes) {
          console.log(`📦 Processing tote: ${tote.tote_name} (${tote.tote_barcode})`);

          if (!tote.orders || !Array.isArray(tote.orders)) {
            console.warn(`⚠️ Tote ${tote.tote_name} has no orders array`);
            continue;
          }

          // Process each order in the tote
          for (const order of tote.orders) {
            if (!order.order_number) {
              console.warn(`⚠️ Order in tote ${tote.tote_name} missing order_number`);
              continue;
            }

            const docRef = db.collection('orders').doc(order.order_number);
            batch.set(docRef, {
              tote_completed: true,
              tote_completed_at: admin.firestore.FieldValue.serverTimestamp(),
              tote_name: tote.tote_name,
              tote_uuid: tote.tote_uuid,
              tote_barcode: tote.tote_barcode,
              batch_id: data.batch_id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            totalOrdersProcessed++;
            console.log(`✅ Queued order ${order.order_number} for tote completion (Tote: ${tote.tote_name})`);
          }
        }

        // Commit all updates
        await batch.commit();
        
        console.log(`🎉 Successfully processed ${totalOrdersProcessed} orders across ${data.totes.length} totes (Batch: ${data.batch_id})`);
        res.status(200).send(`Tote Complete processed: ${totalOrdersProcessed} orders`);
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
  
  // Parse the allocated date - ShipHero sends UTC timestamps
  let alloc;
  if (typeof allocatedAt === 'string') {
    // Handle both formats: "2024-01-15 10:30:00" and "2024-01-15T10:30:00"
    let timeStr = allocatedAt;
    if (allocatedAt.includes('T')) {
      timeStr = allocatedAt.replace('T', ' ');
    }
    // Parse as UTC since ShipHero sends UTC timestamps
    // Fixed: Use 'Z' suffix for proper UTC parsing instead of ' UTC'
    alloc = new Date(timeStr.replace(' ', 'T') + 'Z');
  } else {
    alloc = new Date(allocatedAt);
  }
  
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
  
  // Set time to 4 PM Eastern (20:00 UTC during DST, 21:00 UTC during EST)
  const shipDeadlineHourUTC = isDST(new Date()) ? 20 : 21; // 4 PM Eastern
  shipDate.setUTCHours(shipDeadlineHourUTC, 0, 0, 0);
  
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
        'Authorization': `Bearer ${functions.config().shiphero.api_token}`
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

exports.createLocation = functions.https.onRequest(async (req, res) => {
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

  const { name, pickable, sellable, location_type_id, zone, warehouse_id } = req.body;

  // Validate required fields
  if (!name || !location_type_id || !warehouse_id) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, location_type_id, and warehouse_id are required'
    });
    return;
  }

  // Build the GraphQL mutation
  const mutation = `
    mutation {
      location_create (data: {
        name: "${name}"
        pickable: ${pickable !== false}
        sellable: ${sellable !== false}
        location_type_id: "${location_type_id}"
        zone: "${zone || 'A'}"
        warehouse_id: "${warehouse_id}"
      }){
        request_id
      }
    }
  `;

  try {
    console.log(`🏗️ Creating location: ${name} (type: ${location_type_id})`);
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${functions.config().shiphero.api_token}`
      },
      body: JSON.stringify({ query: mutation })
    });

    const data = await response.json();
    console.log(`📥 Full ShipHero response for ${name}:`, JSON.stringify(data, null, 2));

    // Check for GraphQL errors first
    if (data.errors && data.errors.length > 0) {
      console.error(`❌ GraphQL error for location ${name}:`, data.errors[0]);
      res.status(400).json({
        success: false,
        error: data.errors[0].message,
        fullError: data.errors[0]
      });
      return;
    }

    // Check if we have the expected data structure
    if (!data.data) {
      console.error(`❌ No data field in response for location ${name}:`, data);
      res.status(500).json({
        success: false,
        error: 'Invalid response structure from ShipHero - no data field'
      });
      return;
    }

    if (!data.data.location_create) {
      console.error(`❌ No location_create field in response for location ${name}:`, data.data);
      res.status(500).json({
        success: false,
        error: 'Invalid response structure from ShipHero - no location_create field'
      });
      return;
    }

    // Log the actual location_create response
    console.log(`📋 location_create response:`, data.data.location_create);

    // Handle different possible response structures
    const locationCreateResponse = data.data.location_create;
    let requestId = null;

    if (locationCreateResponse.request_id) {
      requestId = locationCreateResponse.request_id;
    } else if (locationCreateResponse.id) {
      requestId = locationCreateResponse.id;
    } else if (typeof locationCreateResponse === 'string') {
      requestId = locationCreateResponse;
    }

    if (!requestId) {
      console.error(`❌ No identifiable request_id/id in location_create response for ${name}:`, locationCreateResponse);
      res.status(500).json({
        success: false,
        error: 'No request_id or id returned from ShipHero',
        responseData: locationCreateResponse
      });
      return;
    }

    console.log(`✅ Successfully created location ${name} with identifier: ${requestId}`);

    res.status(200).json({
      success: true,
      location_name: name,
      request_id: requestId
    });

  } catch (error) {
    console.error(`❌ Error creating location ${name}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

exports.getFillRate = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
    console.log('📦 getFillRate function started - calling ShipHero with timeout...');
    
    // Query for problem orders using "problem" tag
    const queryBody = {
      query: `
        query {
          orders (tag:"problem"){
            data (first: 10){
              pageInfo{
                hasNextPage
              }
              edges {
                cursor
                node {
                  order_number
                  required_ship_date
                }
              }
            }
          }
        }
      `
    };

    console.log('📡 Making ShipHero API call...');
    
    // Add timeout to ShipHero API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('⏰ ShipHero API call timed out after 8 seconds');
      controller.abort();
    }, 8000); // 8 second timeout
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${functions.config().shiphero.api_token}`
      },
      body: JSON.stringify(queryBody),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('📥 ShipHero API responded with status:', response.status);

    if (!response.ok) {
      console.error('❌ ShipHero API Error:', response.status, response.statusText);
      res.status(500).json({
        success: false,
        error: `ShipHero API error: ${response.status}`
      });
      return;
    }

    const data = await response.json();
    console.log('📥 ShipHero fill rate response received');

    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors);
      res.status(500).json({
        success: false,
        error: 'GraphQL errors',
        details: data.errors
      });
      return;
    }

    // Filter problem orders to only include today or overdue (ignore future dates)
    const todayEastern = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
    const todayDate = new Date(todayEastern);
    
    const problemOrders = data?.data?.orders?.data?.edges || [];
    const problemOrdersDueNow = problemOrders.filter(edge => {
      const order = edge.node;
      if (!order.required_ship_date) return false;
      
      const requiredDate = new Date(order.required_ship_date);
      const requiredDateStr = requiredDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const requiredDateObj = new Date(requiredDateStr);
      
      // Only include if required ship date is today or before (ignore future)
      return requiredDateObj <= todayDate;
    });

    console.log(`🚨 Found ${problemOrdersDueNow.length} problem orders due today/overdue out of ${problemOrders.length} total problem orders`);

    res.status(200).json({
      success: true,
      data: {
        problemOrdersCount: problemOrdersDueNow.length,
        totalProblemOrders: problemOrders.length,
        problemOrders: problemOrdersDueNow.map(edge => ({
          order_number: edge.node.order_number,
          required_ship_date: edge.node.required_ship_date
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error fetching fill rate:', error);
    
    // If ShipHero API times out, return fallback data (no problem orders)
    if (error.name === 'AbortError') {
      console.log('🔄 ShipHero API timed out, returning fallback data (0 problem orders)');
      res.status(200).json({
        success: true,
        data: {
          problemOrdersCount: 0,
          totalProblemOrders: 0,
          problemOrders: [],
          fallback: true,
          reason: 'ShipHero API timeout'
        }
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
  });
});

// Pack Errors Webhook - receives data from Google Form
exports.packErrorsWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    console.log('📋 Received pack errors webhook:', {
      timestamp: new Date().toISOString(),
      method: req.method,
      headers: req.headers,
      body: req.body
    });

    try {
      // Store pack error data in Firestore
      const packErrorData = {
        ...req.body, // Include all form data
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: new Date().toISOString(),
        source: 'google_form'
      };

      // Add to pack_errors collection
      const docRef = await db.collection('pack_errors').add(packErrorData);
      
      console.log('✅ Pack error stored with ID:', docRef.id);
      console.log('📋 Pack error data:', packErrorData);

      res.status(200).json({
        success: true,
        message: 'Pack error recorded successfully',
        id: docRef.id
      });

    } catch (error) {
      console.error('❌ Error storing pack error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to store pack error',
        details: error.message
      });
    }
  });
});