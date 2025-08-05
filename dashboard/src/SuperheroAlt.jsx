import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const SuperheroAlt = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [detailedOrderData, setDetailedOrderData] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Parse client mappings from environment variable
  const accountMap = useMemo(() => {
    const clientMappings = import.meta.env.VITE_CLIENT_MAPPINGS;
    if (!clientMappings) {
      console.warn('VITE_CLIENT_MAPPINGS not configured. Client names will show as UUIDs.');
      return {};
    }
    
    try {
      return JSON.parse(clientMappings);
    } catch (error) {
      console.error('Error parsing VITE_CLIENT_MAPPINGS:', error);
      return {};
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  const needsShippedToday = (order) => {
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
  };

  // Calculate tote completion status for today's orders (using exact same logic as main dashboard)
  const toteStatusCounts = useMemo(() => {
    const ordersToShipToday = orders.filter(
      order => 
        needsShippedToday(order) &&
        !['shipped', 'canceled', 'cleared', 'deallocated', 'wholesale', 'manual'].includes(order.status) &&
        order.ready_to_ship === true  // This was missing! Same filter as main dashboard
    );

    const toteComplete = ordersToShipToday.filter(order => order.tote_completed === true).length;
    const notToteComplete = ordersToShipToday.filter(order => order.tote_completed !== true).length;

    // Enhanced debug logging
    console.log('🔍 Tote Status Debug:', {
      totalOrders: orders.length,
      ordersToShipToday: ordersToShipToday.length,
      toteComplete,
      notToteComplete,
      sampleOrders: ordersToShipToday.slice(0, 5).map(o => ({
        orderNumber: o.order_number,
        toteCompleted: o.tote_completed,
        toteCompletedType: typeof o.tote_completed,
        readyToShip: o.ready_to_ship,
        status: o.status,
        allFields: Object.keys(o).filter(key => key.includes('tote')).reduce((acc, key) => {
          acc[key] = o[key];
          return acc;
        }, {})
      })),
      // Check if ANY orders have tote_completed field
      ordersWith_tote_completed: orders.filter(o => o.tote_completed !== undefined).length,
      ordersWith_tote_completed_true: orders.filter(o => o.tote_completed === true).length,
      ordersWith_tote_completed_string: orders.filter(o => o.tote_completed === 'true').length,
      // Sample of all tote-related fields across all orders
      allToteFields: [...new Set(orders.flatMap(o => Object.keys(o).filter(key => key.toLowerCase().includes('tote'))))],
      // Also check for completion-related fields
      completionFields: [...new Set(orders.flatMap(o => Object.keys(o).filter(key => 
        key.toLowerCase().includes('complet') || 
        key.toLowerCase().includes('finish') || 
        key.toLowerCase().includes('done') ||
        key.toLowerCase().includes('ready')
      )))],
      // Show first order's full field list for reference
      sampleOrderFields: ordersToShipToday.length > 0 ? Object.keys(ordersToShipToday[0]).sort() : []
    });

    return { 
      toteComplete, 
      notToteComplete, 
      total: ordersToShipToday.length,
      ordersToShipToday // Include the actual orders for detailed analysis
    };
  }, [orders]);

  // Function to query ShipHero for detailed order information
  const queryOrderDetails = async (orderNumber) => {
    try {
      const queryBody = {
        query: `
          query {
            orders(order_number: "${orderNumber}") {
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

      console.log(`🔍 Querying ShipHero for order: ${orderNumber}`);

      const response = await fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SHIPHERO_API_TOKEN}`
        },
        body: JSON.stringify(queryBody)
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error for order ${orderNumber}: ${response.status} ${response.statusText}`);
        const responseText = await response.text();
        console.error(`Response: ${responseText}`);
        return null;
      }

      const data = await response.json();
      console.log(`📥 Response for order ${orderNumber}:`, data);

      if (data.errors) {
        console.error(`❌ GraphQL Error for order ${orderNumber}:`, data.errors);
        return null;
      }

      const orderData = data?.data?.orders?.data?.edges?.[0]?.node;
      if (!orderData) {
        console.warn(`⚠️ No data found for order ${orderNumber}`);
        return null;
      }

      return {
        orderNumber,
        fulfillmentStatus: orderData.fulfillment_status,
        allocations: orderData.allocations || [],
        isLocked: orderData.allocations?.some(allocation => allocation.is_locked) || false
      };
    } catch (error) {
      console.error(`❌ Error querying order ${orderNumber}:`, error);
      return null;
    }
  };

  // Function to load detailed data for all remaining orders
  const loadDetailedOrderData = async () => {
    const notToteCompleteOrders = toteStatusCounts.ordersToShipToday.filter(
      order => order.tote_completed !== true
    );

    if (notToteCompleteOrders.length === 0) {
      setDetailedOrderData([]);
      return;
    }

    setIsLoadingDetails(true);
    console.log(`🔄 Loading detailed data for ${notToteCompleteOrders.length} orders...`);

    try {
      // Process orders in chunks to avoid overwhelming the API (same as refresh button)
      const chunkSize = 25;
      const results = [];

      for (let i = 0; i < notToteCompleteOrders.length; i += chunkSize) {
        const chunk = notToteCompleteOrders.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(notToteCompleteOrders.length / chunkSize);
        
        console.log(`📦 Processing fulfillment status chunk ${chunkNumber}/${totalChunks} (${chunk.length} orders)...`);
        
        const chunkPromises = chunk.map(order => queryOrderDetails(order.order_number));
        const chunkResults = await Promise.all(chunkPromises);
        
        results.push(...chunkResults.filter(result => result !== null));
        
        console.log(`✅ Completed chunk ${chunkNumber}/${totalChunks}`);
        
        // 2 second delay between chunks (same as refresh button)
        if (i + chunkSize < notToteCompleteOrders.length) {
          console.log(`⏰ Waiting 2 seconds before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setDetailedOrderData(results);
      console.log(`✅ Loaded detailed data for ${results.length} orders`);
    } catch (error) {
      console.error('❌ Error loading detailed order data:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Auto-load detailed data when not-tote-complete orders <= 60
  useEffect(() => {
    console.log(`🔍 Checking detailed data trigger: notToteComplete=${toteStatusCounts.notToteComplete}`);
    
    if (toteStatusCounts.notToteComplete <= 60 && toteStatusCounts.notToteComplete > 0) {
      console.log(`✅ Triggering detailed analysis for ${toteStatusCounts.notToteComplete} orders`);
      console.log(`🔧 API Token configured: ${import.meta.env.VITE_SHIPHERO_API_TOKEN ? 'Yes' : 'No'}`);
      loadDetailedOrderData();
    } else {
      console.log(`❌ Not triggering detailed analysis (${toteStatusCounts.notToteComplete} orders)`);
      setDetailedOrderData([]);
    }
  }, [toteStatusCounts.notToteComplete]);

  // Calculate fulfillment status breakdown
  const fulfillmentStatusBreakdown = useMemo(() => {
    if (detailedOrderData.length === 0) return [];

    const statusMap = {};
    
    detailedOrderData.forEach(orderData => {
      const status = orderData.fulfillmentStatus || 'Unknown';
      if (!statusMap[status]) {
        statusMap[status] = { locked: 0, unlocked: 0, total: 0 };
      }
      
      if (orderData.isLocked) {
        statusMap[status].locked++;
      } else {
        statusMap[status].unlocked++;
      }
      statusMap[status].total++;
    });

    return Object.entries(statusMap).map(([status, counts]) => ({
      status,
      ...counts
    })).sort((a, b) => b.total - a.total);
  }, [detailedOrderData]);

  // Calculate total locked orders count
  const totalLockedOrders = useMemo(() => {
    return detailedOrderData.reduce((total, orderData) => {
      return total + (orderData.isLocked ? 1 : 0);
    }, 0);
  }, [detailedOrderData]);

  // Calculate "still needs picked" count (not tote complete - locked)
  const stillNeedsPicked = useMemo(() => {
    if (toteStatusCounts.notToteComplete <= 60 && detailedOrderData.length > 0) {
      return Math.max(0, toteStatusCounts.notToteComplete - totalLockedOrders);
    }
    return 0;
  }, [toteStatusCounts.notToteComplete, totalLockedOrders, detailedOrderData.length]);

  return (
    <div className="relative min-h-screen">
      {/* Hamburger Menu Button - Desktop only */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="hidden md:block fixed top-4 left-4 z-50 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
      >
        <svg 
          className="w-6 h-6 text-gray-700" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 6h16M4 12h16M4 18h16" 
          />
        </svg>
      </button>



      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ 
          height: '100dvh',
          maxHeight: '100vh'
        }}
      >
        <div className="bg-gray-800 pl-6 pr-8 pt-4 pb-5 mb-4 relative">
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute -right-0 top-2 p-2 rounded-md hover:bg-gray-700 transition-colors duration-200"
          >
            <svg
              className="w-6 h-6 text-gray-100"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <img 
            src="/ES+hollow+-+trans (1).png" 
            alt="ES+Hollow Logo" 
            className="w-full"
          />
        </div>
        <div className="px-4">
          <nav className="space-y-4">
            <Link 
              to="/" 
              className="block px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-lg font-semibold border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300"
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>SuperHero Board</span>
              </div>
            </Link>
            {/* Temporarily hidden Level Up Log */}
            {/* <Link 
              to="/level-up-log" 
              className="block px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-lg font-semibold border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300"
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span>Level Up Log</span>
              </div>
            </Link> */}
            {isAuthenticated && userRole === 'admin' && (
              <Link 
                to="/efm-product-sizes" 
                className="block px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-lg font-semibold border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300"
              >
                <div className="flex items-center space-x-2">
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 0 01-2-2v-2z"
                    />
                  </svg>
                  <span>EFM Product Sizes</span>
                </div>
              </Link>
            )}
            <Link 
              to="/location-builder" 
              className="block px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-lg font-semibold border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300"
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span>Location Builder</span>
              </div>
            </Link>
            <Link 
              to="/compliance-board" 
              className="block px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 text-lg font-semibold border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-gray-300"
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span>Compliance Board</span>
              </div>
            </Link>
          </nav>
          
          {/* Logout Button at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <button
              onClick={() => {
                console.log('Logout clicked, onLogout function:', onLogout);
                if (onLogout) {
                  onLogout();
                } else {
                  console.error('onLogout function is not defined');
                }
              }}
              className="block w-full px-6 py-3 text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 text-lg font-semibold border border-red-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-red-300"
            >
              <div className="flex items-center space-x-2">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full md:w-[90%] lg:w-[85%] mx-auto px-4 font-sans">
        <>
          {/* Mobile Header Row - Only visible on mobile */}
          <div className="block md:hidden pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Mobile Hamburger Button */}
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
                >
                  <svg 
                    className="w-6 h-6 text-gray-700" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 6h16M4 12h16M4 18h16" 
                    />
                  </svg>
                </button>
                {/* Mobile Count/Status toggle */}
                <div className="flex items-center bg-gray-200 rounded-full p-1">
                  <Link
                    to="/"
                    className="px-3 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                  >
                    Count
                  </Link>
                  <Link
                    to="/superhero-alt"
                    className="px-3 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 text-white shadow-sm"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    Status
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout - Hidden on mobile */}
          <div className="hidden md:block relative pt-10">
            <div className="text-center">
              <h1 className="text-6xl font-extrabold tracking-tight text-slate-800 mb-2">⚡ SuperHero Board ⚡</h1>
              <p className="text-slate-500 text-lg font-medium mb-8 pt-2">
                Tote completion status for today's orders
              </p>
            </div>
          </div>

          {/* Mobile Title - Only visible on mobile */}
          <div className="block md:hidden text-center pt-4 pb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 mb-2">⚡ SuperHero Board ⚡</h1>
            <p className="text-slate-500 text-base font-medium">
              Tote completion status for today's orders
            </p>
          </div>

          {/* Tote Status Display */}
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-12 mt-6 md:mt-20 pt-2 md:pt-5">
            <div className="flex flex-col justify-start pt-2 flex-1">
              <div className="text-6xl md:text-9xl font-extrabold text-slate-800 mb-2 text-left">{toteStatusCounts.toteComplete}</div>
              <div className="text-2xl md:text-4xl text-slate-600 font-medium text-left mb-1">📦 In a tote</div>
              <div className="text-base md:text-lg text-slate-600 font-medium text-left mb-4 md:mb-8">Orders due today that are in completed totes</div>
              
              <div className="text-6xl md:text-9xl font-extrabold text-slate-700 mb-2 text-left pt-6 md:pt-10">{toteStatusCounts.notToteComplete}</div>
              <div className="text-2xl md:text-4xl text-slate-500 font-medium text-left mb-1">⏳ Not in a tote</div>
              <div className="text-base md:text-lg text-slate-500 font-medium text-left mb-1">Orders due today still being processed</div>
              
              {/* Show "Still needs picked" when under 60 orders and we have detailed data */}
              {toteStatusCounts.notToteComplete <= 60 && toteStatusCounts.notToteComplete > 0 && detailedOrderData.length > 0 && (
                <>
                  <div className="text-6xl md:text-9xl font-extrabold text-red-600 mb-2 text-left pt-6 md:pt-10">{stillNeedsPicked}</div>
                  <div className="text-2xl md:text-4xl text-red-700 font-medium text-left mb-1">📋 Still needs picked</div>
                  <div className="text-base md:text-lg text-red-600 font-medium text-left mb-1">Orders waiting to be picked (not locked)</div>
                </>
              )}
            </div>

            <div className="flex-1 w-full h-full">
              <div className="h-full">
                {/* Show detailed fulfillment status table when <= 60 orders remain */}
                {toteStatusCounts.notToteComplete <= 60 && toteStatusCounts.notToteComplete > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-2xl font-bold text-slate-800">🔍 Fulfillment Status Breakdown</h2>
                      <div className="flex items-center gap-3">
                        {!isLoadingDetails && (
                          <button
                            onClick={loadDetailedOrderData}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Refresh Details
                          </button>
                        )}
                        {isLoadingDetails && (
                          <div className="flex items-center text-blue-600">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm">Loading details...</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <p className="text-sm text-gray-600">
                          Detailed analysis of {toteStatusCounts.notToteComplete} remaining orders
                        </p>
                      </div>
                      
                      {fulfillmentStatusBreakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Fulfillment Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  ⏳ Not in Totes
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  🔒 Locked
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  📋 Need Picked
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {fulfillmentStatusBreakdown.map((statusData, idx) => {
                                const needPicked = Math.max(0, statusData.total - statusData.locked);
                                return (
                                  <tr key={statusData.status} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {statusData.status}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-700 font-semibold">
                                      {statusData.total}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-semibold">
                                      {statusData.locked}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                                      {needPicked}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : isLoadingDetails ? (
                        <div className="p-8 text-center text-gray-500">
                          <div className="inline-flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Querying ShipHero for order details...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <p>No detailed data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Original summary when > 60 orders remain */
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">📊 Tote Completion Summary</h2>
                    <div className="bg-white p-6 rounded-xl shadow-lg border">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium text-gray-700">Total Orders Due Today:</span>
                          <span className="text-2xl font-bold text-slate-800">{toteStatusCounts.total}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium text-slate-600">Tote Complete:</span>
                          <span className="text-2xl font-bold text-slate-800">{toteStatusCounts.toteComplete}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium text-slate-500">Not Tote Complete:</span>
                          <span className="text-2xl font-bold text-slate-700">{toteStatusCounts.notToteComplete}</span>
                        </div>
                        <div className="border-t pt-4">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-medium text-gray-700">Completion Rate:</span>
                            <span className="text-2xl font-bold text-slate-800">
                              {toteStatusCounts.total > 0 ? Math.round((toteStatusCounts.toteComplete / toteStatusCounts.total) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-8">
                      <h3 className="text-xl font-bold text-slate-800 mb-3">Completion Progress</h3>
                      <div className="w-full bg-gray-200 rounded-full h-8">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-600 h-8 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${toteStatusCounts.total > 0 ? (toteStatusCounts.toteComplete / toteStatusCounts.total) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      </div>
    </div>
  );
};

export default SuperheroAlt; 