const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.shipHeroWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const data = req.body;

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

      if (!shipment || !shipment.order_uuid) {
        console.warn('⚠️ Shipment webhook missing fulfillment or order_uuid');
        res.status(400).send('Invalid shipment payload');
        return;
      }

      // Save shipment separately
      const docRef = db.collection('orders_shipped').doc(shipment.order_number);

      await docRef.set({
        order_uuid: shipment.order_uuid,
        order_number: shipment.order_number,
        tracking_number: shipment.tracking_number,
        shipping_method: shipment.shipping_method,
        shipping_carrier: shipment.shipping_carrier,
        line_items: shipment.line_items,
        shipped_at: shipment.created_at,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // ✅ Update status in orders collection to "shipped"
      await db.collection('orders').doc(shipment.order_number).set({
        status: 'shipped',
        shippedAt: admin.firestore.Timestamp.fromDate(new Date(shipment.created_at)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`✅ Saved shipment + updated order: ${shipment.order_number}`);
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

      await db.collection('orders').doc(docId).set({
        status: 'cancelled', // Use two L's to match your app logic
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`Marked order as cancelled: ${docId}`);
      res.status(200).send('Order cancellation processed');
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
