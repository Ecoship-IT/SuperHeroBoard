import { Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from './App';
import EFMProductSizes from './EFMProductSizes';
// import SuperheroAlt from './SuperheroAlt'; // DISABLED: Not being used, has expensive real-time listeners
import ViewToggle from './ViewToggle';
import LevelUpLog from './LevelUpLog';
// import ComplianceBoard from './ComplianceBoard'; // DISABLED: Not being used, has expensive real-time listeners
import LocationBuilder from './LocationBuilder';
import Countdown from './Countdown';

const AppWrapper = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const location = useLocation();
  // Removed expensive polling - Dashboard component now uses real-time listeners (onSnapshot)
  // This saves ~$890/month in Firestore costs!

  // Removed needsShippedToday logic - no longer needed since we don't poll orders here
  /* const needsShippedToday = (order) => {
    // Check for ShipHero override first
    if (order && typeof order === 'object' && order.ship_today_override !== undefined) {
      return order.ship_today_override;
    }

    // Fall back to allocated_at calculation
    const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
    if (!allocatedAt) return false;
    
    // Parse timestamp correctly as UTC with error handling
    let alloc;
    try {
      if (allocatedAt.toDate) {
        alloc = allocatedAt.toDate();
      } else if (typeof allocatedAt === 'string') {
        // Handle both formats: "2024-01-15 10:30:00" and "2024-01-15T10:30:00"
        let timeStr = allocatedAt;
        if (allocatedAt.includes('T')) {
          timeStr = allocatedAt.replace('T', ' ');
        }
        // Parse as UTC since ShipHero sends UTC timestamps
        // Fixed: Use 'Z' suffix for proper UTC parsing
        alloc = new Date(timeStr.replace(' ', 'T') + 'Z');
      } else {
        alloc = new Date(allocatedAt);
      }
      
      // Validate the parsed date
      if (isNaN(alloc.getTime())) {
        console.warn('Invalid date parsed for needsShippedToday:', allocatedAt);
        return false;
      }
    } catch (error) {
      console.warn('Error parsing date for needsShippedToday:', allocatedAt, error);
      return false;
    }
    
    // Work entirely in UTC to avoid timezone conversion issues
    const allocUTC = new Date(alloc);
    
    // Get the date in Eastern time for determining the cutoff
    // 8 AM EST = 13:00 UTC (during EST months Nov-Mar)
    // 8 AM EDT = 12:00 UTC (during EDT months Mar-Nov)
    // We'll check if we're in DST using a reliable method
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
    
    // Compare just the date portion (UTC)
    const today = new Date();
    const shipDateStr = shipDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    return shipDateStr === todayStr;
  }; */

  // Auto-refresh fulfillment status data
  /* const performAutoRefresh = async () => {
    if (notToteCompleteCount === 0 || notToteCompleteCount > 60) {
      console.log(`⏭️ Skipping auto-refresh: ${notToteCompleteCount} orders (need ≤60 and >0)`);
      return;
    }

    setIsAutoRefreshing(true);
    console.log(`🔄 Auto-refreshing fulfillment status for ${notToteCompleteCount} orders...`);

    try {
      // Get the orders that need detailed analysis
      const ordersToShipToday = orders.filter(
        order => 
          needsShippedToday(order) &&
          !['shipped', 'canceled', 'cleared', 'deallocated', 'wholesale', 'manual'].includes(order.status) &&
          order.ready_to_ship === true
      );

      const notToteCompleteOrders = ordersToShipToday.filter(order => order.tote_completed !== true);

      // Process in chunks of 25 (same as manual refresh)
      const chunkSize = 25;
      for (let i = 0; i < notToteCompleteOrders.length; i += chunkSize) {
        const chunk = notToteCompleteOrders.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(notToteCompleteOrders.length / chunkSize);
        
        console.log(`📦 Auto-refresh chunk ${chunkNumber}/${totalChunks} (${chunk.length} orders)...`);
        
        // Query each order in the chunk
        const chunkPromises = chunk.map(async (order) => {
          try {
            const queryBody = {
              query: `
                query {
                  orders(order_number: "${order.order_number}") {
                    data {
                      edges {
                        node {
                          fulfillment_status
                          allocations {
                            is_locked
                          }
                        }
                      }
                    }
                  }
                }
              `
            };

            const response = await fetch('https://public-api.shiphero.com/graphql', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SHIPHERO_API_TOKEN}`
              },
              body: JSON.stringify(queryBody)
            });

            const data = await response.json();
            
            if (data.errors) {
              console.error(`❌ Auto-refresh error for order ${order.order_number}:`, data.errors);
              return null;
            }

            const orderData = data?.data?.orders?.data?.edges?.[0]?.node;
            return orderData ? {
              orderNumber: order.order_number,
              fulfillmentStatus: orderData.fulfillment_status,
              isLocked: orderData.allocations?.some(allocation => allocation.is_locked) || false
            } : null;
          } catch (error) {
            console.error(`❌ Error auto-refreshing order ${order.order_number}:`, error);
            return null;
          }
        });

        await Promise.all(chunkPromises);
        
        console.log(`✅ Auto-refresh completed chunk ${chunkNumber}/${totalChunks}`);
        
        // 2 second delay between chunks
        if (i + chunkSize < notToteCompleteOrders.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setLastAutoRefresh(new Date());
      console.log(`✅ Auto-refresh complete for ${notToteCompleteOrders.length} orders`);
    } catch (error) {
      console.error('❌ Auto-refresh error:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  }; */

  // Countdown timer effect
  /* useEffect(() => {
    if (!autoRefreshEnabled || isAutoRefreshing) return;

    const interval = setInterval(() => {
      setTimeUntilRefresh(prev => {
        if (prev <= 1) {
          // Time to refresh!
          performAutoRefresh();
          return 300; // Reset to 5 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, isAutoRefreshing, notToteCompleteCount, orders]); */

  // Manual refresh trigger
  /* const triggerManualRefresh = () => {
    setTimeUntilRefresh(300); // Reset timer
    performAutoRefresh();
  }; */

  // Format time for display
  /* const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }; */

  return (
    <>
      {/* ViewToggle - always show since Dashboard handles data loading */}
      <ViewToggle />
      
      {/* Global Auto-Refresh Status - Hidden on countdown page */}
      {/* {autoRefreshEnabled && notToteCompleteCount <= 60 && notToteCompleteCount > 0 && location.pathname !== '/countdown' && (
        <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-40 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Auto-Refresh Status</h3>
            <button
              onClick={() => setAutoRefreshEnabled(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
              title="Disable auto-refresh"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Orders to monitor:</span>
              <span className="font-semibold">{notToteCompleteCount}</span>
            </div>
            
            {isAutoRefreshing ? (
              <div className="flex items-center space-x-2 text-xs text-blue-600">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Updating fulfillment status...</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Next refresh in:</span>
                <span className="font-mono font-semibold text-gray-800">{formatTime(timeUntilRefresh)}</span>
              </div>
            )}
            
            {lastAutoRefresh && (
              <div className="text-xs text-gray-500">
                Last updated: {lastAutoRefresh.toLocaleTimeString()}
              </div>
            )}
            
            <button
              onClick={triggerManualRefresh}
              disabled={isAutoRefreshing}
              className="w-full text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAutoRefreshing ? 'Updating...' : 'Refresh Now'}
            </button>
          </div>
        </div>
      )} */}
      
      {/* Re-enable auto-refresh button when disabled - Hidden on countdown page */}
      {/* {!autoRefreshEnabled && notToteCompleteCount <= 60 && notToteCompleteCount > 0 && location.pathname !== '/countdown' && (
        <div className="fixed bottom-4 left-4 bg-gray-100 rounded-lg shadow-lg border border-gray-300 p-3 z-40">
          <button
            onClick={() => {
              setAutoRefreshEnabled(true);
              setTimeUntilRefresh(300);
            }}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Enable Auto-Refresh
          </button>
        </div>
      )} */}

            <Routes>
        <Route path="/" element={<Dashboard isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
        {/* DISABLED: Not being used, has expensive real-time listeners */}
        {/* <Route path="/superhero-alt" element={<SuperheroAlt isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} /> */}
        {/* Hidden Level Up Log - accessible via direct URL only */}
        <Route path="/level-up-log" element={<LevelUpLog isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
        <Route path="/location-builder" element={<LocationBuilder isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
        {/* DISABLED: Not being used, has expensive real-time listeners */}
        {/* <Route path="/compliance-board" element={<ComplianceBoard isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} /> */}
        <Route path="/countdown" element={<Countdown isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
        {/* Only show EFM Product Sizes to admin users */}
        {isAuthenticated && userRole === 'admin' && (
          <Route path="/efm-product-sizes" element={<EFMProductSizes isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
        )}
      </Routes>
    </>
  );
};

export default AppWrapper; 