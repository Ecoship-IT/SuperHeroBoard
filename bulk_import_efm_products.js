// Bulk import script for EFM Products with Names
// Copy and paste this ENTIRE script into the browser console on the EFM Product Sizes page
// Make sure you're on the EFM Product Sizes page first!

const productsToImport = [
  { sku: "BOX-INSERT-SKIO-001", name: "Whey single serve insert", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-002", name: "Bars single serve insert", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-003", name: "Free shaker insert", value: 0.01 },
  { sku: "BOX-INSERT-SKIO-004", name: "Free shirt on next order insert", value: 0.01 },
  { sku: "EFMTAPE", name: "Earth Fed Muscle Tape", value: 0.01 },
  { sku: "INSERT-001", name: "Earth Fed Muscle Insert", value: 0.01 },
  { sku: "ST-DC", name: "Earth Fed Die Cut Stickers", value: 0.01 },
  { sku: "ST-DC1", name: "Earthy Circle Sticker", value: 0.01 },
  { sku: "ST-VT", name: "Earth Fed Transfer Stickers", value: 0.01 },
  { sku: "SIN-CHC", name: "Chocolate - Single Serving Whey Protein", value: 0.025 },
  { sku: "SIN-CPBPP", name: "Single Serve Chocolate P B Plant Protein", value: 0.025 },
  { sku: "SIN-CPP", name: "Single Serve Chocolate Plant Protein", value: 0.025 },
  { sku: "SIN-FWB", name: "Friends w Benefits - Single Serving", value: 0.025 },
  { sku: "SIN-MBM", name: "Mocha - Single Serving Whey Protein", value: 0.025 },
  { sku: "SIN-PANCC", name: "Single Serve Griddle and Grind", value: 0.025 },
  { sku: "SIN-STW", name: "Whey Protein(SingleServing) - Strawberry", value: 0.025 },
  { sku: "SIN-VAN", name: "Vanilla - Single Serving Whey Protein", value: 0.025 },
  { sku: "SIN-VPP", name: "Single Serve Vanilla Plant Protein", value: 0.025 },
  { sku: "SIN-BAR-BP", name: "Brownie Points Protein Bar - SINGLE BAR", value: 0.04 },
  { sku: "SIN-BAR-FWB", name: "FriendsWBenefits ProteinBar - SINGLE BAR", value: 0.04 },
  { sku: "CAT-WS", name: "EFM Catalog", value: 0.1 },
  { sku: "EFM-EFA", name: "Earth Fed Armor", value: 0.25 },
  { sku: "EFM-KO", name: "Arctic Advantage Krill Oil Softgels", value: 0.25 },
  { sku: "EFM-MULT", name: "Morning Ritual", value: 0.25 },
  { sku: "EFM-TBT", name: "Truly Buff Towels", value: 0.25 },
  { sku: "EFM-ZMA", name: "Forty Winkz", value: 0.25 },
  { sku: "EFM-ZR", name: "Zen Remedy", value: 0.25 },
  { sku: "EFM-CC", name: "Transcend Creatine", value: 0.3 },
  { sku: "ELI-BER", name: "Elixir Electrolyte Mix - Berry Flavor", value: 0.3 },
  { sku: "ELI-CIT", name: "Elixir Electrolyte Mix - Citrus Flavor", value: 0.3 },
  { sku: "BAR-BP", name: "Brownie Points Protein Bar Box", value: 0.4 },
  { sku: "BAR-FWB", name: "Friends with benefits Protein Bar Box", value: 0.4 },
  { sku: "EFM-TGPC", name: "The Greens Party - Chocolate Greens", value: 0.4 },
  { sku: "EFM-TGPPC", name: "The Greens Party - Pina Colada", value: 0.4 },
  { sku: "EFM-SB", name: "Shaker Bottle", value: 0.5 },
  { sku: "PP-CHC-12", name: "Chocolate Shake-Up Regular (12 servings)", value: 0.5 },
  { sku: "PP-LOVW-12", name: "Power Couple Regular (12 servings)", value: 0.5 },
  { sku: "PP-STW-12", name: "Strawberry Feels Regular (12 servings)", value: 0.5 },
  { sku: "PP-VAN-12", name: "Vanilla Whey Back Regular (12 servings)", value: 0.5 },
  { sku: "SIN-CHC-10", name: "Chocolate - Single Serving 10 count BOX", value: 0.5 },
  { sku: "EFM-RSC", name: "Revival BCAA+", value: 0.55 },
  { sku: "EFM-LC", name: "Lemonade Collagen Superprotein", value: 0.55 },
  { sku: "EFM-MCVC", name: "Morning Charge Vanilla Creamer", value: 0.55 },
  { sku: "PWO-DF", name: "Stammpede DragonFruit Preworkout", value: 0.55 },
  { sku: "PWO-LEM", name: "Lemonade Stammpede", value: 0.55 },
  { sku: "PWOSF-SC", name: "Stim Free Stammpede - Sour Cherry", value: 0.3 },
  { sku: "PWO-BR", name: "", value: 0.55 },
  { sku: "EFM-CHOCC", name: "Chocolate Keystone Collagen", value: 0.65 },
  { sku: "EFM-TML", name: "The Keystone Collagen Superprotein", value: 0.65 },
  { sku: "DHBEDT-M", name: "Dark Heather Better Every Day Tee M", value: 1 },
  { sku: "DHBEDT-S", name: "Dark Heather Better Every Day Tee S", value: 1 },
  { sku: "DHBEDT-XL", name: "Dark Heather Better Every Day Tee XL", value: 1 },
  { sku: "EFM-NCP", name: "Nocturnal Casein", value: 1 },
  { sku: "EFT-S", name: "Earth Flow Tee S", value: 1 },
  { sku: "FPT-S", name: "Freaky Peaky Tee S", value: 1 },
  { sku: "HGBEDT-L", name: "Heather Green Better Every Day T L", value: 1 },
  { sku: "HGBEDT-S", name: "Heather Green Better Every Day T S", value: 1 },
  { sku: "HGBEDT-XL", name: "Hther Green Better Every Day T XL", value: 1 },
  { sku: "HGBEDT-XXL", name: "Hther Grn Better Every Day T XXL", value: 1 },
  { sku: "MTPT-L", name: "Mountain Trek Pink Tank - L", value: 1 },
  { sku: "MTPT-M", name: "Mountain Trek Pink Tank - M", value: 1 },
  { sku: "MTPT-S", name: "Mountain Trek Pink Tank - S", value: 1 },
  { sku: "MTPT-XL", name: "Mountain Trek Pink Tank - XL", value: 1 },
  { sku: "MTPT-XXL", name: "Mountain Trek Pink Tank - XXL", value: 1 },
  { sku: "MTSST-S", name: "Mountain Trek Short Sleeve Tee - S", value: 1 },
  { sku: "NMT-M", name: "Navy Muscle Tank - M", value: 1 },
  { sku: "NMT-S", name: "Navy Muscle Tank - S", value: 1 },
  { sku: "NTBT-S", name: "Navy ThrowBack Tee - S", value: 1 },
  { sku: "PAN-CC", name: "Griddle n' Grind Chocolate Chip Pancake", value: 1 },
  { sku: "PBEDT-M", name: "Peach Better Every Day Tee - M", value: 1 },
  { sku: "PBEDT-S", name: "Peach Better Every Day Tee - S", value: 1 },
  { sku: "PBEDT-XL", name: "Peach Better Every Day Tee - XL", value: 1 },
  { sku: "PP-BAN", name: "Go! Bananas Whey Protein", value: 1 },
  { sku: "PP-CHC", name: "Ca-COW! Chocolate Protein", value: 1 },
  { sku: "PP-HD", name: "Husky Dunker Cookies&Cream Protein", value: 1 },
  { sku: "PP-LOVW", name: "FWB Peanut Butter Protein", value: 1 },
  { sku: "PP-PUMP", name: "Witch's Whey Pumpkin Spice Protein", value: 1 },
  { sku: "PP-STW", name: "Strawberry Feels (Forever) Grass Fed Whe", value: 1 },
  { sku: "PP-VAN", name: "Whey Back Vanilla Protein", value: 1 },
  { sku: "PRO-CPBPP", name: "Common Ground Chocolate Peanut Butter", value: 1 },
  { sku: "PRO-CPP", name: "Common Ground Chocolate Plant Protein", value: 1 },
  { sku: "PRO-MBM", name: "Magic Beans Mocha Protein", value: 1 },
  { sku: "PRO-MBM-FBM", name: "Magic Beans Mocha Protein - DATE STAMPED", value: 1 },
  { sku: "PRO-MC", name: "Thicc Mints Chocolate Mint Whey", value: 1 },
  { sku: "PRO-SC", name: "Dark Arts Salted Chocolate Whey", value: 1 },
  { sku: "PRO-SCAR", name: "Salted Caramel Grass Fed Whey Protein", value: 1 },
  { sku: "PRO-TB", name: "Truly Buff Unflavored Whey", value: 1 },
  { sku: "PRO-VPP", name: "Common Ground Vanilla Plant Protein", value: 1 },
  { sku: "SS-ZC", name: "Sleepy Stack", value: 1 },
  { sku: "STK-ECC", name: "Essentials Stack - Chocolate", value: 1 },
  { sku: "STK-EFWB", name: "Essentials Stack Chocolate Peanut Butter", value: 1 },
  { sku: "STK-EGB", name: "Essentials Stack - Go! Bannanas", value: 1 },
  { sku: "STK-EWB", name: "Essentials Stack - Vanilla", value: 1 },
  { sku: "WLT-L", name: "White Logo Tee - L", value: 1 },
  { sku: "WLT-M", name: "White Logo Tee - M", value: 1 },
  { sku: "WLT-S", name: "White Logo Tee - S", value: 1 },
  { sku: "WLT-XL", name: "White Logo Tee - XL", value: 1 },
  { sku: "WLT-XXL", name: "White Logo Tee - XXL", value: 1 },
  { sku: "PRO-BB", name: "", value: 1 },
  { sku: "BNR", name: "EFM Banner", value: 4 }
];

