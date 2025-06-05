const admin = require('firebase-admin');

// Initialize with default credentials when using emulator
admin.initializeApp({
  projectId: 'superheroboardv2'
});

const db = admin.firestore();

async function setupTestOrder() {
  try {
    const orderData = {
      order_number: 'TEST-123',
      order_uuid: 'test-uuid',
      account_uuid: 'QWNjb3VudDo4NDg3Mg==', // Earth Fed Muscle account
      allocated_at: new Date().toISOString(),
      line_items: [
        { sku: 'TEST-SKU', quantity: 1 }
      ],
      ready_to_ship: true,
      status: 'allocated',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('📝 Creating test order:', orderData);

    await db.collection('orders').doc('TEST-123').set(orderData);
    console.log('✅ Test order created successfully');

    // Verify the order was created
    const doc = await db.collection('orders').doc('TEST-123').get();
    console.log('📋 Created order data:', doc.data());

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupTestOrder(); 