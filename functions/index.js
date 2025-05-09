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

  if (data.webhook_type !== 'Order Allocated') {
    console.log('Ignored webhook:', data.webhook_type);
    res.status(200).send('Ignored');
    return;
  }

  try {
    const docId = data.order_uuid || data.order_number || undefined;
    const docRef = docId
      ? db.collection('orders').doc(docId)
      : db.collection('orders').doc(); // auto-ID fallback

    await docRef.set({
      order_uuid: data.order_uuid || null,
      order_number: data.order_number || null,
      account_uuid: data.account_uuid || null,
      allocated_at: data.allocated_at || null,
      status: 'allocated',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Saved order ${data.order_number}`);
    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Firestore error:', err);
    res.status(500).send('Error');
  }
});
