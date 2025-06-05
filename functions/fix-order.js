const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function fixOrder() {
  try {
    console.log('🔧 Fixing order EFM-278319...');
    
    const orderRef = db.collection('orders').doc('EFM-278319');
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      console.log('❌ Order not found in Firestore');
      return;
    }
    
    console.log('📋 Current order data:', orderDoc.data());
    
    // Update the order to correct status based on ShipHero data
    await orderRef.update({
      status: 'allocated', // Should be allocated, not shipped
      shippedAt: admin.firestore.FieldValue.delete(), // Remove incorrect shipped timestamp
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastVerified: admin.firestore.FieldValue.serverTimestamp(),
      correctionNote: 'Fixed incorrect shipped status - order was never actually shipped in ShipHero'
    });
    
    console.log('✅ Order EFM-278319 has been corrected');
    
    // Verify the update
    const updatedDoc = await orderRef.get();
    console.log('📋 Updated order data:', updatedDoc.data());
    
  } catch (error) {
    console.error('❌ Error fixing order:', error);
  }
}

fixOrder(); 