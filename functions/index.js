const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Validation helper for queue items
function validateQueueItem(queueData, queueId) {
  // Check if queueData exists and is an object
  if (!queueData || typeof queueData !== 'object') {
    return { valid: false, error: 'Queue item data is missing or invalid' };
  }

  // Check if webhook_data exists and is an object
  if (!queueData.webhook_data || typeof queueData.webhook_data !== 'object') {
    return { valid: false, error: 'webhook_data is missing or invalid' };
  }

  // Check if webhook_data has required structure
  const webhookData = queueData.webhook_data;
  if (!webhookData.order_id && !webhookData.order_number) {
    return { valid: false, error: 'webhook_data missing order_id and order_number' };
  }

  // Check if status exists (should always be present, but validate anyway)
  if (!queueData.status) {
    return { valid: false, error: 'Queue item missing status field' };
  }

  return { valid: true };
}

// Slack notification helper for failed queue items
async function sendSlackFailureNotification(queueData, queueId, error, attempts) {
  try {
    const webhookUrl = functions.config().slack?.webhook_url;
    if (!webhookUrl) {
      console.log('⚠️ Slack webhook URL not configured, skipping notification');
      return;
    }

    const orderNumber = queueData.order_number || 'Unknown';
    const orderId = queueData.order_id || 'Unknown';
    const attemptCount = attempts || queueData.attempts || 0;
    const createdAt = queueData.createdAt?.toDate?.() || new Date();
    
    // Format error message (truncate if too long)
    const errorMessage = error || 'Unknown error';
    const truncatedError = errorMessage.length > 200 ? errorMessage.substring(0, 200) + '...' : errorMessage;

    const payload = {
      text: `🚨 EFM Box Assignment Failed`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 EFM Box Assignment Failed'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Order Number:*\n${orderNumber}`
            },
            {
              type: 'mrkdwn',
              text: `*Order ID:*\n${orderId}`
            },
            {
              type: 'mrkdwn',
              text: `*Attempts:*\n${attemptCount}/3`
            },
            {
              type: 'mrkdwn',
              text: `*Failed At:*\n${new Date().toLocaleString()}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:*\n\`\`\`${truncatedError}\`\`\``
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Queue ID: ${queueId} | Created: ${createdAt.toLocaleString()}`
            }
          ]
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`❌ Failed to send Slack notification: ${response.status} ${response.statusText}`);
    } else {
      console.log(`✅ Slack notification sent for failed order ${orderNumber}`);
    }
  } catch (error) {
    console.error('❌ Error sending Slack notification:', error);
    // Don't throw - notification failure shouldn't break queue processing
  }
}

// EFM Products and Box Sizes Cache
let efmProductsCache = null;
let boxSizesCache = null;
let cacheLastUpdated = null;
const CACHE_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Load EFM products and box sizes into cache
async function loadEFMCache() {
  try {
    const [productsSnapshot, boxSizesSnapshot] = await Promise.all([
      db.collection('efm_products').get(),
      db.collection('box_sizes').get()
    ]);

    efmProductsCache = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    boxSizesCache = boxSizesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cacheLastUpdated = Date.now();

    console.log(`✅ EFM cache refreshed: ${efmProductsCache.length} products, ${boxSizesCache.length} box sizes`);
  } catch (error) {
    console.error('❌ Error loading EFM cache:', error);
    // Don't throw - allow function to continue with stale cache or empty cache
  }
}

// Initialize cache on module load
loadEFMCache().catch(err => console.error('❌ Failed to initialize EFM cache:', err));

// Set up periodic cache refresh
setInterval(() => {
  console.log('🔄 Refreshing EFM cache...');
  loadEFMCache().catch(err => console.error('❌ Failed to refresh EFM cache:', err));
}, CACHE_REFRESH_INTERVAL_MS);

// CORS middleware
const setCorsHeaders = (res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
};

// EFM Box Assignment Webhook - Separate from SuperHeroBoard
// Now stores to queue instead of processing immediately
exports.efmBoxAssignmentWebhook = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const data = req.body;
    console.log('📥 Received EFM box assignment webhook:', {
      type: data.webhook_type,
      orderNumber: data.order_number,
      accountId: data.account_id,
      timestamp: new Date().toISOString()
    });

    try {
      // Store webhook to queue immediately (lossless processing)
      const queueRef = await db.collection('efm_webhook_queue').add({
        webhook_data: data,
        order_id: data.order_id || null,
        order_number: data.order_number || null,
        status: 'pending',
        priority: Date.now(), // FIFO ordering (lower = earlier)
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        result: null
      });

      console.log(`✅ Webhook queued for order ${data.order_number} (queue ID: ${queueRef.id})`);
      res.status(200).send('OK');
    } catch (error) {
      console.error(`❌ Error queuing EFM box assignment webhook:`, error);
      res.status(500).send('Internal Server Error');
    }
  });
});

// EFM Box Assignment Processing
async function processEFMBoxAssignment(webhookData) {
  const logCollection = db.collection('efm_box_assignments');
  const startTime = Date.now();

  // Helper function to log to Firestore
  const logResult = async (result) => {
    try {
      await logCollection.add({
        ...result,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Failed to log to Firestore:', error);
    }
  };

  // Early validation
  if (!webhookData.order_id || !webhookData.order_number) {
    const error = 'Missing required fields: order_id or order_number';
    console.error(`❌ EFM Box Assignment Error for ${webhookData.order_number}: ${error}`);
    await logResult({
      order_number: webhookData.order_number || 'unknown',
      order_id: webhookData.order_id || null,
      success: false,
      error: error,
      processingTimeMs: Date.now() - startTime
    });
    throw new Error(error);
  }

  // Skip orders with "retain" in order number (case-insensitive)
  if (webhookData.order_number && webhookData.order_number.toLowerCase().includes('retain')) {
    console.log(`⏭️ Skipping order ${webhookData.order_number} - contains "retain"`);
    await logResult({
      order_number: webhookData.order_number,
      order_id: webhookData.order_id,
      success: false,
      error: 'Order number contains "retain" - skipping processing',
      processingTimeMs: Date.now() - startTime
    });
    return;
  }

  if (!webhookData.line_items || !Array.isArray(webhookData.line_items) || webhookData.line_items.length === 0) {
    const error = 'No line items found in order';
    console.error(`❌ EFM Box Assignment Error for ${webhookData.order_number}: ${error}`);
    await logResult({
      order_number: webhookData.order_number,
      order_id: webhookData.order_id,
      success: false,
      error: error,
      processingTimeMs: Date.now() - startTime
    });
    return;
  }

  console.log(`📦 Processing EFM box assignment for order ${webhookData.order_number}`);

  try {
    // Ensure cache is loaded (refresh if needed or on first use)
    if (!efmProductsCache || !boxSizesCache || !cacheLastUpdated) {
      console.log('🔄 Cache not initialized, loading now...');
      await loadEFMCache();
    } else {
      // Check if cache is stale (older than refresh interval)
      const cacheAge = Date.now() - cacheLastUpdated;
      if (cacheAge > CACHE_REFRESH_INTERVAL_MS) {
        console.log(`🔄 Cache is stale (${Math.round(cacheAge / 1000)}s old), refreshing...`);
        // Refresh in background, but use current cache for this request
        loadEFMCache().catch(err => console.error('❌ Background cache refresh failed:', err));
      }
    }

    const products = efmProductsCache || [];
    const boxSizes = boxSizesCache || [];

    // Check if collections are empty
    if (products.length === 0) {
      const error = 'EFM products collection is empty';
      console.error(`❌ EFM Box Assignment Error for ${webhookData.order_number}: ${error}`);
      await logResult({
        order_number: webhookData.order_number,
        order_id: webhookData.order_id,
        success: false,
        error: error,
        processingTimeMs: Date.now() - startTime
      });
      throw new Error(error);
    }

    if (boxSizes.length === 0) {
      const error = 'Box sizes collection is empty';
      console.error(`❌ EFM Box Assignment Error for ${webhookData.order_number}: ${error}`);
      await logResult({
        order_number: webhookData.order_number,
        order_id: webhookData.order_id,
        success: false,
        error: error,
        processingTimeMs: Date.now() - startTime
      });
      throw new Error(error);
    }

    // Calculate total size
    let totalSize = 0;
    const lineItemDetails = [];
    const missingSKUs = [];
    const DEFAULT_SKU_SIZE = 1; // Default size for missing SKUs

    for (const lineItem of webhookData.line_items) {
      const sku = lineItem.sku;
      const quantity = lineItem.quantity || 1;

      const product = products.find(p => p.sku === sku);

      let itemSize;
      let usingDefault = false;

      if (!product) {
        // Use default value of 1 for missing SKUs
        itemSize = DEFAULT_SKU_SIZE;
        usingDefault = true;
        missingSKUs.push(sku);
        console.warn(`⚠️ SKU ${sku} not found in EFM products table, using default size of ${DEFAULT_SKU_SIZE}`);
      } else {
        itemSize = parseFloat(product.value) || 0;
      }

      const itemTotalSize = itemSize * quantity;
      totalSize += itemTotalSize;

      lineItemDetails.push({
        sku: sku,
        quantity: quantity,
        unitSize: itemSize,
        totalSize: itemTotalSize,
        usingDefault: usingDefault // Flag to indicate default was used
      });
    }

    // Log warning if any SKUs used default values, but don't fail the order
    if (missingSKUs.length > 0) {
      console.warn(`⚠️ Order ${webhookData.order_number} contains ${missingSKUs.length} missing SKU(s) using default size: ${missingSKUs.join(', ')}`);
    }

    // Select box size
    const sortedBoxes = [...boxSizes].sort((a, b) =>
      parseFloat(a.maxProductSize) - parseFloat(b.maxProductSize)
    );

    let selectedBox = sortedBoxes.find(box =>
      parseFloat(box.maxProductSize) >= totalSize
    );

    if (!selectedBox) {
      selectedBox = sortedBoxes[sortedBoxes.length - 1];
    }

    // Determine box_name for mutation (singles -> Envelope)
    const boxSizeValue = selectedBox.boxSize || '';
    const boxName = boxSizeValue.toLowerCase() === 'singles' ? 'Envelope' : boxSizeValue;
    // fulfillment_status uses original boxSizeValue, not the converted boxName
    const fulfillmentStatus = `EFM - ${boxSizeValue}`;

    console.log(`📦 Order ${webhookData.order_number}: Total size: ${totalSize}, Selected box: ${boxSizeValue}, Box name: ${boxName}, Fulfillment status: ${fulfillmentStatus}`);

    // Send GraphQL mutation with smart retry
    // Using GraphQL variables to prevent injection vulnerabilities
    const mutationBody = {
      query: `
        mutation($orderId: String!, $boxName: String!, $fulfillmentStatus: String!) {
          order_update(data: {
            order_id: $orderId
            box_name: $boxName
            fulfillment_status: $fulfillmentStatus
          }) {
            request_id
          }
        }
      `,
      variables: {
        orderId: String(webhookData.order_id),
        boxName: boxName,
        fulfillmentStatus: fulfillmentStatus
      }
    };

    const retryDelays = [15000, 30000, 60000]; // 15s, 30s, 60s
    let lastError = null;
    let requestId = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        // Small delay to prevent hitting ShipHero rate limits during bursts
        // Only delay on first attempt (not on retries, which already have longer delays)
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
        
        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${functions.config().shiphero.api_token}`
          },
          body: JSON.stringify(mutationBody)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.errors) {
          const error = data.errors[0];
          const errorMessage = error?.message || 'Unknown GraphQL error';
          const errorCode = error?.code; // ShipHero uses numeric codes (e.g., 5 = NOT_FOUND)

          // Don't retry validation/auth errors (check error code, not HTTP status)
          // GraphQL errors often come with HTTP 200, so we check the error code instead
          // Common ShipHero error codes: 5 = NOT_FOUND, 3 = VALIDATION_ERROR, etc.
          const nonRetryableCodes = [3, 5]; // 3 = VALIDATION_ERROR, 5 = NOT_FOUND
          if (errorCode && nonRetryableCodes.includes(errorCode)) {
            throw new Error(`GraphQL validation error: ${errorMessage}`);
          }

          // Retry other errors (server errors, network issues, unknown errors)
          throw new Error(`GraphQL error: ${errorMessage}`);
        }

        requestId = data.data?.order_update?.request_id || null;
        console.log(`✅ Successfully updated order ${webhookData.order_number} with box ${boxName} (request_id: ${requestId})`);
        break; // Success, exit retry loop

      } catch (error) {
        lastError = error;

        // Don't retry if it's a validation/auth error (4xx)
        if (error.message.includes('validation error') || error.message.includes('auth')) {
          console.error(`❌ Non-retryable error for order ${webhookData.order_number}:`, error.message);
          break;
        }

        if (attempt < retryDelays.length) {
          const delay = retryDelays[attempt];
          console.log(`⚠️ Attempt ${attempt + 1} failed for order ${webhookData.order_number}, retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`❌ All retry attempts failed for order ${webhookData.order_number}:`, error.message);
        }
      }
    }

    // Log result
    if (requestId) {
      await logResult({
        order_number: webhookData.order_number,
        order_id: webhookData.order_id,
        success: true,
        totalSize: totalSize,
        selectedBox: boxSizeValue,
        boxName: boxName,
        fulfillmentStatus: fulfillmentStatus,
        requestId: requestId,
        lineItemDetails: lineItemDetails,
        missingSKUs: missingSKUs.length > 0 ? missingSKUs : undefined, // Track SKUs that used default values
        processingTimeMs: Date.now() - startTime
      });
    } else {
      const error = lastError?.message || 'Unknown error';
      await logResult({
        order_number: webhookData.order_number,
        order_id: webhookData.order_id,
        success: false,
        error: error,
        totalSize: totalSize,
        selectedBox: boxSizeValue,
        boxName: boxName,
        fulfillmentStatus: fulfillmentStatus,
        retryAttempts: retryDelays.length + 1,
        processingTimeMs: Date.now() - startTime
      });
      // Throw error so queue processor knows it failed
      throw new Error(error);
    }

  } catch (error) {
    console.error(`❌ Unexpected error processing EFM box assignment for ${webhookData.order_number}:`, error);
    await logResult({
      order_number: webhookData.order_number,
      order_id: webhookData.order_id,
      success: false,
      error: error.message || 'Unexpected error',
      processingTimeMs: Date.now() - startTime
    });
    // Re-throw error so queue processor can handle it
    throw error;
  }
}

// EFM Queue Processor - Processes queue items one at a time with delays
// Triggered by Firestore document creation or scheduled function
exports.processEFMQueue = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const PROCESSING_DELAY_MS = 1000; // 1 second delay between items
    const MAX_ATTEMPTS = 3;

    try {
      console.log('🔄 Starting EFM queue processing...');

      // Find next pending item (FIFO - oldest first)
      // Only pick up items that are ready for retry (retryAfter is null or in the past)
      const now = admin.firestore.Timestamp.now();
      const pendingSnapshot = await db.collection('efm_webhook_queue')
        .where('status', '==', 'pending')
        .orderBy('priority', 'asc')
        .limit(1)
        .get();
      
      // Filter out items that have retryAfter set in the future
      const readyItems = pendingSnapshot.docs.filter(doc => {
        const data = doc.data();
        const retryAfter = data.retryAfter;
        return !retryAfter || retryAfter.toMillis() <= now.toMillis();
      });
      
      if (readyItems.length === 0) {
        console.log('✅ No pending items ready for processing (some may be waiting for retry)');
        res.status(200).json({ message: 'No pending items ready', processed: 0 });
        return;
      }
      
      const queueItem = readyItems[0];
      const queueData = queueItem.data();
      const queueId = queueItem.id;

      // Validate queue item structure
      const validation = validateQueueItem(queueData, queueId);
      if (!validation.valid) {
        console.error(`❌ Invalid queue item ${queueId}: ${validation.error}`);
        // Mark as failed immediately - corrupted data shouldn't be retried
        await queueItem.ref.update({
          status: 'failed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: validation.error,
          result: { success: false, error: validation.error, corrupted: true }
        });
        res.status(200).json({
          message: 'Queue item marked as failed (corrupted)',
          queueId: queueId,
          error: validation.error
        });
        return;
      }

      console.log(`📦 Processing queue item ${queueId} for order ${queueData.order_number}`);

      // Mark as processing
      await queueItem.ref.update({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: (queueData.attempts || 0) + 1,
        retryAfter: null // Clear retryAfter since we're processing it now
      });

      // Process the webhook (already validated above)
      const webhookData = queueData.webhook_data;
      let processingResult = null;
      let processingError = null;

      try {
        // Call the existing processing function
        await processEFMBoxAssignment(webhookData);
        processingResult = { success: true };
      } catch (error) {
        processingError = error.message || 'Unknown error';
        console.error(`❌ Error processing queue item ${queueId}:`, error);
      }

      // Update queue item with result
      if (processingResult && processingResult.success) {
        await queueItem.ref.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: processingResult
        });
        console.log(`✅ Queue item ${queueId} completed successfully`);
      } else {
        // Check if we should retry or mark as failed
        const attempts = (queueData.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await queueItem.ref.update({
            status: 'failed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: processingError,
            result: { success: false, error: processingError }
          });
          console.log(`❌ Queue item ${queueId} failed after ${attempts} attempts`);
          
          // Send failure notification
          await sendSlackFailureNotification(queueData, queueId, processingError, attempts);
        } else {
          // Retry - mark as pending again but set retryAfter to prevent immediate retry in same run
          const retryAfterTime = new Date(Date.now() + 60000); // 1 minute from now
          await queueItem.ref.update({
            status: 'pending',
            startedAt: null,
            lastError: processingError,
            retryAfter: admin.firestore.Timestamp.fromDate(retryAfterTime)
          });
          console.log(`🔄 Queue item ${queueId} will be retried (attempt ${attempts}/${MAX_ATTEMPTS}) after ${retryAfterTime.toLocaleTimeString()}`);
        }
      }

      res.status(200).json({
        message: 'Queue item processed',
        queueId: queueId,
        orderNumber: queueData.order_number,
        success: processingResult && processingResult.success
      });

    } catch (error) {
      console.error('❌ Error in queue processor:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Scheduled function to process queue continuously
// Runs every minute and processes 5 items with delays between them (5 orders/minute)
exports.processEFMQueueScheduled = functions.pubsub.schedule('* * * * *').onRun(async (context) => {
  const PROCESSING_DELAY_MS = 1000; // 1 second delay between items
  const MAX_ITEMS_PER_RUN = 5; // Process up to 5 items per scheduled run (5 orders/minute)
  const MAX_ATTEMPTS = 3;

  try {
    console.log('🔄 Scheduled queue processing triggered');

    let processedCount = 0;
    let hasMoreItems = true;

    // Process multiple items in sequence with delays
    while (hasMoreItems && processedCount < MAX_ITEMS_PER_RUN) {
      // Find next pending item (FIFO - oldest first)
      // Only pick up items that are ready for retry (retryAfter is null or in the past)
      const now = admin.firestore.Timestamp.now();
      const pendingSnapshot = await db.collection('efm_webhook_queue')
        .where('status', '==', 'pending')
        .orderBy('priority', 'asc')
        .limit(1)
        .get();
      
      // Filter out items that have retryAfter set in the future
      const readyItems = pendingSnapshot.docs.filter(doc => {
        const data = doc.data();
        const retryAfter = data.retryAfter;
        return !retryAfter || retryAfter.toMillis() <= now.toMillis();
      });
      
      if (readyItems.length === 0) {
        console.log('✅ No pending items ready for processing (some may be waiting for retry)');
        hasMoreItems = false;
        break;
      }
      
      const queueItem = readyItems[0];
      const queueData = queueItem.data();
      const queueId = queueItem.id;

      // Validate queue item structure
      const validation = validateQueueItem(queueData, queueId);
      if (!validation.valid) {
        console.error(`❌ Invalid queue item ${queueId}: ${validation.error}`);
        // Mark as failed immediately - corrupted data shouldn't be retried
        await queueItem.ref.update({
          status: 'failed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastError: validation.error,
          result: { success: false, error: validation.error, corrupted: true }
        });
        // Continue to next item instead of breaking
        processedCount++;
        continue;
      }

      console.log(`📦 Processing queue item ${queueId} for order ${queueData.order_number} (${processedCount + 1}/${MAX_ITEMS_PER_RUN})`);

      // Mark as processing
      await queueItem.ref.update({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: (queueData.attempts || 0) + 1,
        retryAfter: null // Clear retryAfter since we're processing it now
      });

      // Process the webhook (already validated above)
      const webhookData = queueData.webhook_data;
      let processingResult = null;
      let processingError = null;

      try {
        // Call the existing processing function
        await processEFMBoxAssignment(webhookData);
        processingResult = { success: true };
      } catch (error) {
        processingError = error.message || 'Unknown error';
        console.error(`❌ Error processing queue item ${queueId}:`, error);
      }

      // Update queue item with result
      if (processingResult && processingResult.success) {
        await queueItem.ref.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: processingResult
        });
        console.log(`✅ Queue item ${queueId} completed successfully`);
      } else {
        // Check if we should retry or mark as failed
        const attempts = (queueData.attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await queueItem.ref.update({
            status: 'failed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: processingError,
            result: { success: false, error: processingError }
          });
          console.log(`❌ Queue item ${queueId} failed after ${attempts} attempts`);
          
          // Send failure notification
          await sendSlackFailureNotification(queueData, queueId, processingError, attempts);
        } else {
          // Retry - mark as pending again but set retryAfter to prevent immediate retry in same run
          const retryAfterTime = new Date(Date.now() + 60000); // 1 minute from now
          await queueItem.ref.update({
            status: 'pending',
            startedAt: null,
            lastError: processingError,
            retryAfter: admin.firestore.Timestamp.fromDate(retryAfterTime)
          });
          console.log(`🔄 Queue item ${queueId} will be retried (attempt ${attempts}/${MAX_ATTEMPTS}) after ${retryAfterTime.toLocaleTimeString()}`);
        }
      }

      processedCount++;

      // Add delay before processing next item (except for the last one)
      if (hasMoreItems && processedCount < MAX_ITEMS_PER_RUN) {
        console.log(`⏳ Waiting ${PROCESSING_DELAY_MS}ms before next item...`);
        await new Promise(resolve => setTimeout(resolve, PROCESSING_DELAY_MS));
      }
    }

    console.log(`✅ Queue processing complete: processed ${processedCount} items`);
    return null;
  } catch (error) {
    console.error('❌ Error in scheduled queue processor:', error);
    return null;
  }
});

// Recovery function for stuck items in "processing" state
// Runs every 10 minutes to find and reset items stuck in processing
exports.recoverStuckQueueItems = functions.pubsub.schedule('*/10 * * * *').onRun(async (context) => {
  const STUCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes - items stuck longer than this will be recovered
  const STUCK_TIMEOUT_SECONDS = STUCK_TIMEOUT_MS / 1000;

  try {
    console.log('🔍 Starting recovery scan for stuck queue items...');

    // Get current timestamp
    const now = admin.firestore.Timestamp.now();
    const cutoffTime = new Date(now.toMillis() - STUCK_TIMEOUT_MS);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);

    // Find all items stuck in "processing" state
    const stuckSnapshot = await db.collection('efm_webhook_queue')
      .where('status', '==', 'processing')
      .get();

    let recoveredCount = 0;
    const itemsToRecover = [];

    // Collect items that need recovery
    stuckSnapshot.forEach((doc) => {
      const data = doc.data();
      const startedAt = data.startedAt;

      // Check if startedAt exists and is older than cutoff
      if (startedAt && startedAt.toMillis() < cutoffTimestamp.toMillis()) {
        const ageMinutes = Math.round((now.toMillis() - startedAt.toMillis()) / 60000);
        itemsToRecover.push({
          doc: doc,
          orderNumber: data.order_number || 'Unknown',
          ageMinutes: ageMinutes,
          reason: 'stuck'
        });
      } else if (!startedAt) {
        // Item marked as processing but has no startedAt timestamp - recover it
        itemsToRecover.push({
          doc: doc,
          orderNumber: data.order_number || 'Unknown',
          ageMinutes: null,
          reason: 'missing_startedAt'
        });
      }
    });

    // Process in batches (Firestore batch limit is 500 operations)
    const BATCH_SIZE = 500;
    for (let i = 0; i < itemsToRecover.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const batchItems = itemsToRecover.slice(i, i + BATCH_SIZE);

      for (const item of batchItems) {
        if (item.reason === 'stuck') {
          console.log(`🔄 Recovering stuck item ${item.doc.id} for order ${item.orderNumber} (stuck for ${item.ageMinutes} minutes)`);
        } else {
          console.log(`🔄 Recovering stuck item ${item.doc.id} for order ${item.orderNumber} (missing startedAt)`);
        }

        // Reset to pending for retry
        batch.update(item.doc.ref, {
          status: 'pending',
          startedAt: null,
          // Keep lastError so we know what happened
          // Don't increment attempts - this is recovery, not a retry
        });

        recoveredCount++;
      }

      // Commit this batch
      if (batchItems.length > 0) {
        await batch.commit();
        console.log(`✅ Committed batch: ${batchItems.length} items recovered (${recoveredCount}/${itemsToRecover.length} total)`);
      }
    }

    if (recoveredCount > 0) {
      console.log(`✅ Recovery complete: ${recoveredCount} stuck queue item(s) recovered`);
    } else {
      console.log('✅ No stuck items found');
    }

    return null;
  } catch (error) {
    console.error('❌ Error in recovery function:', error);
    return null;
  }
});

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
      console.log('📦 getFillRate function started - calling ShipHero with pagination...');
      
      // Initialize variables for pagination
      let allProblemOrders = [];
      let hasNextPage = true;
      let cursor = null;
      const pageSize = 10; // Keep at 10 for rate limiting purposes
      let pageCount = 0;
      
      // Paginate through all problem orders
      while (hasNextPage) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount} of problem orders...`);
        
        const queryBody = {
          query: `
            query GetProblemOrders($first: Int!, $after: String) {
              orders(tag: "problem") {
                data(first: $first, after: $after) {
                  edges {
                    node {
                      order_number
                      required_ship_date
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `,
          variables: {
            first: pageSize,
            after: cursor
          }
        };

        console.log(`📡 Making ShipHero API call for page ${pageCount}...`);
        
        // Add timeout to ShipHero API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`⏰ ShipHero API call timed out after 8 seconds on page ${pageCount}`);
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
        console.log(`📥 ShipHero API responded with status: ${response.status} for page ${pageCount}`);

        if (!response.ok) {
          console.error(`❌ ShipHero API Error on page ${pageCount}:`, response.status, response.statusText);
          res.status(500).json({
            success: false,
            error: `ShipHero API error: ${response.status}`
          });
          return;
        }

        const data = await response.json();
        console.log(`📥 ShipHero fill rate response received for page ${pageCount}`);

        if (data.errors) {
          console.error(`❌ GraphQL Errors on page ${pageCount}:`, data.errors);
          res.status(500).json({
            success: false,
            error: 'GraphQL errors',
            details: data.errors
          });
          return;
        }

        // Add orders from this page
        const pageOrders = data?.data?.orders?.data?.edges || [];
        allProblemOrders = allProblemOrders.concat(pageOrders);
        
        console.log(`📄 Page ${pageCount}: Got ${pageOrders.length} orders, total so far: ${allProblemOrders.length}`);
        
        // Check if there are more pages
        hasNextPage = data?.data?.orders?.data?.pageInfo?.hasNextPage || false;
        cursor = data?.data?.orders?.data?.pageInfo?.endCursor || null;
        
        // Add a delay between pages to avoid overwhelming the API
        if (hasNextPage) {
          console.log(`⏳ Waiting 1 second before fetching next page...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ Pagination complete: Fetched ${allProblemOrders.length} total problem orders across ${pageCount} pages`);

      // Get today's date in Eastern timezone
      const todayEastern = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const todayDate = new Date(todayEastern);
      const todayStr = todayDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`📅 Today's date (Eastern): ${todayEastern} (${todayStr})`);
      
      // Get fill rate issues from our tracking collection
      const fillRateIssuesSnapshot = await db.collection('fill_rate_issues').get();
      const trackedIssueNumbers = new Set();
      
      fillRateIssuesSnapshot.forEach(doc => {
        const issueData = doc.data();
        // Only count issues that were first detected today or are still active
        if (issueData.first_detected_date === todayStr) {
          trackedIssueNumbers.add(issueData.order_number);
        }
      });
      
      console.log(`📊 Found ${trackedIssueNumbers.size} active fill rate issues for today from tracking collection`);
      
      // Filter problem orders to only include NEW issues (not in our tracking collection)
      const newProblemOrders = allProblemOrders.filter(edge => {
        const order = edge.node;
        if (!order.required_ship_date) return false;
        
        const requiredDate = new Date(order.required_ship_date);
        const requiredDateStr = requiredDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const requiredDateObj = new Date(requiredDateStr);
        
        // Only include if required ship date is today or before (ignore future)
        if (requiredDateObj > todayDate) return false;
        
        // Only include if this order number is NOT in our tracking collection
        return !trackedIssueNumbers.has(order.order_number);
      });

      console.log(`🚨 Found ${newProblemOrders.length} NEW problem orders due today/overdue out of ${allProblemOrders.length} total problem orders`);
      console.log(`📊 Total active fill rate issues for today: ${trackedIssueNumbers.size + newProblemOrders.length}`);

      res.status(200).json({
        success: true,
        data: {
          problemOrdersCount: newProblemOrders.length,
          totalProblemOrders: allProblemOrders.length,
          trackedIssuesCount: trackedIssueNumbers.size,
          totalActiveIssues: trackedIssueNumbers.size + newProblemOrders.length,
          pagesFetched: pageCount,
          problemOrders: newProblemOrders.map(edge => ({
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
            pagesFetched: 0,
            problemOrders: [],
            fallback: true,
            reason: 'ShipHero API timeout'
          }
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fill rate',
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

// Gmail Response Time Analyzer - calculates response time metrics for business hours
exports.analyzeGmailResponseTimes = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { userEmail, date } = req.body;
      
      if (!userEmail) {
        res.status(400).json({
          success: false,
          error: 'userEmail is required'
        });
        return;
      }

      // Use provided date or default to today
      let targetDate;
      if (date) {
        // Parse the date string properly (YYYY-MM-DD format)
        const [year, month, day] = date.split('-').map(Number);
        // Create date at midnight Eastern time
        // Use a specific time that will be interpreted as Eastern time
        const easternDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00-04:00`;
        targetDate = new Date(easternDateStr);
      } else {
        targetDate = new Date();
      }
      
      // Convert to Eastern timezone string for display
      const targetDateStr = targetDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      
      console.log(`📧 Analyzing Gmail response times for ${userEmail} on ${targetDateStr}`);
      console.log(`📧 Target Date Object: ${targetDate.toISOString()}`);

      // Initialize Gmail API client
      const { google } = require('googleapis');
      
      // Read private key directly from JSON file to avoid Firebase config escaping issues
      const fs = require('fs');
      const path = require('path');
      const keyFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'superheroboardv2-22da6951042a.json'), 'utf8'));
      
      const auth = new google.auth.JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly'
        ],
        subject: userEmail
      });

      const gmail = google.gmail({ version: 'v1', auth });

      // Get emails from the target date (business hours: 8 AM - 3 PM Eastern)
      // Create dates in Eastern timezone by properly handling timezone conversion
      const startTime = new Date(targetDate);
      startTime.setHours(8, 0, 0, 0); // Set to 8 AM in local time
      
      const endTime = new Date(targetDate);
      endTime.setHours(15, 0, 0, 0); // Set to 3 PM in local time

      // Convert to RFC 3339 format for Gmail API
      const startTimeRFC = startTime.toISOString();
      const endTimeRFC = endTime.toISOString();

      console.log(`⏰ Business hours: ${startTime.toLocaleString('en-US', {timeZone: 'America/New_York'})} to ${endTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);

      // First, let's test a simple search without date restrictions
      console.log(`🔍 Testing simple search first...`);
      const simpleResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10 // Just get a few emails to test
      });
      
      console.log(`🔍 Simple Search Response:`, JSON.stringify(simpleResponse.data, null, 2));
      
      // Now try the date-restricted search with Gmail-compatible format
      // Gmail prefers YYYY/MM/DD format over RFC 3339 timestamps
      // Use the full day: after:2025/08/14 before:2025/08/15
      const startDate = startTime.toISOString().split('T')[0].replace(/-/g, '/');
      const endDate = new Date(startTime);
      endDate.setDate(endDate.getDate() + 1); // Next day
      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
      
      // Filter for emails sent FROM the user (responses only)
      const query = `after:${startDate} before:${endDateStr} from:${userEmail}`;
      
      console.log(`🔍 Gmail Search Query: "${query}"`);
      console.log(`🔍 Start Date: ${startDate}`);
      console.log(`🔍 End Date: ${endDate}`);
      
      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100 // Adjust as needed
      });

      const messages = messagesResponse.data.messages || [];
      console.log(`📥 Found ${messages.length} total responses from ${userEmail} for the day`);
      
      // Log the full Gmail API response for debugging
      console.log(`🔍 Gmail API Response:`, JSON.stringify(messagesResponse.data, null, 2));

      if (messages.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            userEmail,
            date: targetDateStr,
            totalResponses: 0,
            respondedWithin4Hours: 0,
            responseRate: 100,
            averageResponseTime: 0,
            details: []
          }
        });
        return;
      }

      // Filter responses to only include those sent during business hours (8 AM - 3 PM EST)
      const businessHoursResponses = [];
      console.log(`🔍 Filtering ${messages.length} responses for business hours (8 AM - 3 PM EST)...`);
      
      for (const message of messages) {
        try {
          // Get message details to check the sent time
          const messageDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Date', 'Subject', 'In-Reply-To', 'References']
          });
          
          const headers = messageDetails.data.payload.headers;
          const dateHeader = headers.find(h => h.name === 'Date');
          
          if (dateHeader) {
            const sentTime = new Date(dateHeader.value);
            const sentTimeEST = new Date(sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'}));
            
            // Check if sent during business hours (8 AM - 3 PM EST)
            const hour = sentTimeEST.getHours();
            if (hour >= 8 && hour < 15) { // 8 AM to 2:59 PM (before 3 PM)
              businessHoursResponses.push({
                message,
                sentTime,
                headers
              });
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not process message ${message.id}:`, error.message);
        }
      }
      
      console.log(`📥 Found ${businessHoursResponses.length} responses during business hours (8 AM - 3 PM EST)`);
      
      if (businessHoursResponses.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            userEmail,
            date: targetDateStr,
            totalResponses: 0,
            respondedWithin4Hours: 0,
            responseRate: 100,
            averageResponseTime: 0,
            details: []
          }
        });
        return;
      }

      // Analyze response times for each response (only business hours responses)
      const responseAnalysis = [];
      let respondedWithin4HoursCount = 0;
      let totalResponseTime = 0; // Track total response time for average calculation

      for (const { message, sentTime, headers } of businessHoursResponses) {
        try {
          // Get the subject to find the thread
          const subjectHeader = headers.find(h => h.name === 'Subject');
          const subject = subjectHeader ? subjectHeader.value : '';
          
          console.log(`📧 Analyzing response with subject: "${subject}" sent at ${sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          
          // Get the thread ID for this message
          const messageDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Date', 'Subject', 'Thread-ID']
          });
          
          const threadId = messageDetails.data.threadId;
          console.log(`🔍 Thread ID: ${threadId}`);
          
          // Get all messages in this thread
          const threadResponse = await gmail.users.threads.get({
            userId: 'me',
            id: threadId
          });
          
          const threadMessages = threadResponse.data.messages || [];
          console.log(`📧 Found ${threadMessages.length} messages in thread`);
          
          let latestMessageTime = null;
          
          // Find the latest message in the thread that was sent before Kristen's response
          for (const threadMessage of threadMessages) {
            try {
              // Skip Kristen's own messages
              const fromHeader = threadMessage.payload.headers.find(h => h.name === 'From');
              if (fromHeader && fromHeader.value.toLowerCase().includes(userEmail.toLowerCase())) {
                continue;
              }
              
              const dateHeader = threadMessage.payload.headers.find(h => h.name === 'Date');
              if (dateHeader) {
                const threadMessageTime = new Date(dateHeader.value);
                
                // Only count messages from today (same day as Kristen's response)
                const threadMessageDate = threadMessageTime.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                const sentTimeDate = sentTime.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                
                if (threadMessageDate === sentTimeDate && threadMessageTime < sentTime && (!latestMessageTime || threadMessageTime > latestMessageTime)) {
                  latestMessageTime = threadMessageTime;
                  console.log(`✅ Found previous message at ${threadMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
                }
              }
            } catch (error) {
              console.log(`⚠️ Could not process thread message:`, error.message);
            }
          }
          
          // If no previous message found, this is either a thread Kristen started or she's responding to herself
          if (!latestMessageTime) {
            console.log(`⚠️ No previous message found - likely thread started by ${userEmail} or self-response`);
            continue; // Skip this response
          }
          
          // Push early messages to 8 AM (if message was sent before 8 AM, count it as 8 AM)
          const eightAM = new Date(sentTime);
          eightAM.setHours(8, 0, 0, 0);
          
          const effectiveMessageTime = latestMessageTime < eightAM ? eightAM : latestMessageTime;
          
          const responseTimeHours = (sentTime - effectiveMessageTime) / (1000 * 60 * 60);
          const respondedWithin4Hours = responseTimeHours <= 4;
          
          console.log(`✅ Response time: ${responseTimeHours.toFixed(2)} hours (${respondedWithin4Hours ? 'within' : 'over'} 4 hours)`);
          console.log(`    📧 Previous message: ${latestMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    📧 Effective message time: ${effectiveMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    📧 Kristen's response: ${sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    ⏰ Time difference: ${responseTimeHours.toFixed(2)} hours`);
          
          responseAnalysis.push({
            subject: subject,
            sentTime: sentTime.toISOString(),
            responseTimeHours: responseTimeHours,
            respondedWithin4Hours: respondedWithin4Hours,
            previousMessageTime: latestMessageTime.toISOString(),
            effectiveMessageTime: effectiveMessageTime.toISOString()
          });
          
          if (respondedWithin4Hours) {
            respondedWithin4HoursCount++;
          }
          totalResponseTime += responseTimeHours;

        } catch (messageError) {
          console.log(`⚠️ Error analyzing response ${message.id}:`, messageError.message);
        }
      }

      // Calculate metrics
      const totalResponses = responseAnalysis.length;
      const responseRate = totalResponses > 0 ? Math.round((respondedWithin4HoursCount / totalResponses) * 100 * 10) / 10 : 100;
      
      const averageResponseTime = totalResponses > 0 
        ? Math.round((totalResponseTime / totalResponses) * 10) / 10
        : 0;

      console.log(`📊 Analysis complete: ${respondedWithin4HoursCount}/${totalResponses} responses sent within 4 hours (${responseRate}%)`);

      res.status(200).json({
        success: true,
        data: {
          userEmail,
          date: targetDateStr,
          totalResponses,
          respondedWithin4Hours: respondedWithin4HoursCount,
          responseRate,
          averageResponseTime,
          details: responseAnalysis
        }
      });

    } catch (error) {
      console.error('❌ Error analyzing Gmail response times:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze Gmail response times',
        details: error.message
      });
    }
  });
});

// Scheduled function to collect daily Gmail response time data
exports.collectDailyGmailResponseTime = functions.pubsub.schedule('0 0 * * *').timeZone('America/New_York').onRun(async (context) => {
  try {
    console.log('📧 Starting daily Gmail response time collection for Kristen...');
    
    // Get yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Create date in Eastern timezone for consistent handling
    const [year, month, day] = dateStr.split('-').map(Number);
    const easternDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00-04:00`;
    const targetDate = new Date(easternDateStr);
    
    console.log(`📅 Analyzing Gmail response times for ${dateStr}`);
    
    // Call the Gmail analyzer function for yesterday
    const { userEmail, date } = {
      userEmail: 'kristen@ecoship.com',
      date: dateStr
    };
    
    // Initialize Gmail API client
    const { google } = require('googleapis');
    const fs = require('fs');
    const path = require('path');
    const keyFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'superheroboardv2-22da6951042a.json'), 'utf8'));
    
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      subject: userEmail
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Create dates for the full day in YYYY/MM/DD format for Gmail API
    const startDate = dateStr.replace(/-/g, '/');
    const endDate = new Date(yesterday);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
    
    // Filter for emails sent FROM the user (responses only)
    const query = `after:${startDate} before:${endDateStr} from:${userEmail}`;
    
    console.log(`🔍 Gmail Search Query: "${query}"`);
    
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });

    const messages = messagesResponse.data.messages || [];
    console.log(`📥 Found ${messages.length} total responses from ${userEmail} for ${dateStr}`);
    
    if (messages.length === 0) {
      // Store zero results
      await db.collection('gmailResponseTimes').doc(dateStr).set({
        date: dateStr,
        userEmail: userEmail,
        totalResponses: 0,
        respondedWithin4Hours: 0,
        responseRate: 100,
        averageResponseTime: 0,
        collectedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Stored zero results for ${dateStr}`);
      return null;
    }

    // Filter responses to only include those sent during business hours (8 AM - 3 PM EST)
    const businessHoursResponses = [];
    
    for (const message of messages) {
      try {
        const messageDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'metadata',
          metadataHeaders: ['Date', 'Subject']
        });
        
        const headers = messageDetails.data.payload.headers;
        const dateHeader = headers.find(h => h.name === 'Date');
        
        if (dateHeader) {
          const sentTime = new Date(dateHeader.value);
          const sentTimeEST = new Date(sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'}));
          const hour = sentTimeEST.getHours();
          if (hour >= 8 && hour < 15) {
            businessHoursResponses.push({
              message,
              sentTime,
              headers
            });
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not process message ${message.id}:`, error.message);
      }
    }
    
    console.log(`📥 Found ${businessHoursResponses.length} responses during business hours (8 AM - 3 PM EST)`);
    
    if (businessHoursResponses.length === 0) {
      await db.collection('gmailResponseTimes').doc(dateStr).set({
        date: dateStr,
        userEmail: userEmail,
        totalResponses: 0,
        respondedWithin4Hours: 0,
        responseRate: 100,
        averageResponseTime: 0,
        collectedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Stored zero business hours results for ${dateStr}`);
      return null;
    }

    // Analyze response times for each response
    const responseAnalysis = [];
    let respondedWithin4HoursCount = 0;

    for (const { message, sentTime, headers } of businessHoursResponses) {
              try {
          // Get the subject to find the thread
          const subjectHeader = headers.find(h => h.name === 'Subject');
          const subject = subjectHeader ? subjectHeader.value : '';
          
          console.log(`📧 Analyzing response with subject: "${subject}" sent at ${sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          
          // Get the thread ID for this message
          const messageDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Date', 'Subject', 'Thread-ID']
          });
          
          const threadId = messageDetails.data.threadId;
          console.log(`🔍 Thread ID: ${threadId}`);
          
          // Get all messages in this thread
          const threadResponse = await gmail.users.threads.get({
            userId: 'me',
            id: threadId
          });
          
          const threadMessages = threadResponse.data.messages || [];
          console.log(`📧 Found ${threadMessages.length} messages in thread`);
          
          let latestMessageTime = null;
          
          // Find the latest message in the thread that was sent before Kristen's response
          for (const threadMessage of threadMessages) {
            try {
              // Skip Kristen's own messages
              const fromHeader = threadMessage.payload.headers.find(h => h.name === 'From');
              if (fromHeader && fromHeader.value.toLowerCase().includes(userEmail.toLowerCase())) {
                continue;
              }
              
              const dateHeader = threadMessage.payload.headers.find(h => h.name === 'Date');
              if (dateHeader) {
                const threadMessageTime = new Date(dateHeader.value);
                
                // Only count messages from today (same day as Kristen's response)
                const threadMessageDate = threadMessageTime.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                const sentTimeDate = sentTime.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                
                if (threadMessageDate === sentTimeDate && threadMessageTime < sentTime && (!latestMessageTime || threadMessageTime > latestMessageTime)) {
                  latestMessageTime = threadMessageTime;
                  console.log(`✅ Found previous message at ${threadMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
                }
              }
            } catch (error) {
              console.log(`⚠️ Could not process thread message:`, error.message);
            }
          }
          
          // If no previous message found, this is either a thread Kristen started or she's responding to herself
          if (!latestMessageTime) {
            console.log(`⚠️ No previous message found - likely thread started by ${userEmail} or self-response`);
            continue; // Skip this response
          }
          
          // Push early messages to 8 AM (if message was sent before 8 AM, count it as 8 AM)
          const eightAM = new Date(sentTime);
          eightAM.setHours(8, 0, 0, 0);
          
          const effectiveMessageTime = latestMessageTime < eightAM ? eightAM : latestMessageTime;
          
          const responseTimeHours = (sentTime - effectiveMessageTime) / (1000 * 60 * 60);
          const respondedWithin4Hours = responseTimeHours <= 4;
          
          console.log(`✅ Response time: ${responseTimeHours.toFixed(2)} hours (${respondedWithin4Hours ? 'within' : 'over'} 4 hours)`);
          console.log(`    📧 Previous message: ${latestMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    📧 Effective message time: ${effectiveMessageTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    📧 Kristen's response: ${sentTime.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
          console.log(`    ⏰ Time difference: ${responseTimeHours.toFixed(2)} hours`);
          
          responseAnalysis.push({
            subject: subject,
            sentTime: sentTime.toISOString(),
            responseTimeHours: responseTimeHours,
            respondedWithin4Hours: respondedWithin4Hours,
            previousMessageTime: latestMessageTime.toISOString(),
            effectiveMessageTime: effectiveMessageTime.toISOString()
          });
          
          if (respondedWithin4Hours) {
            respondedWithin4HoursCount++;
          }

        } catch (messageError) {
          console.log(`⚠️ Error analyzing response ${message.id}:`, messageError.message);
        }
    }

    // Calculate metrics
    const totalResponses = responseAnalysis.length;
    const responseRate = totalResponses > 0 ? Math.round((respondedWithin4HoursCount / totalResponses) * 100 * 10) / 10 : 100;
    
    const responseTimes = responseAnalysis
      .filter(r => r.responseTimeHours > 0)
      .map(r => r.responseTimeHours);
    
    const averageResponseTime = responseTimes.length > 0 
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : 0;

    console.log(`📊 Analysis complete: ${respondedWithin4HoursCount}/${totalResponses} responses sent within 4 hours (${responseRate}%)`);

    // Store results in Firestore
    await db.collection('gmailResponseTimes').doc(dateStr).set({
      date: dateStr,
      userEmail: userEmail,
      totalResponses,
      respondedWithin4Hours: respondedWithin4HoursCount,
      responseRate,
      averageResponseTime,
      details: responseAnalysis,
      collectedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Successfully stored Gmail response time data for ${dateStr}`);
    return null;

  } catch (error) {
    console.error('❌ Error in daily Gmail response time collection:', error);
    throw error;
  }
});

exports.processBackorders = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    try {
      console.log('🚚 processBackorders function started - processing daily backorders...');
      
      // Clear temporary backorder collection first
      console.log('🧹 Clearing temporary backorder collection...');
      const tempCollectionRef = admin.firestore().collection('tempBackorders');
      const tempSnapshot = await tempCollectionRef.get();
      const deletePromises = tempSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      console.log(`✅ Cleared ${tempSnapshot.docs.length} temporary backorder records`);
      
      // Get tomorrow's date (skip weekends)
      const tomorrow = getNextBusinessDay(new Date());
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log(`📅 Processing backorders for ship date: ${tomorrowStr}`);
      
      let allBackorders = [];
      let hasNextPage = true;
      let cursor = null;
      let pageCount = 0;
      
      // Paginate through all backorders
      while (hasNextPage) {
        pageCount++;
        console.log(`📄 Processing page ${pageCount}...`);
        
        // Build query with cursor if available
        const queryBody = {
          query: `
            query($cursor: String) {
              orders(has_backorder: true) {
                data(first: 20, after: $cursor) {
                  edges {
                    cursor
                    node {
                      order_number
                      id
                    }
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }
            }
          `,
          variables: { cursor: cursor }
        };
        
        console.log(`📡 Making ShipHero API call for page ${pageCount}...`);
        
        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${functions.config().shiphero.api_token}`
          },
          body: JSON.stringify(queryBody)
        });
        
        if (!response.ok) {
          console.error(`❌ ShipHero API Error on page ${pageCount}:`, response.status, response.statusText);
          continue; // Skip this page and continue with next
        }
        
        const data = await response.json();
        
        if (data.errors) {
          console.error(`❌ GraphQL Errors on page ${pageCount}:`, data.errors);
          continue; // Skip this page and continue with next
        }
        
        const orders = data?.data?.orders?.data?.edges || [];
        const pageInfo = data?.data?.orders?.data?.pageInfo || {};
        
        console.log(`📦 Page ${pageCount}: Found ${orders.length} backorders`);
        
        // Store backorders in temporary Firebase collection
        const storePromises = orders.map(async (edge) => {
          const order = edge.node;
          await tempCollectionRef.doc(order.id).set({
            order_number: order.order_number,
            id: order.id,
            cursor: edge.cursor,
            processed: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        
        await Promise.all(storePromises);
        console.log(`💾 Stored ${orders.length} backorders in temporary collection`);
        
        // Update pagination variables
        hasNextPage = pageInfo.hasNextPage || false;
        cursor = orders.length > 0 ? orders[orders.length - 1].cursor : null;
        
        // Add delay between queries to avoid rate limiting
        if (hasNextPage) {
          console.log('⏳ Waiting 2 seconds before next page...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      console.log(`✅ Completed pagination. Total pages: ${pageCount}`);
      
      // Get all stored backorders for processing
      const allBackordersSnapshot = await tempCollectionRef.get();
      const backordersToProcess = allBackordersSnapshot.docs.map(doc => doc.data());
      
      console.log(`🚀 Processing ${backordersToProcess.length} backorders with ship date updates...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Process each backorder with delay
      for (let i = 0; i < backordersToProcess.length; i++) {
        const backorder = backordersToProcess[i];
        
        try {
          console.log(`📝 Updating order ${backorder.order_number} (${i + 1}/${backordersToProcess.length})...`);
          
          const mutationBody = {
            query: `
              mutation {
                order_update(data: {
                  order_id: "${backorder.id}"
                  required_ship_date: "${tomorrowStr}"
                }) {
                  request_id
                }
              }
            `
          };
          
          const updateResponse = await fetch('https://public-api.shiphero.com/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${functions.config().shiphero.api_token}`
            },
            body: JSON.stringify(mutationBody)
          });
          
          if (!updateResponse.ok) {
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
          }
          
          const updateData = await updateResponse.json();
          
          if (updateData.errors) {
            throw new Error(`GraphQL: ${updateData.errors[0].message}`);
          }
          
          // Mark as processed in Firebase
          await tempCollectionRef.doc(backorder.id).update({
            processed: true,
            request_id: updateData.data?.order_update?.request_id || 'unknown',
            processed_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          successCount++;
          console.log(`✅ Successfully updated order ${backorder.order_number}`);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to update order ${backorder.order_number}:`, error.message);
          
          // Mark as failed in Firebase
          await tempCollectionRef.doc(backorder.id).update({
            processed: false,
            error: error.message,
            failed_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        // Add delay between mutations to avoid rate limiting
        if (i < backordersToProcess.length - 1) {
          console.log('⏳ Waiting 1 second before next order...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`🎯 Processing complete! Success: ${successCount}, Errors: ${errorCount}`);
      
      res.status(200).json({
        success: true,
        summary: {
          totalBackorders: backordersToProcess.length,
          successCount,
          errorCount,
          shipDate: tomorrowStr,
          processedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Error in processBackorders:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
});

// Helper function to get next business day (skip weekends)
function getNextBusinessDay(date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Skip weekends
  while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }
  
  return tomorrow;
}

// Scheduled function that runs daily at 8 AM EST
exports.scheduledBackorderProcessing = functions
  .runWith({
    timeoutSeconds: 540,  // 9 minutes timeout (maximum allowed)
    memory: '256MB'
  })
  .pubsub.schedule('0 8 * * 1-5') // 8 AM UTC = 4 AM EDT, 3 AM EST
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🚀 ===== SCHEDULED FUNCTION TRIGGERED =====');
    console.log('⏰ Scheduled backorder processing triggered at:', new Date().toISOString());
    console.log('📍 Function context:', JSON.stringify(context, null, 2));
    console.log('🔧 Function name: scheduledBackorderProcessing');
    console.log('🌍 Current timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    try {
      console.log('✅ Function execution started successfully');
      
      // Call the processBackorders function logic directly
      console.log('🚚 Starting scheduled backorder processing...');
      
      // Test Firebase admin access
      console.log('🔥 Testing Firebase admin access...');
      try {
        const testRef = admin.firestore().collection('test');
        console.log('✅ Firebase admin access successful');
      } catch (firebaseError) {
        console.error('❌ Firebase admin access failed:', firebaseError);
        throw firebaseError;
      }
      
      // Clear temporary backorder collection first
      console.log('🧹 Clearing temporary backorder collection...');
      const tempCollectionRef = admin.firestore().collection('tempBackorders');
      console.log('📁 Collection reference created:', tempCollectionRef.path);
      
      const tempSnapshot = await tempCollectionRef.get();
      console.log(`📊 Found ${tempSnapshot.docs.length} existing temporary records`);
      
      if (tempSnapshot.docs.length > 0) {
        console.log('🗑️ Deleting existing temporary records...');
        const deletePromises = tempSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        console.log(`✅ Successfully cleared ${tempSnapshot.docs.length} temporary backorder records`);
      } else {
        console.log('✨ No existing temporary records to clear');
      }
      
      // Get tomorrow's date (skip weekends)
      console.log('📅 Calculating tomorrow\'s date...');
      const today = new Date();
      console.log('📅 Today\'s date:', today.toISOString());
      console.log('📅 Today\'s day of week:', today.getDay());
      
      const tomorrow = getNextBusinessDay(today);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log(`📅 Tomorrow's calculated date: ${tomorrowStr}`);
      console.log(`📅 Tomorrow's day of week: ${tomorrow.getDay()}`);
      
      // Test ShipHero API token access
      console.log('🔑 Testing ShipHero API token access...');
      try {
        const token = functions.config().shiphero.api_token;
        if (token) {
          console.log('✅ ShipHero API token found (length:', token.length, ')');
          console.log('🔑 Token preview:', token.substring(0, 10) + '...');
        } else {
          console.log('❌ ShipHero API token is undefined or empty');
          throw new Error('ShipHero API token not configured');
        }
      } catch (tokenError) {
        console.error('❌ Error accessing ShipHero API token:', tokenError);
        throw tokenError;
      }
      
      console.log('🚀 Starting pagination through backorders...');
      
      let hasNextPage = true;
      let cursor = null;
      let pageCount = 0;
      let totalBackordersFound = 0;
      
      // Paginate through all backorders
      while (hasNextPage) {
        pageCount++;
        console.log(`📄 ===== PROCESSING PAGE ${pageCount} =====`);
        
        // Build query with cursor if available
        const queryBody = {
          query: `
            query($cursor: String) {
              orders(has_backorder: true) {
                data(first: 20, after: $cursor) {
                  edges {
                    cursor
                    node {
                      order_number
                      id
                    }
                  }
                  pageInfo {
                    hasNextPage
                  }
                }
              }
            }
          `,
          variables: { cursor: cursor }
        };
        
        console.log(`📡 Making ShipHero API call for page ${pageCount}...`);
        console.log(`🔍 Query body:`, JSON.stringify(queryBody, null, 2));
        console.log(`📍 Cursor for this page:`, cursor || 'null (first page)');
        
        try {
          const response = await fetch('https://public-api.shiphero.com/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${functions.config().shiphero.api_token}`
            },
            body: JSON.stringify(queryBody)
          });
          
          console.log(`📥 ShipHero API response status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            console.error(`❌ ShipHero API Error on page ${pageCount}:`, response.status, response.statusText);
            console.log('🔄 Continuing to next page...');
            continue; // Skip this page and continue with next
          }
          
          const data = await response.json();
          console.log(`📥 ShipHero API response received for page ${pageCount}`);
          
          if (data.errors) {
            console.error(`❌ GraphQL Errors on page ${pageCount}:`, data.errors);
            console.log('🔄 Continuing to next page...');
            continue; // Skip this page and continue with next
          }
          
          const orders = data?.data?.orders?.data?.edges || [];
          const pageInfo = data?.data?.orders?.data?.pageInfo || {};
          
          console.log(`📦 Page ${pageCount}: Found ${orders.length} backorders`);
          console.log(`📊 PageInfo:`, JSON.stringify(pageInfo, null, 2));
          
          if (orders.length > 0) {
            console.log(`📋 Sample orders from page ${pageCount}:`, orders.slice(0, 3).map(edge => ({
              order_number: edge.node.order_number,
              id: edge.node.id,
              cursor: edge.cursor
            })));
          }
          
          // Store backorders in temporary Firebase collection
          console.log(`💾 Storing ${orders.length} backorders in temporary collection...`);
          const storePromises = orders.map(async (edge) => {
            const order = edge.node;
            try {
              await tempCollectionRef.doc(order.id).set({
                order_number: order.order_number,
                id: order.id,
                cursor: edge.cursor,
                processed: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              });
              return true;
            } catch (storeError) {
              console.error(`❌ Failed to store order ${order.order_number}:`, storeError);
              return false;
            }
          });
          
          const storeResults = await Promise.all(storePromises);
          const successfulStores = storeResults.filter(result => result === true).length;
          console.log(`💾 Successfully stored ${successfulStores}/${orders.length} backorders in temporary collection`);
          
          totalBackordersFound += orders.length;
          
          // Update pagination variables
          hasNextPage = pageInfo.hasNextPage || false;
          cursor = orders.length > 0 ? orders[orders.length - 1].cursor : null;
          
          console.log(`🔄 Pagination update - hasNextPage: ${hasNextPage}, next cursor: ${cursor || 'null'}`);
          
          // Add delay between queries to avoid rate limiting
          if (hasNextPage) {
            console.log('⏳ Waiting 2 seconds before next page...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageCount}:`, pageError);
          console.log('🔄 Continuing to next page...');
          continue;
        }
      }
      
      console.log(`✅ ===== PAGINATION COMPLETE =====`);
      console.log(`📊 Total pages processed: ${pageCount}`);
      console.log(`📦 Total backorders found: ${totalBackordersFound}`);
      
      // Get all stored backorders for processing
      console.log('📥 Retrieving all stored backorders for processing...');
      const allBackordersSnapshot = await tempCollectionRef.get();
      const backordersToProcess = allBackordersSnapshot.docs.map(doc => doc.data());
      
      console.log(`🚀 Processing ${backordersToProcess.length} backorders with ship date updates...`);
      console.log(`📅 Target ship date: ${tomorrowStr}`);
      
      if (backordersToProcess.length === 0) {
        console.log('✨ No backorders to process - function complete!');
        return {
          success: true,
          summary: {
            totalBackorders: 0,
            successCount: 0,
            errorCount: 0,
            shipDate: tomorrowStr,
            processedAt: new Date().toISOString(),
            message: 'No backorders found to process'
          }
        };
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      // Process each backorder with delay
      for (let i = 0; i < backordersToProcess.length; i++) {
        const backorder = backordersToProcess[i];
        
        console.log(`📝 ===== PROCESSING ORDER ${i + 1}/${backordersToProcess.length} =====`);
        console.log(`📋 Order details:`, JSON.stringify(backorder, null, 2));
        
        try {
          console.log(`📝 Updating order ${backorder.order_number} (${i + 1}/${backordersToProcess.length})...`);
          
          const mutationBody = {
            query: `
              mutation {
                order_update(data: {
                  order_id: "${backorder.id}"
                  required_ship_date: "${tomorrowStr}"
                }) {
                  request_id
                }
              }
            `
          };
          
          console.log(`🔧 Mutation body:`, JSON.stringify(mutationBody, null, 2));
          
          const updateResponse = await fetch('https://public-api.shiphero.com/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${functions.config().shiphero.api_token}`
            },
            body: JSON.stringify(mutationBody)
          });
          
          console.log(`📥 Update response status: ${updateResponse.status} ${updateResponse.statusText}`);
          
          if (!updateResponse.ok) {
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
          }
          
          const updateData = await updateResponse.json();
          console.log(`📥 Update response data:`, JSON.stringify(updateData, null, 2));
          
          if (updateData.errors) {
            throw new Error(`GraphQL: ${updateData.errors[0].message}`);
          }
          
          // Mark as processed in Firebase
          console.log(`💾 Marking order ${backorder.order_number} as processed...`);
          await tempCollectionRef.doc(backorder.id).update({
            processed: true,
            request_id: updateData.data?.order_update?.request_id || 'unknown',
            processed_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          successCount++;
          console.log(`✅ Successfully updated order ${backorder.order_number}`);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to update order ${backorder.order_number}:`, error.message);
          console.error(`❌ Full error:`, error);
          
          // Mark as failed in Firebase
          try {
            await tempCollectionRef.doc(backorder.id).update({
              processed: false,
              error: error.message,
              failed_at: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`💾 Marked order ${backorder.order_number} as failed in Firebase`);
          } catch (firebaseError) {
            console.error(`❌ Failed to update Firebase status for order ${backorder.order_number}:`, firebaseError);
          }
        }
        
        // Add delay between mutations to avoid rate limiting
        if (i < backordersToProcess.length - 1) {
          console.log('⏳ Waiting 1 second before next order...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`🎯 ===== PROCESSING COMPLETE =====`);
      console.log(`📊 Summary: Success: ${successCount}, Errors: ${errorCount}`);
      console.log(`📅 Ship date used: ${tomorrowStr}`);
      console.log(`⏰ Completed at: ${new Date().toISOString()}`);
      
      return {
        success: true,
        summary: {
          totalBackorders: backordersToProcess.length,
          successCount,
          errorCount,
          shipDate: tomorrowStr,
          processedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('❌ ===== FATAL ERROR IN SCHEDULED FUNCTION =====');
      console.error('❌ Error details:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error message:', error.message);
      console.error('❌ Function failed at:', new Date().toISOString());
      throw error; // Re-throw to mark the scheduled function as failed
    }
  });

// Scheduled function that runs daily at midnight EST to process fill rate issues
exports.processFillRateIssues = functions
  .runWith({
    timeoutSeconds: 540,  // 9 minutes timeout (maximum allowed)
    memory: '256MB'
  })
  .pubsub.schedule('0 5 * * *') // 5 AM UTC = midnight EST
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🚀 ===== FILL RATE ISSUES PROCESSING TRIGGERED =====');
    console.log('⏰ Processing fill rate issues at:', new Date().toISOString());
    
    try {
      // Get yesterday's date (since we're processing at midnight for the previous day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      console.log(`📅 Processing fill rate issues for: ${yesterdayStr}`);
      
      // Query ShipHero for ALL problem orders with pagination
      let allProblemOrders = [];
      let hasNextPage = true;
      let cursor = null;
      const pageSize = 10; // Keep at 10 for rate limiting
      let pageCount = 0;
      
      console.log('📡 Starting pagination through all problem orders...');
      
      while (hasNextPage) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount} of problem orders...`);
        
        const queryBody = {
          query: `
            query GetProblemOrders($first: Int!, $after: String) {
              orders(tag: "problem") {
                data(first: $first, after: $after) {
                  edges {
                    node {
                      order_number
                      required_ship_date
                    }
                    cursor
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `,
          variables: {
            first: pageSize,
            after: cursor
          }
        };
        
        const response = await fetch('https://public-api.shiphero.com/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${functions.config().shiphero.api_token}`
          },
          body: JSON.stringify(queryBody)
        });
        
        if (!response.ok) {
          console.error(`❌ ShipHero API Error on page ${pageCount}:`, response.status, response.statusText);
          throw new Error(`ShipHero API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.errors) {
          console.error(`❌ GraphQL Errors on page ${pageCount}:`, data.errors);
          throw new Error('GraphQL errors');
        }
        
        // Add orders from this page
        const pageOrders = data?.data?.orders?.data?.edges || [];
        allProblemOrders = allProblemOrders.concat(pageOrders);
        
        console.log(`📄 Page ${pageCount}: Got ${pageOrders.length} orders, total so far: ${allProblemOrders.length}`);
        
        // Check if there are more pages
        hasNextPage = data?.data?.orders?.data?.pageInfo?.hasNextPage || false;
        cursor = data?.data?.orders?.data?.pageInfo?.endCursor || null;
        
        // Add delay between pages to avoid overwhelming the API
        if (hasNextPage) {
          console.log(`⏳ Waiting 1 second before fetching next page...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ Pagination complete: Fetched ${allProblemOrders.length} total problem orders across ${pageCount} pages`);
      
      // Get existing fill rate issues from Firestore
      const existingIssuesSnapshot = await db.collection('fill_rate_issues').get();
      const existingIssueNumbers = new Set();
      
      existingIssuesSnapshot.forEach(doc => {
        existingIssueNumbers.add(doc.data().order_number);
      });
      
      console.log(`📊 Found ${existingIssueNumbers.size} existing fill rate issues in Firestore`);
      
      // Process each problem order
      let newIssuesCount = 0;
      let updatedIssuesCount = 0;
      
      for (const edge of allProblemOrders) {
        const order = edge.node;
        
        if (!order.required_ship_date) continue;
        
        const requiredDate = new Date(order.required_ship_date);
        const requiredDateStr = requiredDate.toISOString().split('T')[0];
        
        // Only process orders that were due yesterday or before
        if (requiredDateStr > yesterdayStr) continue;
        
        const orderNumber = order.order_number;
        
        if (!existingIssueNumbers.has(orderNumber)) {
          // This is a NEW fill rate issue - add it to the collection
          await db.collection('fill_rate_issues').doc(orderNumber).set({
            order_number: orderNumber,
            first_detected_date: requiredDateStr,
            added_to_collection: yesterdayStr,
            problem_type: 'inventory_issue',
            required_ship_date: order.required_ship_date,
            processed_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          newIssuesCount++;
          console.log(`🆕 Added new fill rate issue: ${orderNumber}`);
        } else {
          // This issue already exists - just update the timestamp
          await db.collection('fill_rate_issues').doc(orderNumber).update({
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          
          updatedIssuesCount++;
        }
      }
      
      console.log(`✅ Fill rate issues processing complete:`);
      console.log(`   - New issues added: ${newIssuesCount}`);
      console.log(`   - Existing issues updated: ${updatedIssuesCount}`);
      console.log(`   - Total issues in collection: ${existingIssueNumbers.size + newIssuesCount}`);
      
      return {
        success: true,
        newIssuesCount,
        updatedIssuesCount,
        totalIssues: existingIssueNumbers.size + newIssuesCount,
        processedDate: yesterdayStr
      };
      
    } catch (error) {
      console.error('❌ Error processing fill rate issues:', error);
      throw error;
    }
  });