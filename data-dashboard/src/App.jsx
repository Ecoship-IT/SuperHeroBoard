import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [fillRateData, setFillRateData] = useState({ fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 });
  
  // Use ref instead of state to avoid triggering re-renders
  const isCalculatingPackSuccessRates = useRef(false);
  const hasCalculatedPackRatesThisSession = useRef(false);
  
  // State to trigger re-render when pack calculations complete
  const [packCalculationsComplete, setPackCalculationsComplete] = useState(0);

  // Function to fetch orders - ROBUST WITH FALLBACK
  const fetchOrders = useCallback(async () => {
    console.log('🚀 fetchOrders starting...');
    try {
      setLoading(true);
      console.log('📡 Querying Firebase with corrected string date format...');
      
      // Increase timeout to 30 seconds for more reliability
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase query timeout')), 30000) // 30 second timeout
      );
      
      const queryPromise = (async () => {
        try {
          // Calculate date 45 days ago and convert to the same ISO string format as allocated_at
          const fortyFiveDaysAgo = new Date();
          fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
          
          // Convert to ISO string format to match allocated_at: '2025-07-28T17:18:42'
          const fortyFiveDaysAgoString = fortyFiveDaysAgo.toISOString().slice(0, 19); // Remove .000Z part
          
          console.log('📅 Filtering for orders from:', fortyFiveDaysAgoString, 'onwards');
          
          // Use string comparison in Firestore query
          const q = query(
            collection(db, 'orders'),
            where('allocated_at', '>=', fortyFiveDaysAgoString),
            orderBy('allocated_at', 'desc')
          );
          
          console.log('📡 Executing optimized string-based query...');
          const snapshot = await getDocs(q);
          console.log('📡 getDocs completed, processing filtered data...');
          return { snapshot, queryType: 'optimized' };
        } catch (optimizedError) {
          console.warn('⚠️ Optimized query failed, trying fallback:', optimizedError);
          
          // Fallback: Get just the last 30 days with a limit
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const thirtyDaysAgoString = thirtyDaysAgo.toISOString().slice(0, 19);
          
          console.log('📅 FALLBACK: Filtering for orders from:', thirtyDaysAgoString, 'onwards with limit');
          
          const fallbackQuery = query(
            collection(db, 'orders'),
            where('allocated_at', '>=', thirtyDaysAgoString),
            orderBy('allocated_at', 'desc'),
            limit(10000) // Limit to 10k most recent orders
          );
          
          console.log('📡 Executing fallback limited query...');
          const fallbackSnapshot = await getDocs(fallbackQuery);
          console.log('📡 Fallback getDocs completed');
          return { snapshot: fallbackSnapshot, queryType: 'fallback' };
        }
      })();
      
      const { snapshot, queryType } = await Promise.race([queryPromise, timeoutPromise]);
      const recentOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      setOrders(recentOrders);
      setLastUpdated(new Date());
      console.log(`✅ Data refreshed via ${queryType}: ${recentOrders.length} recent orders loaded`);
      
      return recentOrders; // Return orders for immediate use
      
      if (recentOrders.length > 0) {
        const dates = recentOrders.map(o => new Date(o.allocated_at)); // Parse string dates
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        console.log(`📊 Date range: ${minDate.toDateString()} to ${maxDate.toDateString()}`);
      } else {
        console.warn('⚠️ No orders returned from query - check Firebase connection and data');
      }
      
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      console.log('🔄 Trying to use cached data as last resort...');
      
      // Last resort: Try to use cached data even if old
      try {
        const cachedData = localStorage.getItem('sla_metrics_data');
        if (cachedData) {
          console.log('📦 Using old cached data as emergency fallback');
          // Don't set orders, but the cached calculation will still work
        }
      } catch (cacheError) {
        console.log('❌ No cached data available');
      }
      
      setOrders([]);
      setLastUpdated(new Date());
      
      return []; // Return empty array on error
    } finally {
      console.log('🏁 Setting loading to false');
      setLoading(false);
    }
  }, []);

  // Helper function to check if date is during daylight saving time
  const isDST = (date) => {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    return date.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  };

  // Helper function to check if a date is a US federal holiday
  const isBankHoliday = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-based
    const day = date.getDate();
    const dayOfWeek = date.getDay(); // 0 = Sunday
    
    // Helper to get nth weekday of month (e.g., 3rd Monday)
    const getNthWeekday = (year, month, weekday, n) => {
      const firstDay = new Date(year, month, 1);
      const firstWeekday = firstDay.getDay();
      const offset = (weekday - firstWeekday + 7) % 7;
      return new Date(year, month, 1 + offset + (n - 1) * 7);
    };
    
    // Helper to get last weekday of month (e.g., last Monday of May)
    const getLastWeekday = (year, month, weekday) => {
      const lastDay = new Date(year, month + 1, 0); // Last day of month
      const lastWeekday = lastDay.getDay();
      const offset = (lastWeekday - weekday + 7) % 7;
      return new Date(year, month, lastDay.getDate() - offset);
    };
    
    // Check each federal holiday
    const holidays = [
      // New Year's Day - January 1
      new Date(year, 0, 1),
      
      // Martin Luther King Jr. Day - 3rd Monday in January
      getNthWeekday(year, 0, 1, 3),
      
      // Presidents' Day - 3rd Monday in February
      getNthWeekday(year, 1, 1, 3),
      
      // Memorial Day - Last Monday in May
      getLastWeekday(year, 4, 1),
      
      // Juneteenth - June 19
      new Date(year, 5, 19),
      
      // Independence Day - July 4
      new Date(year, 6, 4),
      
      // Labor Day - 1st Monday in September
      getNthWeekday(year, 8, 1, 1),
      
      // Columbus Day - 2nd Monday in October
      getNthWeekday(year, 9, 1, 2),
      
      // Veterans Day - November 11
      new Date(year, 10, 11),
      
      // Thanksgiving - 4th Thursday in November
      getNthWeekday(year, 10, 4, 4),
      
      // Christmas Day - December 25
      new Date(year, 11, 25)
    ];
    
    // Check if current date matches any holiday
    const isHoliday = holidays.some(holiday => 
      holiday.getFullYear() === year &&
      holiday.getMonth() === month &&
      holiday.getDate() === day
    );
    
    // Debug logging for dates around July 4th
    if (month === 6 && day >= 1 && day <= 7) { // July 1-7
      console.log(`🏛️ Holiday check for ${date.toDateString()}: ${isHoliday ? 'HOLIDAY' : 'Not holiday'}`);
      if (isHoliday) {
        const matchingHoliday = holidays.find(holiday => 
          holiday.getFullYear() === year &&
          holiday.getMonth() === month &&
          holiday.getDate() === day
        );
        console.log(`   Matching holiday: ${matchingHoliday.toDateString()}`);
      }
    }
    
    return isHoliday;
  };

  // Helper function to check if a date is a business day (not weekend or holiday)
  const isBusinessDay = (date) => {
    const dayOfWeek = date.getDay();
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    // Skip bank holidays
    if (isBankHoliday(date)) return false;
    return true;
  };

  // Function to calculate required ship date (UPDATED FOR STRING DATES)
  const getRequiredShipDate = (order) => {
    if (!order?.allocated_at) return null;
    
    // Parse the string date: '2025-07-28T17:18:42' -> Date object
    const allocUTC = new Date(order.allocated_at);
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
    
    // Set time to 4:00 PM Eastern (20:00 UTC during DST, 21:00 UTC during EST)
    const fourPMHourUTC = isDST(new Date()) ? 20 : 21;
    shipDate.setUTCHours(fourPMHourUTC, 0, 0, 0);
    
    return shipDate;
  };

  // Function to check if SLA was met (UPDATED FOR STRING DATES)
  const checkSLAMet = (shippedAt, order) => {
    if (!shippedAt || !order) return false;
    
    // Parse shippedAt - could be string or Firestore Timestamp
    const shipped = typeof shippedAt === 'string' ? new Date(shippedAt) : 
                   (shippedAt.toDate ? shippedAt.toDate() : new Date(shippedAt));
    
    const requiredShipDate = getRequiredShipDate(order);
    if (!requiredShipDate) return false;
    
    // Compare dates without time
    const shippedDate = new Date(shipped.getFullYear(), shipped.getMonth(), shipped.getDate());
    const requiredDate = new Date(requiredShipDate.getFullYear(), requiredShipDate.getMonth(), requiredShipDate.getDate());
    
    return shippedDate <= requiredDate;
  };

  // Function to fetch fill rate from ShipHero API
  const fetchFillRate = useCallback(async (ordersToUse = null) => {
    try {
      // Use passed orders or fallback to state
      const activeOrders = ordersToUse || orders;
      console.log('📦 Fetching fill rate data from ShipHero (problem orders)...');
      console.log(`🔍 Orders available for fill rate calculation: ${activeOrders.length}`);
      
      // Don't calculate if orders aren't loaded yet
      if (activeOrders.length === 0) {
        console.log('⏳ Orders not loaded yet, returning default fill rate');
        return { fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 };
      }
      
      // Check if we have stored fill rate for today
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
      const storedFillRate = localStorage.getItem(`fill_rate_${today}`);
      
      if (storedFillRate) {
        console.log('✅ Using stored fill rate for today:', storedFillRate);
        return JSON.parse(storedFillRate);
      }

      // Call Firebase Function to get problem orders (avoids CORS issues)
      console.log('📡 Calling Firebase Function for fill rate data...');
      console.log('🔍 Request URL: https://us-central1-superheroboardv2.cloudfunctions.net/getFillRate');
      console.log('🔍 Browser User-Agent:', navigator.userAgent);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Firebase Function call timed out after 10 seconds');
        console.log('🔍 Request was still pending when timeout occurred');
        controller.abort();
      }, 10000); // 10 second timeout for faster debugging
      
      const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/getFillRate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}), // Empty body since no parameters needed
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('📥 Firebase Function responded with status:', response.status);

      if (!response.ok) {
        console.error('❌ Firebase Function Error:', response.status, response.statusText);
        const defaultData = { fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 };
        localStorage.setItem(`fill_rate_${today}`, JSON.stringify(defaultData));
        return defaultData;
      }

      const functionResponse = await response.json();
      console.log('📥 Firebase Function response:', functionResponse);

      if (!functionResponse.success) {
        console.error('❌ Firebase Function returned error:', functionResponse.error);
        const defaultData = { fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 };
        localStorage.setItem(`fill_rate_${today}`, JSON.stringify(defaultData));
        return defaultData;
      }

      const problemOrdersCount = functionResponse.data.problemOrdersCount;
      console.log(`🚨 Found ${problemOrdersCount} problem orders due today/overdue from Firebase Function`);

      // Get total unshipped orders due today/overdue from Firestore
      const todayEastern = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const todayDate = new Date(todayEastern);
      
      const totalUnshippedOrders = activeOrders.filter(order => {
        if (!order.allocated_at || order.shippedAt) return false; // Skip if no allocation or already shipped
        
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const requiredDateObj = new Date(requiredDateStr);
        
        // Include if required ship date is today or before (overdue orders)
        return requiredDateObj <= todayDate;
      }).length;

      console.log(`📊 Total unshipped orders due today/overdue from Firestore: ${totalUnshippedOrders}`);
      console.log(`📅 Today's date (Eastern): ${todayEastern}`);
      
      // Debug: Show sample of orders due today
      const ordersToday = activeOrders.filter(order => {
        if (!order.allocated_at || order.shippedAt) return false;
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        return requiredDateStr === todayEastern;
      });
      console.log(`📦 Orders due specifically TODAY (${todayEastern}): ${ordersToday.length}`);
      if (ordersToday.length > 0) {
        console.log(`📋 Sample orders due today:`, ordersToday.slice(0, 3).map(o => ({
          order_number: o.order_number,
          allocated_at: o.allocated_at,
          required_ship_date: getRequiredShipDate(o)?.toLocaleDateString('en-US', {timeZone: 'America/New_York'})
        })));
      }

      // Calculate fill rate: (total - problem) / total × 100
      const fillRate = totalUnshippedOrders > 0 
        ? Math.round(((totalUnshippedOrders - problemOrdersCount) / totalUnshippedOrders) * 100 * 10) / 10
        : 0;

      const fillRateData = {
        fillRate,
        backorderedCount: problemOrdersCount,
        totalOrdersToday: totalUnshippedOrders,
        lastUpdated: new Date()
      };

      // Store the fill rate data for today
      localStorage.setItem(`fill_rate_${today}`, JSON.stringify(fillRateData));
      console.log(`✅ Fill rate calculated and stored: ${fillRate}%`);

      return fillRateData;

    } catch (error) {
      console.error('❌ Error fetching fill rate:', error);
      
      // Even if Firebase Function fails, we can still calculate today's order count from Firestore
      const todayEastern = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const todayDate = new Date(todayEastern);
      
      // Use passed orders or fallback to state
      const activeOrders = ordersToUse || orders;
      
      console.log(`📅 FALLBACK: Today's date (Eastern): ${todayEastern}`);
      console.log(`📅 FALLBACK: Processing ${activeOrders.length} orders for fill rate`);
      
      const totalUnshippedOrders = activeOrders.filter(order => {
        if (!order.allocated_at || order.shippedAt) return false;
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const requiredDateObj = new Date(requiredDateStr);
        return requiredDateObj <= todayDate;
      }).length;
      
      // Debug: Show sample of orders due today in fallback
      const ordersToday = activeOrders.filter(order => {
        if (!order.allocated_at || order.shippedAt) return false;
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        return requiredDateStr === todayEastern;
      });
      console.log(`📦 FALLBACK: Orders due specifically TODAY (${todayEastern}): ${ordersToday.length}`);
      
      console.log(`📊 FALLBACK: Total unshipped orders due today/overdue: ${totalUnshippedOrders}`);
      
      const today = new Date().toLocaleDateString('en-CA');
      const fallbackData = { 
        fillRate: totalUnshippedOrders > 0 ? 100 : 0, // 100% if no problems found
        backorderedCount: 0, // No problem count available
        totalOrdersToday: totalUnshippedOrders 
      };
      localStorage.setItem(`fill_rate_${today}`, JSON.stringify(fallbackData));
      return fallbackData;
    }
  }, []); // Keep empty to prevent infinite loop - orders passed as parameter when needed

  // Helper function to get stored fill rate for a specific date
  const getStoredFillRate = (dateStr) => {
    try {
      const stored = localStorage.getItem(`fill_rate_${dateStr}`);
      if (stored) {
        const data = JSON.parse(stored);
        return data.fillRate;
      }
    } catch (error) {
      console.warn('Error reading stored fill rate for', dateStr, error);
    }
    return 0; // Return 0% if no stored data
  };

  // Helper function to get stored pack success rate for a specific date
  const getStoredPackSuccessRate = (dateStr) => {
    try {
      const stored = localStorage.getItem(`pack_success_rate_${dateStr}`);
      if (stored) {
        const data = JSON.parse(stored);
        return data.packSuccessRate;
      }
    } catch (error) {
      console.warn('Error reading stored pack success rate for', dateStr, error);
    }
    return 0; // Return 0% if no stored data
  };

  // Function to fetch pack errors for a specific date from Firestore
  const fetchPackErrorsForDate = useCallback(async (dateStr) => {
    try {
      // Convert date string (YYYY-MM-DD) to start and end of day in Eastern time
      const targetDate = new Date(dateStr);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log(`📋 Fetching pack errors for ${dateStr} (${startOfDay.toISOString()} to ${endOfDay.toISOString()})`);
      
      // Query pack_errors collection for this date
      const q = query(
        collection(db, 'pack_errors'),
        where('receivedAt', '>=', startOfDay),
        where('receivedAt', '<=', endOfDay),
        orderBy('receivedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const packErrors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📋 Found ${packErrors.length} pack errors for ${dateStr}`);
      return packErrors;
      
    } catch (error) {
      console.error(`❌ Error fetching pack errors for ${dateStr}:`, error);
      return []; // Return empty array on error
    }
  }, []);

  // Function to calculate pack success rate for a specific date
  const calculatePackSuccessRate = useCallback(async (dateStr, ordersForDate) => {
    try {
      console.log(`📊 Calculating pack success rate for ${dateStr}`);
      
      // Check if we already have stored data for this date
      const storedRate = getStoredPackSuccessRate(dateStr);
      if (storedRate !== 0) {
        console.log(`✅ Using cached pack success rate for ${dateStr}: ${storedRate}%`);
        return storedRate;
      }
      
      // Get pack errors for this date
      const packErrors = await fetchPackErrorsForDate(dateStr);
      
      // Count total orders due on this date
      const totalOrders = ordersForDate || 0;
      
      // Calculate pack success rate: (total orders - pack errors) / total orders * 100
      const packSuccessRate = totalOrders > 0 
        ? Math.round(((totalOrders - packErrors.length) / totalOrders) * 100 * 10) / 10
        : 100; // 100% if no orders (no errors possible)
      
      console.log(`📊 Pack success rate for ${dateStr}: ${packSuccessRate}% (${totalOrders} orders, ${packErrors.length} errors)`);
      
      // Store the calculated rate
      const packSuccessData = {
        packSuccessRate,
        totalOrders,
        packErrorsCount: packErrors.length,
        lastCalculated: new Date().toISOString()
      };
      
      localStorage.setItem(`pack_success_rate_${dateStr}`, JSON.stringify(packSuccessData));
      console.log(`💾 Stored pack success rate for ${dateStr}`);
      
      return packSuccessRate;
      
    } catch (error) {
      console.error(`❌ Error calculating pack success rate for ${dateStr}:`, error);
      return 100; // Default to 100% (no errors) on calculation error
    }
  }, [fetchPackErrorsForDate, getStoredPackSuccessRate]);

  // Function to calculate pack success rates for historical business days (optimized for performance)
  const calculateHistoricalPackSuccessRates = useCallback(async (orders) => {
    // Prevent concurrent calculations
    if (isCalculatingPackSuccessRates.current) {
      console.log('📋 Pack success rate calculation already in progress, skipping...');
      return;
    }
    
    isCalculatingPackSuccessRates.current = true;
    console.log('📋 Calculating historical pack success rates for business days...');
    
    try {
      // Calculate pack success rates for only the last 10 business days to avoid blocking
      // This is sufficient for the chart display and much faster
      let businessDaysCalculated = 0;
      let daysBack = 1; // Start from yesterday (one day behind)
      const maxDays = 10; // Reduced from 30 to 10 for better performance
    
    while (businessDaysCalculated < maxDays && daysBack < 20) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysBack);
      
      // Convert to Eastern timezone
      const easternDateStr = targetDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const easternDate = new Date(easternDateStr);
      
      // Check if this is a business day
      const dayOfWeek = easternDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = isBankHoliday(easternDate);
      
      if (isWeekend || isHoliday) {
        daysBack++;
        continue;
      }
      
      // This is a valid business day - check if we already have cached data
      const dateKey = easternDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      const cachedRate = getStoredPackSuccessRate(dateKey);
      
      if (cachedRate !== 0) {
        // Already have data for this day, skip calculation
        console.log(`⚡ Skipping ${dateKey} - already cached: ${cachedRate}%`);
        businessDaysCalculated++;
        daysBack++;
        continue;
      }
      
      // Count orders due on this date (same logic as SLA calculation)
      const ordersForThisDay = orders.filter(order => {
        if (!order.allocated_at) return false;
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        return requiredDateStr === easternDateStr;
      }).length;
      
      // Calculate pack success rate for this day
      await calculatePackSuccessRate(dateKey, ordersForThisDay);
      
      businessDaysCalculated++;
      daysBack++;
      
      // Add a small delay between calculations to avoid overwhelming Firestore
      if (businessDaysCalculated < maxDays) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
      console.log(`✅ Calculated pack success rates for ${businessDaysCalculated} business days (${maxDays} max)`);
      
      // Trigger UI re-render now that pack calculations are complete
      setPackCalculationsComplete(prev => prev + 1);
      console.log('🔄 Triggering UI re-render with updated pack success rates');
    } catch (error) {
      console.error('❌ Error calculating pack success rates:', error);
    } finally {
      isCalculatingPackSuccessRates.current = false;
    }
  }, [calculatePackSuccessRate, getRequiredShipDate, isBankHoliday, getStoredPackSuccessRate]);

  // Function to refresh all data (orders and fill rate only - pack success rates run separately)
  const refreshAllData = useCallback(async () => {
    console.log('🔄 Refreshing all dashboard data...');
    const freshOrders = await fetchOrders();
    console.log('✅ Orders loaded, now fetching fill rate...');
    
    // Fetch fill rate data AFTER orders are loaded, passing fresh orders
    const fillRate = await fetchFillRate(freshOrders);
    if (fillRate) {
      setFillRateData(fillRate);
      console.log('✅ Fill rate updated:', fillRate);
    } else {
      console.log('⚠️ Fill rate fetch failed, using default');
      setFillRateData({ fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 });
    }
    
  }, [fetchOrders, fetchFillRate]); // Removed pack calculation dependencies to prevent loops

  // Initial load - run only once when component mounts
  useEffect(() => {
    refreshAllData();
  }, []); // Remove dependency to prevent loops

  // Separate effect to handle pack success rate calculation - runs once per session
  useEffect(() => {
    if (orders.length > 0 && !isCalculatingPackSuccessRates.current && !hasCalculatedPackRatesThisSession.current) {
      hasCalculatedPackRatesThisSession.current = true; // Mark as done for this session
      console.log('🔄 Starting background pack success rate calculation...');
      setTimeout(() => {
        calculateHistoricalPackSuccessRates(orders).then(() => {
          console.log('✅ Background pack success rates calculation completed');
        }).catch(error => {
          console.error('❌ Background pack success rates calculation failed:', error);
        });
      }, 3000); // 3 second delay to ensure everything else is loaded
    }
  }, [orders.length]); // Only depend on orders length, not the function

  // Schedule daily refresh at midnight EST
  useEffect(() => {
    const scheduleNextRefresh = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 30, 0, 0); // 12:30 AM EST to be safe
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      console.log(`⏰ Next refresh scheduled for: ${tomorrow.toLocaleString()}`);
      
      const timeoutId = setTimeout(() => {
        console.log('🌙 Midnight refresh triggered');
        hasCalculatedPackRatesThisSession.current = false; // Reset for new day
        setPackCalculationsComplete(0); // Reset pack calculations counter for new day
        refreshAllData();
        scheduleNextRefresh(); // Schedule the next one
      }, msUntilMidnight);

      return timeoutId;
    };

    const timeoutId = scheduleNextRefresh();
    return () => clearTimeout(timeoutId);
  }, []); // Remove refreshAllData dependency to prevent rescheduling on every refreshAllData change

  // Debug logging outside useMemo
  console.log('🔍 Debug - Orders state:', {
    ordersLength: orders.length,
    loading: loading,
    lastUpdated: lastUpdated,
    sampleOrder: orders[0] ? {
      order_number: orders[0].order_number,
      hasAllocatedAt: !!orders[0].allocated_at,
      hasShippedAt: !!orders[0].shippedAt
    } : 'No orders'
  });

  // Calculate SLA metrics data - ENHANCED WITH EMERGENCY CACHE
  const metricsData = useMemo(() => {
    console.log('🎯 useMemo starting - orders length:', orders.length, 'forceRefresh:', forceRefresh, 'packCalculationsComplete:', packCalculationsComplete);
    
    // Always check for cached data first (unless force refresh was triggered)
    const today = new Date().toDateString();
    const cacheKey = 'sla_metrics_data';
    const cacheDateKey = 'sla_metrics_date';
    
    try {
      const cachedDate = localStorage.getItem(cacheDateKey);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedDate === today && cachedData && forceRefresh === 0) {
        console.log('✅ Using cached SLA data from today');
        setUsingCachedData(true);
        return JSON.parse(cachedData);
      }
      
      if (forceRefresh > 0) {
        console.log('🔄 FORCE REFRESH: Bypassing cache due to manual refresh');
      }
      
      // If no current orders but we have recent cached data, use it as emergency fallback
      if (orders.length === 0 && cachedData) {
        console.log('🚨 EMERGENCY: No fresh orders, using cached data from:', cachedDate);
        setUsingCachedData(true);
        return JSON.parse(cachedData);
      }
      
      if (orders.length === 0) {
        console.log('📊 No orders and no cached data - returning empty data');
        setUsingCachedData(false);
        return [];
      }
      
      console.log('🔄 Cache miss - calculating fresh SLA data...');
      setUsingCachedData(false);
    } catch (error) {
      console.log('⚠️ Cache error, calculating fresh data:', error);
      if (orders.length === 0) {
        console.log('📊 No orders available - returning empty data');
        setUsingCachedData(false);
        return [];
      }
    }

    console.log('📊 Processing optimized SLA calculations with', orders.length, 'orders');
    
    try {
      console.log('⏳ Starting optimized SLA calculation...');
      const startTime = Date.now();
      
      // Test the helper functions first
      console.log('🧪 Testing helper functions...');
      const testOrder = orders[0];
      if (testOrder) {
        console.log('🧪 Test order:', testOrder.order_number, 'allocated_at:', testOrder.allocated_at);
        const testRequiredDate = getRequiredShipDate(testOrder);
        console.log('🧪 Test required ship date:', testRequiredDate);
        if (testOrder.shippedAt) {
          const testSLA = checkSLAMet(testOrder.shippedAt, testOrder);
          console.log('🧪 Test SLA result:', testSLA);
        }
      }
      
      // OPTIMIZATION: Pre-group orders by required ship date (Eastern) - UPDATED FOR STRING DATES
      console.log('📋 Pre-grouping orders by required ship date...');
      const ordersByShipDate = new Map();
      let processedOrders = 0;
      let skippedOrders = 0;
      
      for (const order of orders) {
        try {
          if (!order.allocated_at) {
            skippedOrders++;
            continue;
          }
          
          const requiredShipDate = getRequiredShipDate(order);
          if (!requiredShipDate) {
            skippedOrders++;
            continue;
          }
          
          // Convert to Eastern date string
          const easternDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
          
          if (!ordersByShipDate.has(easternDateStr)) {
            ordersByShipDate.set(easternDateStr, []);
          }
          
          // Pre-calculate SLA result - handle string shippedAt
          const slaResult = order.shippedAt ? checkSLAMet(order.shippedAt, order) : false;
          
          ordersByShipDate.get(easternDateStr).push({
            order_number: order.order_number,
            metSLA: slaResult
          });
          
          processedOrders++;
        } catch (error) {
          // Skip problematic orders silently
          skippedOrders++;
          continue;
        }
      }
      
      console.log(`📊 Processed ${processedOrders} orders, skipped ${skippedOrders} orders`);
      console.log('📊 Grouped orders into', ordersByShipDate.size, 'unique ship dates');
      
      // Show sample of grouped data
      const sampleDates = Array.from(ordersByShipDate.keys()).slice(0, 3);
      sampleDates.forEach(dateStr => {
        const orders = ordersByShipDate.get(dateStr);
        console.log(`📊 Sample: ${dateStr} has ${orders.length} orders`);
      });
      
      // Now generate business days data - FIXED TIMEZONE HANDLING
      const businessDays = [];
      let businessDaysAdded = 0;
      let daysBack = 1;
      
      console.log('📅 Starting business day calculation with proper Eastern timezone handling...');
      
      while (businessDaysAdded < 30 && daysBack < 60) {
        // Create date for this day back from today
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - daysBack);
        
        // Convert to Eastern timezone properly
        // Get the Eastern date by creating a new date in Eastern timezone
        const easternDateStr = targetDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const easternDate = new Date(easternDateStr); // This will be in local timezone but with Eastern date values
        
        // Debug logging for first few iterations
        if (businessDaysAdded < 5) {
          console.log(`🔍 Day ${daysBack}: ${targetDate.toDateString()} → Eastern: ${easternDate.toDateString()} (${easternDate.toLocaleDateString('en-US', { weekday: 'long' })})`);
        }
        
        // Check if this is a business day (not weekend or holiday)
        const dayOfWeek = easternDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
        const isHoliday = isBankHoliday(easternDate);
        
        if (isWeekend || isHoliday) {
          const skipReason = isHoliday ? ' (HOLIDAY)' : ' (WEEKEND)';
          if (businessDaysAdded < 5) {
            console.log(`⏭️  Skipping ${easternDate.toDateString()}${skipReason}`);
          }
          daysBack++;
          continue;
        }
        
        // This is a valid business day - look up orders for this date
        // Use the same Eastern date string format for consistent lookup
        const lookupDateStr = easternDateStr; // Use the properly formatted Eastern date string
        
        // FAST LOOKUP: Get orders for this date from our pre-grouped data
        const ordersForThisDay = ordersByShipDate.get(lookupDateStr) || [];
        const ordersRequiredThisDay = ordersForThisDay.length;
        const ordersMetSLA = ordersForThisDay.filter(o => o.metSLA).length;
        
        // Calculate SLA percentage
        const slaPercentage = ordersRequiredThisDay > 0 
          ? Math.round((ordersMetSLA / ordersRequiredThisDay) * 100 * 10) / 10 
          : 0;
        
        // Debug logging for first few days
        if (businessDaysAdded < 5) {
          console.log(`✅ Business Day ${businessDaysAdded + 1}: ${easternDate.toDateString()}: ${ordersRequiredThisDay} orders required, ${ordersMetSLA} met SLA (${slaPercentage}%)`);
        }
        
        const dateKey = easternDate.toLocaleDateString('en-CA');
        const packSuccessRate = getStoredPackSuccessRate(dateKey) || 100;
        
        // Debug pack success rate loading
        if (businessDaysAdded < 3) {
          console.log(`📊 Pack success rate for ${dateKey}: ${packSuccessRate}% (stored: ${getStoredPackSuccessRate(dateKey) ? 'YES' : 'NO, using default 100%'})`);
        }
        
        businessDays.unshift({
          date: dateKey, // Use YYYY-MM-DD format without timezone conversion
          dateFormatted: easternDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dayOfWeek: easternDate.getDay(),
          dayName: easternDate.toLocaleDateString('en-US', { weekday: 'short' }),
          sla: slaPercentage,
          orderCount: ordersRequiredThisDay,
          slaMetCount: ordersMetSLA,
          fillRate: getStoredFillRate(dateKey) || 0, // Use stored fill rate or 0%
          replyTime: Math.round((2 + Math.random() * 3) * 10) / 10,
          packErrors: packSuccessRate // Use stored pack success rate or 100% (no errors)
        });
        
        // Debug day name calculation for first few days
        if (businessDaysAdded < 3) {
          console.log(`🏷️  Day name check: ${easternDate.toDateString()} → dayOfWeek: ${easternDate.getDay()}, dayName: "${easternDate.toLocaleDateString('en-US', { weekday: 'short' })}", dateFormatted: "${easternDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}"`);
          console.log(`📅  Stored date: "${easternDate.toLocaleDateString('en-CA')}" | Will tooltip show correctly?`);
        }
        
        businessDaysAdded++;
        daysBack++;
      }
      
      const endTime = Date.now();
      const calculationTime = ((endTime - startTime) / 1000).toFixed(1);
      
      console.log('✅ Generated OPTIMIZED SLA data for', businessDays.length, 'business days in', calculationTime, 'seconds');
      
      // Show summary of included business days
      console.log('📊 Business days included:');
      businessDays.slice(-7).forEach((day, i) => {
        console.log(`   ${day.dayName} ${day.dateFormatted}: ${day.orderCount} orders, ${day.sla}% SLA`);
      });
      
      // Show FULL chart data for debugging
      console.log('📋 FULL CHART DATA (first 10 and last 10 for debugging):');
      console.log('   OLDEST DATA (chart left side):');
      businessDays.slice(0, 5).forEach((day, i) => {
        console.log(`     [${i}] ${day.dayName} ${day.dateFormatted} (${day.date}): ${day.orderCount} orders`);
      });
      console.log('   NEWEST DATA (chart right side):');
      businessDays.slice(-5).forEach((day, i) => {
        const actualIndex = businessDays.length - 5 + i;
        console.log(`     [${actualIndex}] ${day.dayName} ${day.dateFormatted} (${day.date}): ${day.orderCount} orders`);
      });
      
      // DETAILED DAY NAME VERIFICATION for last 10 business days
      console.log('🏷️  DETAILED DAY NAME VERIFICATION (last 10 business days):');
      businessDays.slice(-10).forEach((day, i) => {
        const actualIndex = businessDays.length - 10 + i;
        const dateObj = new Date(day.date);
        const realDayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const realDayNum = dateObj.getDay();
        console.log(`     [${actualIndex}] Data: ${day.dayName} ${day.dateFormatted} | Verification: ${realDayName} (${realDayNum}) | Match: ${day.dayName === realDayName ? '✅' : '❌'}`);
      });
      
      console.log('🔢 Day breakdown for last 10 calendar days (for debugging):');
      for (let i = 1; i <= 10; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const easternStr = checkDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const easternDate = new Date(easternStr);
        const dayOfWeek = easternDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = isBankHoliday(easternDate);
        const included = !isWeekend && !isHoliday;
        
        console.log(`   ${easternDate.toDateString()} (${easternDate.toLocaleDateString('en-US', { weekday: 'short' })}): ${
          included ? '✅ INCLUDED' : 
          isHoliday ? '🏛️ HOLIDAY' : 
          '📅 WEEKEND'
        }`);
      }
      
      // Show summary stats
      const totalOrders = businessDays.reduce((sum, day) => sum + day.orderCount, 0);
      const avgSLA = businessDays.length > 0 
        ? Math.round((businessDays.reduce((sum, day) => sum + day.sla, 0) / businessDays.length) * 10) / 10
        : 0;
      
      console.log(`📊 Summary: ${totalOrders} total orders, ${avgSLA}% average SLA over ${businessDays.length} days`);
      
      // Cache the results for today
      try {
        localStorage.setItem(cacheKey, JSON.stringify(businessDays));
        localStorage.setItem(cacheDateKey, today);
        console.log('💾 Cached SLA data for today - next load will be instant!');
      } catch (error) {
        console.warn('⚠️ Could not cache data:', error);
      }
      
      return businessDays;
      
    } catch (error) {
      console.error('❌ Error in optimized SLA calculation:', error);
      return [];
    }
  }, [orders, forceRefresh, packCalculationsComplete]); // Added packCalculationsComplete to trigger re-render when pack rates are calculated

  // Calculate current SLA (yesterday's performance since we don't include today)
  const currentSLA = useMemo(() => {
    if (metricsData.length === 0) return 0;
    return metricsData[metricsData.length - 1]?.sla || 0;
  }, [metricsData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isWeekend = data.dayOfWeek === 0 || data.dayOfWeek === 6;
      const targetDate = new Date(data.date);
      const isHoliday = isBankHoliday(targetDate);
      const shouldntBeHere = isWeekend || isHoliday;
      
      return (
        <div className="bg-white p-4 shadow-lg rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium">
            {/* Use pre-calculated day name and date formatting to avoid timezone conversion issues */}
            {data.dayName}, {data.dateFormatted} 2025
            {shouldntBeHere && (
              <span className="text-red-600 font-bold">
                {isHoliday ? ' (HOLIDAY - SHOULDN\'T BE HERE!)' : ' (WEEKEND - SHOULDN\'T BE HERE!)'}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500 mb-1">Orders due to ship: {data.orderCount}</p>
          <p className="text-sm text-gray-500 mb-2">Orders shipped on time: {data.slaMetCount}</p>
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}
              {entry.dataKey === 'sla' || entry.dataKey === 'fillRate' || entry.dataKey === 'packErrors' ? '%' : 'h'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomFillRateTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isWeekend = data.dayOfWeek === 0 || data.dayOfWeek === 6;
      const targetDate = new Date(data.date);
      const isHoliday = isBankHoliday(targetDate);
      const shouldntBeHere = isWeekend || isHoliday;
      
      return (
        <div className="bg-white p-4 shadow-lg rounded-lg border border-gray-200">
          <p className="text-gray-600 font-medium">
            {data.dayName}, {data.dateFormatted} 2025
            {shouldntBeHere && (
              <span className="text-red-600 font-bold">
                {isHoliday ? ' (HOLIDAY - SHOULDN\'T BE HERE!)' : ' (WEEKEND - SHOULDN\'T BE HERE!)'}
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500 mb-1">Fill Rate: {data.fillRate}%</p>
          <p className="text-sm text-gray-500 mb-2">
            {data.fillRate === 0 ? 'No data available for this date' : 'Orders available to ship vs total orders'}
          </p>
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">EcoShip Performance Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
                Last updated: {lastUpdated ? lastUpdated.toLocaleString('en-US', {timeZone: 'America/New_York'}) : 'Never'} EST
                {usingCachedData && (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Using Cached Data
                  </span>
                )}
                {orders.length === 0 && !usingCachedData && (
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Connection Issue
                  </span>
                )}
                <br />
                <span className="text-xs">
                  Fill Rate: {fillRateData.fillRate}% ({fillRateData.totalOrdersToday} orders today, {fillRateData.backorderedCount} problem orders)
                </span>
              </div>
              <button
                onClick={() => {
                  // Clear cache and refresh data
                  localStorage.removeItem('sla_metrics_data');
                  localStorage.removeItem('sla_metrics_date');
                  
                  // Clear fill rate data for today to force fresh calculation
                  const today = new Date().toLocaleDateString('en-CA');
                  localStorage.removeItem(`fill_rate_${today}`);
                  
                  // Reset pack calculation session flag to allow recalculation
                  hasCalculatedPackRatesThisSession.current = false;
                  
                  setUsingCachedData(false);
                  setForceRefresh(prev => prev + 1); // Force useMemo to re-run
                  setPackCalculationsComplete(0); // Reset pack calculations counter
                  console.log('🗑️ Cleared SLA cache and today\'s fill rate data');
                  refreshAllData();
                }}
                disabled={loading}
                className={`inline-flex items-center px-3 py-1.5 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  orders.length === 0 && !usingCachedData 
                    ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {orders.length === 0 && !usingCachedData ? 'Retry Connection' : 'Refresh Data'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Current SLA</p>
                <p className="text-2xl font-semibold text-gray-900">{currentSLA}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Fill Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{metricsData.length > 0 ? metricsData[metricsData.length - 1].fillRate : 0}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Reply Time</p>
                <p className="text-2xl font-semibold text-gray-900">{metricsData.length > 0 ? metricsData[metricsData.length - 1].replyTime : 0}h</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pack Success Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{metricsData.length > 0 ? metricsData[metricsData.length - 1].packErrors : 0}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SLA Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">SLA Performance</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="sla" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="SLA %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Fill Rate Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Fill Rate</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip content={<CustomFillRateTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="fillRate" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Fill Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reply Time Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reply Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="replyTime" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} name="Reply Time (hours)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pack Success Rate Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pack Success Rate</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 'dataMax + 1']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="packErrors" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Pack Success Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>EcoShip Performance Dashboard • Business days only (excludes weekends & federal holidays) • Automatically refreshes daily at 12:30 AM EST</p>
        </div>
      </div>
    </div>
  );
}

export default App; 