(async function() {
  console.log('🚀 Starting bulk import of EFM products with names...');
  console.log(`📦 Total products: ${productsToImport.length}`);
  
  // Wait for the page to expose Firebase functions
  let maxWait = 50; // 5 seconds max wait
  let waitCount = 0;
  while (!window.__EFM_FIREBASE__ && waitCount < maxWait) {
    await new Promise(r => setTimeout(r, 100));
    waitCount++;
  }
  
  if (!window.__EFM_FIREBASE__) {
    console.error('❌ Firebase functions not available. Make sure you\'re on the EFM Product Sizes page!');
    return;
  }
  
  const { db, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } = window.__EFM_FIREBASE__;
  
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  for (const product of productsToImport) {
    try {
      // Check if product exists
      const q = query(collection(db, 'efm_products'), where('sku', '==', product.sku));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Create new
        await addDoc(collection(db, 'efm_products'), {
          sku: product.sku.trim(),
          name: product.name || '',
          value: parseFloat(product.value) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        created++;
        console.log(`✅ Created: ${product.sku} - ${product.name}`);
      } else {
        // Update existing
        const doc = snapshot.docs[0];
        await updateDoc(doc.ref, {
          name: product.name || '',
          value: parseFloat(product.value) || 0,
          updatedAt: serverTimestamp()
        });
        updated++;
        console.log(`🔄 Updated: ${product.sku} - ${product.name}`);
      }
      
      // Small delay to avoid overwhelming Firestore
      await new Promise(r => setTimeout(r, 50));
    } catch (error) {
      errors++;
      console.error(`❌ Error with ${product.sku}:`, error);
    }
  }
  
  console.log('\n📊 Import Summary:');
  console.log(`✅ Created: ${created}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);
  alert(`Import complete!\nCreated: ${created}\nUpdated: ${updated}\nErrors: ${errors}`);
})();
