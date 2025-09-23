import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/*
 * AUTOMATIC CACHE EXPIRATION SYSTEM (2025-01-XX):
 * 
 * FEATURES:
 * 1. Automatic cache expiration based on calendar days (not business days)
 * 2. Cache expires if it's from a different day OR older than 24 hours
 * 3. No manual refresh button needed - cache auto-expires seamlessly
 * 4. Fresh data is pulled from Firestore when cache expires
 * 5. Gmail response data is cached and auto-expires
 * 6. Clean UI without cache indicators or refresh buttons
 * 
 * BENEFITS:
 * - Automatically detects stale cache from different days
 * - Expires cache older than 24 hours (catches new data)
 * - Works even if site is closed overnight
 * - Eliminates need for manual cache management
 * - Ensures data is always current when you open the site
 * - Seamless user experience with no manual intervention needed
 */

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fillRateData, setFillRateData] = useState({ fillRate: 0, backorderedCount: 0, totalOrdersToday: 0 });
  const [gmailResponseData, setGmailResponseData] = useState({});
  
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
      const trackedIssuesCount = functionResponse.data.trackedIssuesCount || 0;
      const totalActiveIssues = functionResponse.data.totalActiveIssues || problemOrdersCount;
      
      console.log(`🚨 Found ${problemOrdersCount} NEW problem orders due today/overdue from Firebase Function`);
      console.log(`📊 Found ${trackedIssuesCount} tracked issues from previous days`);
      console.log(`📊 Total active issues affecting fill rate: ${totalActiveIssues}`);

      // Get total unshipped orders due today/overdue from Firestore
      const todayEastern = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const todayDate = new Date(todayEastern);
      
      const totalUnshippedOrders = activeOrders.filter(order => {
        // Skip canceled orders - they shouldn't count toward fill rate
        if (order.status === 'canceled') return false;
        
        // Skip not-ready-to-ship orders - they can't be shipped so they shouldn't count toward fill rate
        if (order.ready_to_ship === false) return false;
        
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
        // Skip canceled orders - they shouldn't count toward fill rate
        if (order.status === 'canceled') return false;
        
        // Skip not-ready-to-ship orders - they can't be shipped so they shouldn't count toward fill rate
        if (order.ready_to_ship === false) return false;
        
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

      // Calculate fill rate: (total - total active issues) / total × 100
      const fillRate = totalUnshippedOrders > 0 
        ? Math.round(((totalUnshippedOrders - totalActiveIssues) / totalUnshippedOrders) * 100 * 10) / 10
        : 100; // Default to 100% if no orders (no problems possible)

      const fillRateData = {
        fillRate,
        backorderedCount: totalActiveIssues, // Total active issues (new + tracked)
        newBackorderedCount: problemOrdersCount, // Just new issues today
        trackedIssuesCount: trackedIssuesCount, // Issues from previous days
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
        // Skip canceled orders - they shouldn't count toward fill rate
        if (order.status === 'canceled') return false;
        
        // Skip not-ready-to-ship orders - they can't be shipped so they shouldn't count toward fill rate
        if (order.ready_to_ship === false) return false;
        
        if (!order.allocated_at || order.shippedAt) return false;
        const requiredShipDate = getRequiredShipDate(order);
        if (!requiredShipDate) return false;
        const requiredDateStr = requiredShipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        const requiredDateObj = new Date(requiredDateStr);
        return requiredDateObj <= todayDate;
      }).length;
      
      // Debug: Show sample of orders due today in fallback
      const ordersToday = activeOrders.filter(order => {
        // Skip canceled orders - they shouldn't count toward fill rate
        if (order.status === 'canceled') return false;
        
        // Skip not-ready-to-ship orders - they can't be shipped so they shouldn't count toward fill rate
        if (order.ready_to_ship === false) return false;
        
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

  // Function to fetch Gmail response rate data from Firestore
  const fetchGmailResponseData = useCallback(async () => {
    try {
      console.log('📧 Fetching Gmail response rate data from Firestore...');
      
      const gmailQuery = query(
        collection(db, 'gmailResponseTimes'),
        orderBy('date', 'desc'),
        limit(45) // Get last 45 days to match SLA data
      );
      
      const gmailSnapshot = await getDocs(gmailQuery);
      const gmailData = {};
      
      gmailSnapshot.forEach((doc) => {
        const data = doc.data();
        gmailData[data.date] = data.responseRate;
      });
      
      // Cache Gmail response data in localStorage
      try {
        localStorage.setItem('gmail_response_data', JSON.stringify({
          data: gmailData,
          lastFetched: new Date().toISOString()
        }));
        console.log('💾 Cached Gmail response data');
      } catch (cacheError) {
        console.warn('⚠️ Could not cache Gmail response data:', cacheError);
      }
      
      setGmailResponseData(gmailData);
      console.log(`✅ Fetched Gmail response data for ${Object.keys(gmailData).length} days`);
      
    } catch (error) {
      console.error('❌ Error fetching Gmail response data:', error);
      setGmailResponseData({});
    }
  }, []);

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

  // Helper function to get stored fill rate data including backordered count
  const getStoredFillRateData = (dateStr) => {
    try {
      const stored = localStorage.getItem(`fill_rate_${dateStr}`);
      if (stored) {
        const data = JSON.parse(stored);
        return {
          fillRate: data.fillRate,
          backorderedCount: data.backorderedCount,
          totalOrdersToday: data.totalOrdersToday
        };
      }
    } catch (error) {
      console.warn('Error reading stored fill rate data for', dateStr, error);
    }
    return null; // Return null if no stored data
  };

  // NEW: Helper function to get cached Gmail response data
  const getCachedGmailResponseData = () => {
    try {
      const stored = localStorage.getItem('gmail_response_data');
      if (stored) {
        const data = JSON.parse(stored);
        const currentDate = new Date();
        const cacheDate = new Date(data.lastFetched);
        
        // Check if cache is from a different day
        if (isCacheFromDifferentDay(cacheDate, currentDate)) {
          console.log('🕒 Gmail response cache is from a different day, expiring...');
          localStorage.removeItem('gmail_response_data');
          return {};
        }
        
        // Check if cache is too old (more than 24 hours)
        const cacheAge = Date.now() - cacheDate.getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (cacheAge > maxAge) {
          console.log(`🕒 Gmail response cache is too old (${Math.round(cacheAge / (60 * 60 * 1000))} hours), expiring...`);
          localStorage.removeItem('gmail_response_data');
          return {};
        }
        
        console.log('✅ Using cached Gmail response data');
        return data.data;
      }
    } catch (error) {
      console.warn('Error reading cached Gmail response data:', error);
    }
    return {}; // Return empty object if no cached data
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

  // Helper function to clear pack success rate cache
  const clearPackSuccessRateCache = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('pack_success_rate_')) {
          localStorage.removeItem(key);
          console.log(`🗑️ Cleared cached pack success rate: ${key}`);
        }
      });
      console.log('✅ Pack success rate cache cleared');
    } catch (error) {
      console.error('❌ Error clearing pack success rate cache:', error);
    }
  };

  // NEW: Function to check if cache is from a different day
  const isCacheFromDifferentDay = (cacheDate, currentDate) => {
    try {
      const cacheDay = new Date(cacheDate).toDateString();
      const currentDay = new Date(currentDate).toDateString();
      return cacheDay !== currentDay;
    } catch (error) {
      console.warn('Error comparing cache dates:', error);
      return true; // If we can't compare, assume cache is stale
    }
  };

  // NEW: Function to get stored pack success rate with automatic expiration
  const getStoredPackSuccessRateWithExpiration = (dateStr) => {
    try {
      const stored = localStorage.getItem(`pack_success_rate_${dateStr}`);
      if (stored) {
        const data = JSON.parse(stored);
        const currentDate = new Date();
        const cacheDate = new Date(data.lastCalculated);
        
        // Check if cache is from a different day
        if (isCacheFromDifferentDay(cacheDate, currentDate)) {
          console.log(`🕒 Cache for ${dateStr} is from a different day, expiring...`);
          localStorage.removeItem(`pack_success_rate_${dateStr}`);
          return 0; // Force fresh calculation
        }
        
        // Check if cache is too old (more than 24 hours)
        const cacheAge = Date.now() - cacheDate.getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (cacheAge > maxAge) {
          console.log(`🕒 Cache for ${dateStr} is too old (${Math.round(cacheAge / (60 * 60 * 1000))} hours), expiring...`);
          localStorage.removeItem(`pack_success_rate_${dateStr}`);
          return 0; // Force fresh calculation
        }
        
        console.log(`✅ Using fresh cache for ${dateStr}: ${data.packSuccessRate}%`);
        return data.packSuccessRate;
      }
    } catch (error) {
      console.warn('Error reading stored pack success rate for', dateStr, error);
    }
    return 0; // No cached data or error
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
      
      // Check if we already have stored data for this date (with automatic expiration)
      const storedRate = getStoredPackSuccessRateWithExpiration(dateStr);
      if (storedRate !== 0) {
        return storedRate; // Already logged in the expiration function
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
      
      // This is a valid business day - check if we already have cached data (with automatic expiration)
      const dateKey = easternDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      const cachedRate = getStoredPackSuccessRateWithExpiration(dateKey);
      
      if (cachedRate !== 0) {
        // Already have fresh data for this day, skip calculation
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
      console.log('🔄 Triggering UI re-render with updated accurate shipments rates');
    } catch (error) {
      console.error('❌ Error calculating pack success rates:', error);
    } finally {
      isCalculatingPackSuccessRates.current = false;
    }
  }, [calculatePackSuccessRate, getRequiredShipDate, isBankHoliday, getStoredPackSuccessRate]);



  // Initial load - run only once when component mounts
  useEffect(() => {
    // Load cached Gmail data into state immediately
    const cachedGmailData = getCachedGmailResponseData();
    if (Object.keys(cachedGmailData).length > 0) {
      setGmailResponseData(cachedGmailData);
      console.log('📧 Loaded cached Gmail response data into state');
    }
    
    // Fetch initial data
    fetchOrders();
    fetchFillRate();
    fetchGmailResponseData();
    
    // Reset pack calculation session flag to allow calculation
    hasCalculatedPackRatesThisSession.current = false;
    setPackCalculationsComplete(0);
    
    // Check if pack error cache has expired and needs recalculation
    const today = new Date();
    const recentDates = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      recentDates.push(date.toISOString().split('T')[0]);
    }
    
    const hasExpiredCache = recentDates.some(dateStr => {
      const stored = localStorage.getItem(`pack_success_rate_${dateStr}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const cacheDate = new Date(data.lastCalculated);
          const cacheAge = Date.now() - cacheDate.getTime();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          return cacheAge > maxAge;
        } catch (e) {
          return true; // Corrupted cache, needs recalculation
        }
      }
      return true; // No cache, needs calculation
    });
    
    if (hasExpiredCache) {
      console.log('🕒 Pack error cache has expired, will recalculate...');
      hasCalculatedPackRatesThisSession.current = false; // Force recalculation
      
      // Also clear SLA cache so it recalculates with fresh pack error data
      localStorage.removeItem('sla_metrics_data');
      localStorage.removeItem('sla_metrics_date');
      console.log('🗑️ Cleared SLA cache to force recalculation with fresh pack error data');
    }
  }, []); // Remove dependency to prevent loops

  // Separate effect to handle pack success rate calculation - runs when needed
  useEffect(() => {
    if (orders.length > 0 && !isCalculatingPackSuccessRates.current && !hasCalculatedPackRatesThisSession.current) {
      hasCalculatedPackRatesThisSession.current = true; // Mark as done for this session
      console.log('🔄 Starting background accurate shipments calculation...');
      setTimeout(() => {
        calculateHistoricalPackSuccessRates(orders).then(() => {
          console.log('✅ Background accurate shipments calculation completed');
          
          // Clear SLA cache to force recalculation with fresh pack error data
          localStorage.removeItem('sla_metrics_data');
          localStorage.removeItem('sla_metrics_date');
          console.log('🗑️ Cleared SLA cache to force recalculation with fresh pack error data');
          
          // Trigger UI re-render by incrementing pack calculations counter
          setPackCalculationsComplete(prev => prev + 1);
        }).catch(error => {
          console.error('❌ Background accurate shipments calculation failed:', error);
        });
      }, 3000); // 3 second delay to ensure everything else is loaded
    }
  }, [orders.length, calculateHistoricalPackSuccessRates]); // Include the function dependency

  // Ensure SLA calculation only runs after orders are loaded
  useEffect(() => {
    if (orders.length > 0 && !loading) {
      console.log('📊 Orders loaded and ready - SLA calculation can proceed');
    }
  }, [orders.length, loading]);



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
    // Guard: Don't run if loading or no orders
    if (loading || !orders || orders.length === 0) {

      return [];
    }
    
    console.log('🔍 DEBUG: Orders state at useMemo start:', {
      orders: orders,
      ordersLength: orders?.length,
      ordersType: typeof orders,
      ordersIsArray: Array.isArray(orders),
      ordersFirstElement: orders?.[0]
    });
    
    console.log('🎯 generateOptimizedSLAData starting - orders length:', orders.length, 'packCalculationsComplete:', packCalculationsComplete);
    
    // Always check for cached data first (unless force refresh was triggered)
    const today = new Date().toDateString();
    const cacheKey = 'sla_metrics_data';
    const cacheDateKey = 'sla_metrics_date';
    
    try {
      const cachedDate = localStorage.getItem(cacheDateKey);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedDate === today && cachedData) {
        console.log('✅ Using cached SLA data from today');
        return JSON.parse(cachedData);
      }
      
      // REMOVED: Emergency fallback was causing dashboard to show cached data when orders weren't loaded
      // This was the root cause of the zeros issue
      
      console.log('🔄 Cache miss - calculating fresh SLA data...');

    } catch (error) {
      console.log('⚠️ Cache error, calculating fresh data:', error);
      if (orders.length === 0) {
        console.log('📊 No orders available - returning empty data');
  
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
          // Skip canceled orders - they shouldn't count toward SLA
          if (order.status === 'canceled') {
            skippedOrders++;
            continue;
          }
          
          // Skip not-ready-to-ship orders - they can't be shipped so they shouldn't count toward SLA
          if (order.ready_to_ship === false) {
            skippedOrders++;
            continue;
          }
          
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
      
      console.log(`📊 Processed ${processedOrders} orders, skipped ${skippedOrders} orders (including canceled and not-ready-to-ship orders)`);
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
        const packSuccessRate = getStoredPackSuccessRateWithExpiration(dateKey) || 100;
        
        // Debug accurate shipments rate loading
        if (businessDaysAdded < 3) {
          console.log(`📊 Accurate shipments rate for ${dateKey}: ${packSuccessRate}% (stored: ${getStoredPackSuccessRateWithExpiration(dateKey) ? 'YES' : 'NO, using default 100%'})`);
        }
        
        // Get stored fill rate data to extract backordered count
        const storedFillRateData = getStoredFillRateData(dateKey);
        const fillRate = storedFillRateData?.fillRate || getStoredFillRate(dateKey) || 100;
        const backorderedCount = storedFillRateData?.backorderedCount || 0;
        
        // For historical days, we need to calculate what the backordered count would have been
        // based on the fill rate percentage and order count
        let calculatedBackorderedCount = backorderedCount;
        if (backorderedCount === 0 && fillRate < 100 && ordersRequiredThisDay > 0) {
          // Calculate backordered count from fill rate: if fill rate is 90% and we had 10 orders,
          // then 1 order couldn't be filled (10 * 0.1 = 1)
          calculatedBackorderedCount = Math.round(ordersRequiredThisDay * (1 - fillRate / 100));
          
                  // Store this calculated data for future use
        const calculatedFillRateData = {
          fillRate: fillRate,
          backorderedCount: calculatedBackorderedCount,
          totalOrdersToday: ordersRequiredThisDay,
          lastCalculated: new Date().toISOString(),
          calculated: true // Flag to indicate this was calculated, not from real data
        };
        localStorage.setItem(`fill_rate_${dateKey}`, JSON.stringify(calculatedFillRateData));
      }
      
      businessDays.unshift({
        date: dateKey, // Use YYYY-MM-DD format without timezone conversion
        dateFormatted: easternDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayOfWeek: easternDate.getDay(),
        dayName: easternDate.toLocaleDateString('en-US', { weekday: 'short' }),
        sla: slaPercentage,
        orderCount: ordersRequiredThisDay,
        slaMetCount: ordersMetSLA,
        fillRate: fillRate,
        backorderedCount: calculatedBackorderedCount, // Use calculated backordered count
        calculated: storedFillRateData?.calculated || false, // Pass through the calculated flag
        replyTime: gmailResponseData[dateKey] || 100, // Use Gmail response rate from state or 100% (assume perfect for historical data)
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
  }, [orders.length, packCalculationsComplete, loading]); // Remove gmailResponseData to fix timing issues

  // Calculate current SLA (yesterday's performance since we don't include today)
  const currentSLA = useMemo(() => {
    if (metricsData.length === 0) return 0;
    return metricsData[metricsData.length - 1]?.sla || 0;
  }, [metricsData]);

  // Calculate averages across all data points in the graph (30 business days)
  const averageMetrics = useMemo(() => {
    if (metricsData.length === 0) {
      return {
        averageSLA: 0,
        averageFillRate: 0,
        averageReplyTime: 0,
        averageAccurateShipments: 0
      };
    }

    // Calculate averages for each metric
    const totalSLA = metricsData.reduce((sum, day) => sum + (day.sla || 0), 0);
    const totalFillRate = metricsData.reduce((sum, day) => sum + (day.fillRate || 0), 0);
    const totalReplyTime = metricsData.reduce((sum, day) => sum + (day.replyTime || 0), 0);
    const totalAccurateShipments = metricsData.reduce((sum, day) => sum + (day.packErrors || 0), 0);

    return {
      averageSLA: Math.round((totalSLA / metricsData.length) * 10) / 10,
      averageFillRate: Math.round((totalFillRate / metricsData.length) * 10) / 10,
      averageReplyTime: Math.round((totalReplyTime / metricsData.length) * 10) / 10,
      averageAccurateShipments: Math.round((totalAccurateShipments / metricsData.length) * 10) / 10
    };
  }, [metricsData]);

  // Debug useEffect to track when orders are loaded and ready for SLA calculation
  useEffect(() => {
    if (orders && orders.length > 0) {
      console.log('✅ Orders loaded and ready for SLA calculation:', orders.length);
    }
  }, [orders.length]);

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
          <p className="text-sm text-gray-500 mb-1">Orders shipped on time: {data.slaMetCount}</p>
          
          {/* Show additional context for today's data */}
          {data.date === new Date().toLocaleDateString('en-CA') && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Today's data: {fillRateData.totalOrdersToday} total orders, {fillRateData.backorderedCount} orders that couldn't be filled
              </p>
            </div>
          )}
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}
              {entry.dataKey === 'sla' || entry.dataKey === 'fillRate' || entry.dataKey === 'packErrors' || entry.dataKey === 'replyTime' ? '%' : 'h'}
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
          
          {/* Show orders due to ship if available */}
          {data.orderCount !== undefined && (
            <p className="text-sm text-gray-500 mb-1">Orders due to ship: {data.orderCount}</p>
          )}
          
          {/* Show backordered count if available */}
          {data.backorderedCount !== undefined && data.backorderedCount > 0 ? (
            <p className="text-sm text-gray-500 mb-1">Orders that couldn't be filled: {data.backorderedCount}</p>
          ) : data.backorderedCount === 0 ? (
            <p className="text-sm text-gray-500 mb-1">Orders that couldn't be filled: 0</p>
          ) : (
            <p className="text-sm text-gray-400 mb-1">Orders that couldn't be filled: Historical data not available</p>
          )}
          
          {/* Show new vs tracked issues breakdown for today */}
          {data.date === new Date().toLocaleDateString('en-CA') && fillRateData.newBackorderedCount !== undefined && (
            <p className="text-sm text-gray-400 mb-1">
              Breakdown: {fillRateData.newBackorderedCount} new + {fillRateData.trackedIssuesCount} tracked
            </p>
          )}
          
          {/* Show fill rate percentage */}
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}%
            </p>
          ))}
          
          {/* Show additional context for today's data */}
          {data.date === new Date().toLocaleDateString('en-CA') && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Today's data: {fillRateData.totalOrdersToday} total orders, {fillRateData.backorderedCount} orders that couldn't be filled
              </p>
            </div>
          )}
          
          {/* Show note about historical data availability */}
          {data.date !== new Date().toLocaleDateString('en-CA') && data.backorderedCount === undefined && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                Historical data: Fill rate percentage only. Detailed counts available for current day.
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomAccurateShipmentsTooltip = ({ active, payload, label }) => {
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
          
          {/* Show orders due to ship if available */}
          {data.orderCount !== undefined && (
            <p className="text-sm text-gray-500 mb-1">Orders due to ship: {data.orderCount}</p>
          )}
          
          {/* Show pack errors count if available */}
          {data.packErrors !== undefined && data.packErrors < 100 ? (
            <p className="text-sm text-gray-500 mb-1">Pack errors: {Math.round(data.orderCount * (1 - data.packErrors / 100))}</p>
          ) : data.packErrors === 100 ? (
            <p className="text-sm text-gray-500 mb-1">Pack errors: 0</p>
          ) : (
            <p className="text-sm text-gray-400 mb-1">Pack errors: Data not available</p>
          )}
          
          {/* Show accurate shipments percentage */}
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}%
            </p>
          ))}
          
          {/* Show note about what accurate shipments means */}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Perfect Ship Rate: Percentage of orders shipped without pack errors
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomGmailResponseTooltip = ({ active, payload, label }) => {
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
          
          {/* Show Gmail response rate percentage */}
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}%
            </p>
          ))}
          
          {/* Show contextual explanation */}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Percentage of client emails responded to within 4 hours
            </p>
          </div>
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
                {orders.length === 0 && (
                  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                    Connection Issue
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Cards */}
        <div className="mb-4">
          <h2 className="text-lg font-medium text-gray-700 text-left">Averages for the last 30 business days</h2>
        </div>
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
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">SLA Performance</p>
                  <div className="relative group">
                    <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Percentage of orders shipped same day, with an 8 AM cutoff
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading || metricsData.length === 0 ? '...' : `${averageMetrics.averageSLA}%`}
                </p>
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
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Fill Rate</p>
                  <div className="relative group">
                    <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Percentage of orders that can be shipped in full
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading || metricsData.length === 0 ? '...' : `${averageMetrics.averageFillRate}%`}
                </p>
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
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Reply Time</p>
                  <div className="relative group">
                    <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Percentage of emails responded to within 4 hours
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading || metricsData.length === 0 ? '...' : `${averageMetrics.averageReplyTime}%`}
                </p>
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
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">Perfect Ship Rate</p>
                  <div className="relative group">
                    <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                      Percentage of orders arriving to the customers' doors in perfect condition
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading || metricsData.length === 0 ? '...' : `${averageMetrics.averageAccurateShipments}%`}
                </p>
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
              {loading || metricsData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading chart data...</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 110]} tickFormatter={(value) => value <= 100 ? `${value}%` : ''} ticks={[0, 20, 40, 60, 80, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="sla" stroke="#10B981" strokeWidth={2} dot={false} name="SLA %" />
                  </LineChart>
                </ResponsiveContainer>
              )}
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
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 110]} tickFormatter={(value) => value <= 100 ? `${value}%` : ''} ticks={[0, 20, 40, 60, 80, 100]} />
                  <Tooltip content={<CustomFillRateTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="fillRate" stroke="#3B82F6" strokeWidth={2} dot={false} name="Fill Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reply Time Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Email Response Rate</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip content={<CustomGmailResponseTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="replyTime" stroke="#F59E0B" strokeWidth={2} dot={false} name="Response Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accurate Shipments Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Perfect Ship Rate</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="dateFormatted" stroke="#6B7280" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} domain={[0, 110]} tickFormatter={(value) => value <= 100 ? `${value}%` : ''} ticks={[0, 20, 40, 60, 80, 100]} />
                  <Tooltip content={<CustomAccurateShipmentsTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="packErrors" stroke="#10B981" strokeWidth={2} dot={false} name="Perfect Ship Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>EcoShip Performance Dashboard • Automatically refreshes daily at 12:30 AM EST</p>
        </div>
      </div>
    </div>
  );
}

export default App; 