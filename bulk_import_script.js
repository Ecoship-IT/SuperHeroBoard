// Bulk import script for EFM Products
// Copy and paste this entire script into the browser console on the EFM Product Sizes page

const productsToImport = [
  { sku: "EFM-MCVC-FBA", value: 0.5 },
  { sku: "BAR-BP", value: 0.4 },
  { sku: "BAR-FWB", value: 0.4 },
  { sku: "BNR", value: 4 },
  { sku: "BOX-INSERT-SKIO-001", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-002", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-003", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-004", value: 0.01 },
  { sku: "CAT-WS", value: 0.1 },
  { sku: "DHBEDT-M", value: 1 },
  { sku: "DHBEDT-S", value: 1 },
  { sku: "DHBEDT-XL", value: 1 },
  { sku: "EFM-CC", value: 0.3 },
  { sku: "EFM-CHOCC", value: 0.65 },
  { sku: "EFM-EFA", value: 0.25 },
  { sku: "EFM-KO", value: 0.25 },
  { sku: "EFM-LC", value: 0.55 },
  { sku: "EFM-MCVC", value: 0.55 },
  { sku: "EFM-MULT", value: 0.25 },
  { sku: "EFM-NCP", value: 1 },
  { sku: "EFM-RSC", value: 0.25 },
  { sku: "EFM-SB", value: 0.5 },
  { sku: "EFM-TBT", value: 0.25 },
  { sku: "EFM-TGPC", value: 0.4 },
  { sku: "EFM-TGPPC", value: 0.4 },
  { sku: "EFM-TML", value: 0.65 },
  { sku: "EFM-ZMA", value: 0.25 },
  { sku: "EFM-ZR", value: 0.25 },
  { sku: "EFMTAPE", value: 0.01 },
  { sku: "EFT-S", value: 1 },
  { sku: "ELI-BER", value: 0.33 },
  { sku: "ELI-CIT", value: 0.33 },
  { sku: "FPT-S", value: 1 },
  { sku: "HGBEDT-L", value: 1 },
  { sku: "HGBEDT-S", value: 1 },
  { sku: "HGBEDT-XL", value: 1 },
  { sku: "HGBEDT-XXL", value: 1 },
  { sku: "INSERT-001", value: 0.01 },
  { sku: "MTPT-L", value: 1 },
  { sku: "MTPT-M", value: 1 },
  { sku: "MTPT-S", value: 1 },
  { sku: "MTPT-XL", value: 1 },
  { sku: "MTPT-XXL", value: 1 },
  { sku: "MTSST-S", value: 1 },
  { sku: "NMT-M", value: 1 },
  { sku: "NMT-S", value: 1 },
  { sku: "NTBT-S", value: 1 },
  { sku: "PAN-CC", value: 1 },
  { sku: "PBEDT-M", value: 1 },
  { sku: "PBEDT-S", value: 1 },
  { sku: "PBEDT-XL", value: 1 },
  { sku: "PP-BAN", value: 1 },
  { sku: "PP-CHC", value: 1 },
  { sku: "PP-CHC-12", value: 0.5 },
  { sku: "PP-HD", value: 1 },
  { sku: "PP-LOVW", value: 1 },
  { sku: "PP-LOVW-12", value: 0.5 },
  { sku: "PP-PUMP", value: 1 },
  { sku: "PP-STW", value: 1 },
  { sku: "PP-STW-12", value: 0.5 },
  { sku: "PP-VAN", value: 1 },
  { sku: "PP-VAN-12", value: 0.5 },
  { sku: "PRO-CPBPP", value: 1 },
  { sku: "PRO-CPP", value: 1 },
  { sku: "PRO-MBM", value: 1 },
  { sku: "PRO-MBM-FBM", value: 1 },
  { sku: "PRO-MC", value: 1 },
  { sku: "PRO-SC", value: 1 },
  { sku: "PRO-SCAR", value: 1 },
  { sku: "PRO-TB", value: 1 },
  { sku: "PRO-VPP", value: 1 },
  { sku: "PWO-DF", value: 0.55 },
  { sku: "PWO-LEM", value: 0.55 },
  { sku: "PWOSF-SC", value: 0.55 },
  { sku: "SIN-BAR-BP", value: 0.1 },
  { sku: "SIN-BAR-FWB", value: 0.1 },
  { sku: "SIN-CHC", value: 0.05 },
  { sku: "SIN-CHC-10", value: 0.5 },
  { sku: "SIN-CPBPP", value: 0.05 },
  { sku: "SIN-CPP", value: 0.05 },
  { sku: "SIN-FWB", value: 0.05 },
  { sku: "SIN-MBM", value: 0.05 },
  { sku: "SIN-PANCC", value: 0.05 },
  { sku: "SIN-STW", value: 0.05 },
  { sku: "SIN-VAN", value: 0.05 },
  { sku: "SIN-VPP", value: 0.05 },
  { sku: "SS-ZC", value: 1 },
  { sku: "ST-DC", value: 0.01 },
  { sku: "ST-DC1", value: 0.01 },
  { sku: "ST-VT", value: 0.01 },
  { sku: "STK-ECC", value: 1 },
  { sku: "STK-EFWB", value: 1 },
  { sku: "STK-EGB", value: 1 },
  { sku: "STK-EWB", value: 1 },
  { sku: "WLT-L", value: 1 },
  { sku: "WLT-M", value: 1 },
  { sku: "WLT-S", value: 1 },
  { sku: "WLT-XL", value: 1 },
  { sku: "WLT-XXL", value: 1 },
  { sku: "PRO-BB", value: 1 }
];

async function bulkImportProducts() {
  console.log('🚀 Starting bulk import of EFM products...');
  
  // Try to access Firebase from the React app context
  let db, collection, addDoc, serverTimestamp;
  
  try {
    // Method 1: Try to get from React DevTools or global scope
    if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
      console.log('🔍 Searching for Firebase in React app...');
      // This is a more complex approach - let's try a simpler method first
    }
    
    // Method 2: Try to import Firebase directly (if available globally)
    if (window.firebase) {
      console.log('📦 Found Firebase on window object');
      db = window.firebase.db;
      collection = window.firebase.collection;
      addDoc = window.firebase.addDoc;
      serverTimestamp = window.firebase.serverTimestamp;
    }
    
    // Method 3: Try to access from the page's modules
    if (!db) {
      console.log('🔍 Trying alternative Firebase access...');
      // Let's try to use fetch to add data via a simple approach
      console.log('⚠️ Direct Firebase access not available. Please try the manual method below:');
      console.log('');
      console.log('📋 MANUAL IMPORT INSTRUCTIONS:');
      console.log('1. Click "Add Product" button on the page');
      console.log('2. Copy and paste these SKU/Value pairs one by one:');
      console.log('');
      
      // Show first 10 products as example
      productsToImport.slice(0, 10).forEach((product, index) => {
        console.log(`${index + 1}. SKU: ${product.sku}, Value: ${product.value}`);
      });
      
      console.log('');
      console.log(`... and ${productsToImport.length - 10} more products`);
      console.log('');
      console.log('💡 Or try this alternative: Go to Firestore Console and import directly');
      return;
    }
    
  } catch (error) {
    console.error('❌ Error accessing Firebase:', error);
    return;
  }
  
  if (!db || !collection || !addDoc || !serverTimestamp) {
    console.error('❌ Firebase functions not available. Please make sure you\'re on the EFM Product Sizes page.');
    return;
  }
  
  console.log(`📦 Found ${productsToImport.length} products to import`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < productsToImport.length; i++) {
    const product = productsToImport[i];
    try {
      await addDoc(collection(db, 'efm_products'), {
        sku: product.sku.trim(),
        value: parseFloat(product.value) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      successCount++;
      console.log(`✅ Added: ${product.sku} = ${product.value} (${i + 1}/${productsToImport.length})`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to add ${product.sku}:`, error);
    }
    
    // Small delay every 10 items to avoid overwhelming Firestore
    if (i % 10 === 0 && i > 0) {
      console.log(`⏳ Pausing briefly... (${i}/${productsToImport.length} processed)`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`🎉 Import complete!`);
  console.log(`✅ Successfully imported: ${successCount} products`);
  console.log(`❌ Failed to import: ${errorCount} products`);
  console.log(`📊 Total processed: ${successCount + errorCount} products`);
}

// Alternative: Create a simple CSV for Firestore import
function generateFirestoreJSON() {
  console.log('📄 Generating Firestore import JSON...');
  
  const firestoreData = {};
  productsToImport.forEach((product, index) => {
    const docId = `product_${index + 1}`;
    firestoreData[docId] = {
      sku: product.sku,
      value: product.value,
      createdAt: { "__dataType__": "timestamp", "__value__": new Date().toISOString() },
      updatedAt: { "__dataType__": "timestamp", "__value__": new Date().toISOString() }
    };
  });
  
  const jsonOutput = {
    "efm_products": firestoreData
  };
  
  console.log('📋 Copy this JSON and save as a .json file for Firestore import:');
  console.log(JSON.stringify(jsonOutput, null, 2));
}

// Run the import
console.log('🚀 Attempting automatic import...');
bulkImportProducts().catch(() => {
  console.log('');
  console.log('🔄 Automatic import failed. Generating JSON for manual import...');
  generateFirestoreJSON();
}); 