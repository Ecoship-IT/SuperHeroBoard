const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
admin.initializeApp({
  projectId: 'superheroboardv2'
});

const db = admin.firestore();

async function checkFirestoreOrder() {
  try {
    console.log('🔍 Checking order EFM-278319 in Firestore...');
    
    const orderRef = db.collection('orders').doc('EFM-278319');
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      console.log('❌ Order not found in Firestore');
      return;
    }
    
    const orderData = orderDoc.data();
    console.log('📋 Current Firestore order data:');
    console.log('   Order Number:', orderData.order_number);
    console.log('   Status:', orderData.status);
    console.log('   Account UUID:', orderData.account_uuid);
    console.log('   Allocated At:', orderData.allocated_at);
    console.log('   Shipped At:', orderData.shippedAt ? orderData.shippedAt.toDate() : 'Not set');
    console.log('   Ready to Ship:', orderData.ready_to_ship);
    console.log('   Updated At:', orderData.updatedAt ? orderData.updatedAt.toDate() : 'Not set');
    console.log('   Last Verified:', orderData.lastVerified ? orderData.lastVerified.toDate() : 'Not set');
    console.log('   Correction Note:', orderData.correctionNote || 'None');
    
    console.log('\n📝 Analysis:');
    if (orderData.status === 'shipped' && orderData.shippedAt) {
      console.log('   ❌ Order still incorrectly marked as shipped');
    } else if (orderData.status === 'shipped' && !orderData.shippedAt) {
      console.log('   ⚠️ Order marked as shipped but no timestamp');
    } else if (orderData.status === 'allocated' && !orderData.shippedAt) {
      console.log('   ✅ Order correctly marked as allocated with no ship timestamp');
    } else if (orderData.status === 'allocated' && orderData.shippedAt) {
      console.log('   ⚠️ Order marked as allocated but still has ship timestamp');
    }
    
  } catch (error) {
    console.error('❌ Error checking Firestore order:', error);
  }
}

checkFirestoreOrder(); 