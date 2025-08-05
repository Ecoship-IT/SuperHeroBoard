const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function analyzeAllocationTimes() {
  try {
    console.log('📊 Analyzing allocation times across all orders...\n');
    
    // Fetch all orders
    const ordersSnapshot = await db.collection('orders').get();
    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📋 Total orders found: ${orders.length}`);
    
    // Initialize hourly data (24 hours)
    const hourlyData = Array.from({ length: 24 }, (_, index) => ({
      hour: index,
      hourLabel: `${index === 0 ? '12 AM' : index === 12 ? '12 PM' : index > 12 ? `${index - 12} PM` : `${index} AM`}`,
      count: 0,
      orders: []
    }));
    
    let processedOrders = 0;
    let skippedOrders = 0;
    
    // Process each order
    orders.forEach(order => {
      if (!order.allocated_at) {
        skippedOrders++;
        return;
      }
      
      try {
        // Parse the allocated_at timestamp
        let allocTime;
        if (order.allocated_at.toDate) {
          // Firestore timestamp
          allocTime = order.allocated_at.toDate();
        } else if (typeof order.allocated_at === 'string') {
          // String timestamp
          let timeStr = order.allocated_at;
          if (order.allocated_at.includes('T')) {
            timeStr = order.allocated_at.replace('T', ' ');
          }
          allocTime = new Date(timeStr.replace(' ', 'T') + 'Z');
        } else {
          allocTime = new Date(order.allocated_at);
        }
        
        if (isNaN(allocTime.getTime())) {
          console.warn(`⚠️ Invalid date for order ${order.order_number}: ${order.allocated_at}`);
          skippedOrders++;
          return;
        }
        
        // Get the hour (0-23) in Eastern time
        // Convert UTC to Eastern (approximate - doesn't handle DST perfectly for historical data)
        const easternTime = new Date(allocTime.getTime() - (5 * 60 * 60 * 1000)); // UTC-5 (EST)
        const hour = easternTime.getUTCHours();
        
        if (hour >= 0 && hour <= 23) {
          hourlyData[hour].count++;
          hourlyData[hour].orders.push(order.order_number);
          processedOrders++;
        }
        
      } catch (error) {
        console.warn(`⚠️ Error processing order ${order.order_number}:`, error);
        skippedOrders++;
      }
    });
    
    console.log(`✅ Processed: ${processedOrders} orders`);
    console.log(`⚠️ Skipped: ${skippedOrders} orders\n`);
    
    // Calculate total allocations and average
    const totalAllocations = hourlyData.reduce((sum, hour) => sum + hour.count, 0);
    
    // Find the date range
    const validDates = orders
      .filter(order => order.allocated_at)
      .map(order => {
        try {
          if (order.allocated_at.toDate) {
            return order.allocated_at.toDate();
          } else {
            let timeStr = order.allocated_at;
            if (typeof timeStr === 'string' && timeStr.includes('T')) {
              timeStr = timeStr.replace('T', ' ');
            }
            return new Date(timeStr.replace(' ', 'T') + 'Z');
          }
        } catch {
          return null;
        }
      })
      .filter(date => date && !isNaN(date.getTime()))
      .sort((a, b) => a - b);
    
    const earliestDate = validDates[0];
    const latestDate = validDates[validDates.length - 1];
    const daysDifference = Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24));
    
    console.log(`📅 Date Range: ${earliestDate?.toDateString()} to ${latestDate?.toDateString()}`);
    console.log(`📆 Total Days: ${daysDifference} days`);
    console.log(`📊 Total Allocations: ${totalAllocations}\n`);
    
    // Display results
    console.log('🕐 HOURLY ALLOCATION BREAKDOWN:\n');
    console.log('Hour        │ Total Orders │ Avg per Day │ %');
    console.log('────────────┼──────────────┼─────────────┼────────');
    
    hourlyData.forEach(hour => {
      const avgPerDay = (hour.count / daysDifference).toFixed(1);
      const percentage = ((hour.count / totalAllocations) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(hour.count / totalAllocations * 20));
      
      console.log(`${hour.hourLabel.padEnd(11)} │ ${hour.count.toString().padStart(12)} │ ${avgPerDay.padStart(11)} │ ${percentage.padStart(5)}% ${bar}`);
    });
    
    // Summary statistics
    console.log('\n📈 SUMMARY STATISTICS:');
    console.log(`Average orders per hour overall: ${(totalAllocations / 24).toFixed(1)}`);
    console.log(`Average orders per day: ${(totalAllocations / daysDifference).toFixed(1)}`);
    
    // Peak hours
    const sortedHours = [...hourlyData].sort((a, b) => b.count - a.count);
    console.log('\n🔥 TOP 5 BUSIEST HOURS:');
    sortedHours.slice(0, 5).forEach((hour, index) => {
      const avgPerDay = (hour.count / daysDifference).toFixed(1);
      console.log(`${index + 1}. ${hour.hourLabel}: ${hour.count} total (${avgPerDay} avg/day)`);
    });
    
    // Business hours analysis (7 AM - 6 PM)
    const businessHours = hourlyData.slice(7, 18);
    const businessHoursTotal = businessHours.reduce((sum, hour) => sum + hour.count, 0);
    const businessHoursPercentage = ((businessHoursTotal / totalAllocations) * 100).toFixed(1);
    
    console.log('\n🏢 BUSINESS HOURS ANALYSIS (7 AM - 6 PM):');
    console.log(`Orders during business hours: ${businessHoursTotal} (${businessHoursPercentage}%)`);
    console.log(`Average per business hour: ${(businessHoursTotal / 11).toFixed(1)}`);
    
  } catch (error) {
    console.error('❌ Error analyzing allocation times:', error);
  }
}

// Run the analysis
analyzeAllocationTimes().then(() => {
  console.log('\n✅ Analysis complete!');
  process.exit(0);
}); 