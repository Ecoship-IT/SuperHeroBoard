import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { db } from './firebase';
import { onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import EFMProductSizes from './EFMProductSizes';
import PasswordGate from './PasswordGate';
import AppWrapper from './AppWrapper';

const FilterSection = ({ 
  clientValue, 
  onClientChange, 
  statusValue, 
  onStatusChange,
  dateRangeValue,
  onDateRangeChange,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  slaValue,
  onSLAChange,
  showSLA = false,
  searchValue,
  onSearchChange,
  searchInputValue,
  onSearchInputChange,
  searchPlaceholder = "Search by order number...",
  uniqueClients,
  statusOptions,
  dateRangeOptions,
  slaOptions
}) => {
  const handleSearch = () => {
    onSearchChange(searchInputValue);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    onSearchInputChange('');
    onSearchChange('');
  };

  return (
    <div className="p-4 border-b">
      <div className="flex flex-wrap gap-2 sm:gap-4">
        <div className="w-full sm:flex-1 sm:min-w-[260px] lg:min-w-[300px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={searchPlaceholder}
              className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-150"
              title="Search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {(searchInputValue || searchValue) && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors duration-150"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[120px] sm:min-w-[135px] lg:min-w-[170px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <select
            value={clientValue}
            onChange={(e) => onClientChange(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="all">All Clients</option>
            {uniqueClients.map(client => (
              <option key={client.value} value={client.value}>{client.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[110px] sm:min-w-[130px] lg:min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            {statusOptions.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[120px] sm:min-w-[140px] lg:min-w-[160px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Allocated Date Range</label>
          <select
            value={dateRangeValue}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="all">All Time</option>
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        {dateRangeValue === 'custom' && (
          <div className="flex gap-2 sm:gap-4 w-full sm:flex-1 sm:min-w-[280px] lg:min-w-[350px]">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => onCustomStartChange(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => onCustomEndChange(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>
        )}
        {showSLA && (
          <div className="flex-1 min-w-[110px] sm:min-w-[130px] lg:min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">SLA Status</label>
            <select
              value={slaValue}
              onChange={(e) => onSLAChange(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              {slaOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

const getBoardSummaryUrl = () => {
  const env = import.meta.env.VITE_GET_BOARD_SUMMARY_URL;
  if (env) return env;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  return `https://us-central1-${projectId}.cloudfunctions.net/getBoardSummary`;
};

export function Dashboard({ isAuthenticated, isGuest, userRole, onLogout }) {
  const location = useLocation();
  const [boardSummary, setBoardSummary] = useState(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);
  const [showAllClients, setShowAllClients] = useState(false);
  const [todayPageSize, setTodayPageSize] = useState(25);
  const [todayCurrentPage, setTodayCurrentPage] = useState(1);
  const [tomorrowPageSize, setTomorrowPageSize] = useState(25);
  const [tomorrowCurrentPage, setTomorrowCurrentPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRefreshConfirming, setIsRefreshConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });
  const [refreshLog, setRefreshLog] = useState([]);
  const [isProcessingData, setIsProcessingData] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);


  // Filter states
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [todayOrderSearch, setTodayOrderSearch] = useState('');
  const [todayOrderSearchInput, setTodayOrderSearchInput] = useState('');

  // Tomorrow orders table filters
  const [tomorrowOrdersClient, setTomorrowOrdersClient] = useState('all');
  const [tomorrowOrdersStatus, setTomorrowOrdersStatus] = useState('all');
  const [tomorrowOrdersDateRange, setTomorrowOrdersDateRange] = useState('all');
  const [tomorrowOrdersCustomStartDate, setTomorrowOrdersCustomStartDate] = useState('');
  const [tomorrowOrdersCustomEndDate, setTomorrowOrdersCustomEndDate] = useState('');
  const [tomorrowOrdersSearch, setTomorrowOrdersSearch] = useState('');
  const [tomorrowOrdersSearchInput, setTomorrowOrdersSearchInput] = useState('');

  // State for manual completion confirmation
  const [confirmingManual, setConfirmingManual] = useState(null); // orderNumber being confirmed

  const pageSizeOptions = [50, 100, 250, 500, 1000];
  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'allocated', label: 'Allocated' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'deallocated', label: 'Deallocated' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'manual', label: 'Manual' }
  ];

  const slaOptions = [
    { value: 'all', label: 'All SLA Status' },
    { value: 'true', label: 'SLA Met' },
    { value: 'false', label: 'SLA Not Met' },
    { value: 'tbd', label: 'TBD' }
  ];

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

  // Add window width state
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Add resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // State to track current date for proper day transitions
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
  });

  // Update date every minute to handle day transitions
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const newDate = today.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      setCurrentDate(newDate);
    };

    // Update immediately
    updateDate();

    // Set up interval to check every minute
    const interval = setInterval(updateDate, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Memoize date calculations - used in multiple places
  const todayDate = useMemo(() => {
    const today = new Date();
    return {
      date: today,
      eastern: today.toLocaleDateString('en-US', {timeZone: 'America/New_York'}),
      startOfDay: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    };
  }, [currentDate]); // Recalculate when date changes

  // Memoize status check functions - used in multiple filters
  const statusChecks = useMemo(() => {
    const shippedStatuses = ['shipped', 'canceled', 'cleared', 'deallocated', 'wholesale', 'manual'];
    
    return {
      isShipped: (order) => order.status === 'shipped',
      isShippable: (order) => !shippedStatuses.includes(order.status),
      isReadyToShip: (order) => order.ready_to_ship === true
    };
  }, []); // Calculate once

  const ordersToShipToday = boardSummary?.todayOrders ?? [];
  const ordersToShipTomorrow = boardSummary?.tomorrowOrders ?? [];
  const shippedToday = boardSummary?.shippedTodayOrders ?? [];
  const shippedTodayCount = boardSummary?.shippedTodayCount ?? 0;
  const notReadyToShipOrders = boardSummary?.notReadyToShipOrders ?? [];

  const ordersForLookup = useMemo(() => [
    ...ordersToShipToday,
    ...ordersToShipTomorrow,
    ...shippedToday,
    ...notReadyToShipOrders
  ], [ordersToShipToday, ordersToShipTomorrow, shippedToday, notReadyToShipOrders]);

  const accountLookup = useMemo(() => {
    const lookup = new Map();
    ordersForLookup.forEach(order => {
      if (!lookup.has(order.account_uuid)) {
        lookup.set(
          order.account_uuid,
          accountMap[order.account_uuid] || order.account_uuid || 'Unknown'
        );
      }
    });
    return lookup;
  }, [ordersForLookup, accountMap]);

  const fetchBoardSummary = useCallback(async (forceRefresh = false) => {
    const tStart = performance.now();
    console.log(`[BoardPerf] fetchBoardSummary HTTP request started`);
    setBoardLoading(true);
    setBoardError(null);
    try {
      const url = getBoardSummaryUrl() + (forceRefresh ? '?refresh=1' : '');
      const res = await fetch(url);
      const tAfterFetch = performance.now();
      if (!res.ok) throw new Error(res.statusText || 'Failed to fetch');
      const data = await res.json();
      const tAfterJson = performance.now();
      console.log(`[BoardPerf] fetchBoardSummary HTTP done: fetch=${Math.round(tAfterFetch - tStart)}ms, json=${Math.round(tAfterJson - tAfterFetch)}ms, total=${Math.round(tAfterJson - tStart)}ms`);
      setBoardSummary(data);
      if (isInitialLoad) setIsInitialLoad(false);
    } catch (err) {
      console.error('[BoardPerf] fetchBoardSummary error:', err);
      setBoardError(err.message);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    const tMount = performance.now();
    setBoardLoading(true);
    const unsub = onSnapshot(
      doc(db, 'board_summary', 'current'),
      (snapshot) => {
        const elapsed = Math.round(performance.now() - tMount);
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log(`[BoardPerf] Firestore doc received in ${elapsed}ms (path: board_summary/current)`);
          setBoardSummary(data);
          setBoardError(null);
          setBoardLoading(false);
        } else {
          console.log(`[BoardPerf] Firestore doc missing after ${elapsed}ms, falling back to HTTP`);
          fetchBoardSummary();
        }
        if (isInitialLoad) setIsInitialLoad(false);
      },
      (err) => {
        const elapsed = Math.round(performance.now() - tMount);
        console.error(`[BoardPerf] Board summary listener error after ${elapsed}ms:`, err);
        setBoardError(err.message);
        setBoardLoading(false);
        fetchBoardSummary();
      }
    );
    return () => unsub();
  }, [fetchBoardSummary]);

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
      if (isHoliday) {
        const matchingHoliday = holidays.find(holiday => 
          holiday.getFullYear() === year &&
          holiday.getMonth() === month &&
          holiday.getDate() === day
        );
      }
    }
    
    return isHoliday;
  };

  const needsShippedToday = (order) => {
    // Check for ShipHero override first
    if (order && typeof order === 'object' && order.ship_today_override !== undefined) {
      return order.ship_today_override;
    }

    // Check if order is overdue (past its required ship date)
    const requiredShipDate = getRequiredShipDate(order);
    if (requiredShipDate) {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const requiredDateStr = requiredShipDate.toISOString().split('T')[0];
      
      // If required ship date is today or in the past, and order hasn't shipped, it needs to ship today
      if (requiredDateStr <= todayStr && !order.shippedAt) {
        return true;
      }
    }

    // Fall back to allocated_at calculation for orders not yet overdue
    const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
    if (!allocatedAt) return false;
    
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    
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
    
    // Skip weekends and holidays
    while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0 || isBankHoliday(shipDate)) {
      shipDate.setUTCDate(shipDate.getUTCDate() + 1);
    }
    
    // Compare just the date portion (UTC)
    const today = new Date();
    const shipDateStr = shipDate.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    
    return shipDateStr === todayStr;
  };

  const getRequiredShipDate = (order) => {
    // Check for ShipHero override first
    if (order && typeof order === 'object' && order.required_ship_date_override) {
      const overrideDate = new Date(order.required_ship_date_override);
      
      // Set time to 4:00 PM Eastern for override dates too
      const year = overrideDate.getUTCFullYear();
      const isDST = (date) => {
        const jan = new Date(year, 0, 1).getTimezoneOffset();
        const jul = new Date(year, 6, 1).getTimezoneOffset();
        return Math.max(jan, jul) !== date.getTimezoneOffset();
      };
      const fourPMHourUTC = isDST(new Date()) ? 20 : 21;
      overrideDate.setUTCHours(fourPMHourUTC, 0, 0, 0);
      
      return overrideDate;
    }

    // Fall back to allocated_at calculation
    const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
    if (!allocatedAt) return null;
    
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    
    // Work entirely in UTC to avoid timezone conversion issues
    const allocUTC = new Date(alloc);
    
    // Check if we're in DST (same logic as needsShippedToday)
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
    
    // Set time to 4:00 PM Eastern (20:00 UTC during DST, 21:00 UTC during EST)
    const fourPMHourUTC = isDST(new Date()) ? 20 : 21;
    shipDate.setUTCHours(fourPMHourUTC, 0, 0, 0);
    
    return shipDate;
  };

  const checkSLAMet = (shippedAt, order) => {
    if (!shippedAt || !order) return false;
    const shipped = shippedAt.toDate ? shippedAt.toDate() : new Date(shippedAt);
    const requiredShipDate = getRequiredShipDate(order);
    if (!requiredShipDate) return false;
    
    // Compare dates without time
    const shippedDate = new Date(shipped.getFullYear(), shipped.getMonth(), shipped.getDate());
    const requiredDate = new Date(requiredShipDate.getFullYear(), requiredShipDate.getMonth(), requiredShipDate.getDate());
    
    return shippedDate <= requiredDate;
  };

  const needsShippedTomorrow = (order) => {
    // Check for ShipHero override first
    if (order && typeof order === 'object' && order.ship_tomorrow_override !== undefined) {
      return order.ship_tomorrow_override;
    }

    // Fall back to allocated_at calculation
    const allocatedAt = order && typeof order === 'object' ? order.allocated_at : order;
    if (!allocatedAt) return false;
    
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    
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
    
    // Skip weekends and holidays
    while (shipDate.getUTCDay() === 6 || shipDate.getUTCDay() === 0 || isBankHoliday(shipDate)) {
      shipDate.setUTCDate(shipDate.getUTCDate() + 1);
    }
    
    // Get tomorrow's date (next business day)
    const today = new Date();
    let tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Skip weekends and holidays for tomorrow calculation
    while (tomorrow.getDay() === 6 || tomorrow.getDay() === 0 || isBankHoliday(tomorrow)) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    
    // Compare just the date portion (UTC)
    const shipDateStr = shipDate.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return shipDateStr === tomorrowStr;
  };

  const groupedSorted = useMemo(() => {
    const grouped = {};
    ordersToShipToday.forEach(order => {
      const name = accountLookup.get(order.account_uuid);
      grouped[name] = (grouped[name] || 0) + 1;
    });
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [ordersToShipToday, accountLookup]);

  const visibleClients = useMemo(() => {
    return showAllClients ? groupedSorted : groupedSorted.slice(0, 10);
  }, [groupedSorted, showAllClients]);

  const pieData = useMemo(() => [
    { name: 'Shipped', value: shippedTodayCount },
    { name: 'Unshipped', value: ordersToShipToday.length }
  ], [shippedTodayCount, ordersToShipToday.length]);

  const COLORS = ['#16a34a', '#dc2626'];

  const exportToCSV = useCallback((data, filename) => {
    const headers = ['Order #', 'Client', 'Status', 'Line Items', 'Allocated At', 'Required Ship Date', 'Shipped At', 'SLA Met'];
    const csvData = data.map(order => [
      order.order_number,
      accountLookup.get(order.account_uuid),
      order.status,
      (typeof order.line_items_count === 'number' ? order.line_items_count : Array.isArray(order.line_items) ? order.line_items.length : 0),
      order.allocated_at?.toDate?.()?.toLocaleString() || new Date(order.allocated_at).toLocaleString(),
      (() => { 
        try { 
          const reqDate = getRequiredShipDate(order);
          if (!reqDate) return '—';
          const dateStr = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }).format(reqDate);
          
          // Add indicator if using ShipHero override
          if (order.required_ship_date_override) {
            return `${dateStr} (SH Override)`;
          }
          return dateStr;
        } catch { 
          return '—'; 
        } 
      })(),
      order.shippedAt?.toDate?.()?.toLocaleString() || (order.shippedAt ? new Date(order.shippedAt).toLocaleString() : 'Not Shipped'),
      !order.shippedAt ? 'TBD' : checkSLAMet(order.shippedAt, order) ? 'True' : 'False'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, [accountLookup]);

  const Pagination = ({ total, pageSize, currentPage, setCurrentPage, setPageSize }) => {
    const totalPages = Math.ceil(total / pageSize);
    
    const getPageNumbers = () => {
      const pageNumbers = [];
      const maxVisible = 10;
      const halfVisible = Math.floor(maxVisible / 2);

      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);

      // Adjust start if we're near the end
      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      // Add first page and ellipsis if needed
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }

      // Add visible page numbers
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      // Add last page and ellipsis if needed
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }

      return pageNumbers;
    };
    
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center">
          <span className="mr-2">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border rounded px-2 py-1"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="ml-2">entries</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ««
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            «
          </button>
          {getPageNumbers().map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="px-3 py-1">...</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded border ${currentPage === page ? 'bg-blue-500 text-white' : ''}`}
              >
                {page}
              </button>
            )
          ))}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »»
          </button>
        </div>
        <div>
          Showing {Math.min((currentPage - 1) * pageSize + 1, total)} to {Math.min(currentPage * pageSize, total)} of {total} entries
        </div>
      </div>
    );
  };

  const paginateData = useCallback((data, pageSize, currentPage) => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, []);

  const uniqueClients = useMemo(() => {
    return [...new Set(ordersForLookup.map(order => order.account_uuid))]
      .map(uuid => ({
        value: uuid || 'unknown',
        label: accountMap[uuid] || uuid || 'Unknown'
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ordersForLookup, accountMap]);

  const getDateRange = useCallback((rangeType, customStart = null, customEnd = null) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (rangeType) {
      case 'today':
        return { start: today, end: now };
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: today };
      }
      case 'last7': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        return { start: last7, end: now };
      }
      case 'custom':
        return {
          start: customStart ? new Date(customStart) : null,
          end: customEnd ? new Date(customEnd) : null
        };
      default:
        return { start: null, end: null };
    }
  }, []);

  const filterOrders = useCallback((orders, clientFilter, statusFilter, dateRangeType, customStart, customEnd, slaFilter, searchTerm) => {
    return orders.filter(order => {
      // Search filter
      if (searchTerm && searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase().trim();
        const orderNumber = (order.order_number || '').toLowerCase();
        if (!orderNumber.includes(searchLower)) {
          return false;
        }
      }

      // Client filter
      if (clientFilter !== 'all' && order.account_uuid !== clientFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // SLA filter
      if (slaFilter !== 'all') {
        if (slaFilter === 'tbd' && order.shippedAt) return false;
        if (slaFilter === 'true' && (!order.shippedAt || !checkSLAMet(order.shippedAt, order))) return false;
        if (slaFilter === 'false' && (!order.shippedAt || checkSLAMet(order.shippedAt, order))) return false;
      }

      // Date filter
      if (dateRangeType !== 'all') {
        const { start, end } = getDateRange(dateRangeType, customStart, customEnd);
        if (start && end) {
          const orderDate = order.allocated_at?.toDate?.() || new Date(order.allocated_at);
          return orderDate >= start && orderDate <= end;
        }
      }

      return true;
    });
  }, [getDateRange]);

  // Memoize filtered orders
  const filteredTodayOrders = useMemo(() => {
    return filterOrders(
      ordersToShipToday,
      selectedClient,
      selectedStatus,
      'all',
      null,
      null,
      'all',
      todayOrderSearch
    );
  }, [ordersToShipToday, selectedClient, selectedStatus, todayOrderSearch]);

  const filteredTomorrowOrders = useMemo(() => {
    return filterOrders(
      ordersToShipTomorrow,
      tomorrowOrdersClient,
      tomorrowOrdersStatus,
      tomorrowOrdersDateRange,
      tomorrowOrdersCustomStartDate,
      tomorrowOrdersCustomEndDate,
      'all',
      tomorrowOrdersSearch
    );
  }, [ordersToShipTomorrow, tomorrowOrdersClient, tomorrowOrdersStatus, tomorrowOrdersDateRange, tomorrowOrdersCustomStartDate, tomorrowOrdersCustomEndDate, tomorrowOrdersSearch]);

  // Optimize search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setTodayOrderSearch(todayOrderSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [todayOrderSearchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTomorrowOrdersSearch(tomorrowOrdersSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [tomorrowOrdersSearchInput]);

  const parseShipHeroTimestamp = useCallback((timestamp) => {
    if (!timestamp) return null;
    // If it's a Firestore timestamp, use toDate()
    if (timestamp.toDate) return timestamp.toDate();
    
    // ShipHero sends timestamps in UTC format without timezone info
    // We need to parse as UTC and let the display formatter handle Eastern conversion
    if (typeof timestamp === 'string') {
      // Handle both formats: "2024-01-15 10:30:00" and "2024-01-15T10:30:00"
      let timeStr = timestamp;
      if (timestamp.includes('T')) {
        timeStr = timestamp.replace('T', ' ');
      }
      
      // Parse as UTC since ShipHero sends UTC timestamps
      return new Date(timeStr + ' UTC');
    }
    
    // Fallback
    return new Date(timestamp);
  }, []);

  const handleManualComplete = useCallback((orderNumber) => {
    if (confirmingManual !== orderNumber) {
      // First click - show confirmation
      setConfirmingManual(orderNumber);
      // Auto-reset after 5 seconds
      setTimeout(() => {
        setConfirmingManual(null);
      }, 5000);
    } else {
      // Second click - actually complete the order
      markOrderAsManual(orderNumber);
      setConfirmingManual(null);
    }
  }, [confirmingManual]);

  const markOrderAsManual = useCallback(async (orderNumber) => {
    try {
      console.log(`🔧 Marking order ${orderNumber} as manual complete`);
      
      // Update the order in Firestore
      const orderRef = doc(db, 'orders', orderNumber);
      await updateDoc(orderRef, {
        status: 'manual',
        manualCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Successfully marked order ${orderNumber} as manual`);
    } catch (error) {
      console.error(`❌ Error marking order ${orderNumber} as manual:`, error);
      alert(`Error updating order: ${error.message}`);
    }
  }, []);

  const verifyOrderWithGraphQL = async (orderNumber) => {
    try {
      const queryBody = {
        query: `
          query {
            orders(order_number: "${orderNumber}") {
              data {
                edges {
                  node {
                    fulfillment_status
                    shipments {
                      created_date
                    }
                    allocations {
                      ready_to_ship
                    }
                  }
                }
              }
            }
          }
        `
      };

      console.log('🔍 Sending GraphQL query for order:', orderNumber);
      console.log('📤 Query:', JSON.stringify(queryBody, null, 2));
      console.log('🔑 Token loaded:', import.meta.env.VITE_SHIPHERO_API_TOKEN ? `Yes (length: ${import.meta.env.VITE_SHIPHERO_API_TOKEN.length})` : 'No - Token is missing!');

      const response = await fetch('https://public-api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SHIPHERO_API_TOKEN}`
        },
        body: JSON.stringify(queryBody)
      });

      const data = await response.json();
      console.log('📥 Response for order', orderNumber + ':', JSON.stringify(data, null, 2));

      if (data.errors) {
        console.error('❌ GraphQL Errors for order', orderNumber + ':', data.errors);
        setRefreshLog(prev => [...prev, `❌ Order ${orderNumber}: GraphQL Error - ${data.errors[0]?.message || 'Unknown error'}`]);
        return null;
      }

      if (!data?.data?.orders?.data?.edges?.[0]?.node) {
        console.warn('⚠️ No data found for order', orderNumber);
        setRefreshLog(prev => [...prev, `⚠️ Order ${orderNumber}: No data returned from ShipHero`]);
        return null;
      }

      console.log('✅ Successfully processed order:', orderNumber);
      return data?.data?.orders?.data?.edges?.[0]?.node;
    } catch (error) {
      console.error(`❌ Error verifying order ${orderNumber}:`, error);
      setRefreshLog(prev => [...prev, `❌ Order ${orderNumber}: ${error.message}`]);
      return null;
    }
  };

  const processOrders = async (ordersToProcess, notReadyOrders) => {
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: ordersToProcess.length + (notReadyOrders?.length || 0) });
    setRefreshLog([`Starting refresh of ${ordersToProcess.length + (notReadyOrders?.length || 0)} orders...`]);

    try {
      const chunkSize = 25; // Process 25 orders at a time
      const allResults = [];
      let totalProcessed = 0;

      // Process regular orders in chunks
      for (let i = 0; i < ordersToProcess.length; i += chunkSize) {
        const chunk = ordersToProcess.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        const totalChunks = Math.ceil(ordersToProcess.length / chunkSize);
        
        setRefreshLog(prev => [...prev, `📦 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} orders)...`]);

        try {
          const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/verifyOrders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ordersToVerify: chunk,
              notReadyOrders: [] // Process these separately
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to verify chunk');
          }

          // Process results and update progress
          for (const result of data.results) {
            totalProcessed++;
            setRefreshProgress({ current: totalProcessed, total: ordersToProcess.length + (notReadyOrders?.length || 0) });
            
            if (result.status === 'success') {
              if (result.changes) {
                const changes = Object.entries(result.changes)
                  .filter(([key]) => !['lastVerified', 'updatedAt'].includes(key))
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ');
                setRefreshLog(prev => [...prev, `✅ Order ${result.order_number}: Updated (${changes})`]);
              } else {
                setRefreshLog(prev => [...prev, `ℹ️ Order ${result.order_number}: No changes needed`]);
              }
            } else {
              setRefreshLog(prev => [...prev, `❌ Order ${result.order_number}: ${result.message}`]);
            }
          }

          allResults.push(...data.results);
          setRefreshLog(prev => [...prev, `✅ Completed chunk ${chunkNumber}/${totalChunks} in ${data.totalTime?.toFixed(1)}s`]);

          // Small delay between chunks to prevent overwhelming the API
          if (i + chunkSize < ordersToProcess.length) {
            setRefreshLog(prev => [...prev, `⏰ Waiting 2 seconds before next chunk...`]);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (chunkError) {
          setRefreshLog(prev => [...prev, `❌ Error processing chunk ${chunkNumber}: ${chunkError.message}`]);
          // Continue with next chunk even if one fails
        }
      }

      // Process not-ready orders in chunks
      if (notReadyOrders && notReadyOrders.length > 0) {
        setRefreshLog(prev => [...prev, `🔄 Processing ${notReadyOrders.length} not-ready orders...`]);
        
        for (let i = 0; i < notReadyOrders.length; i += chunkSize) {
          const chunk = notReadyOrders.slice(i, i + chunkSize);
          const chunkNumber = Math.floor(i / chunkSize) + 1;
          const totalChunks = Math.ceil(notReadyOrders.length / chunkSize);
          
          setRefreshLog(prev => [...prev, `📦 Processing not-ready chunk ${chunkNumber}/${totalChunks} (${chunk.length} orders)...`]);

          try {
            const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/verifyOrders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ordersToVerify: [],
                notReadyOrders: chunk
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error || 'Failed to verify chunk');
            }

            // Process results and update progress
            for (const result of data.results) {
              totalProcessed++;
              setRefreshProgress({ current: totalProcessed, total: ordersToProcess.length + (notReadyOrders?.length || 0) });
              
              if (result.status === 'success') {
                setRefreshLog(prev => [...prev, `✅ Order ${result.order_number}: ${result.message}`]);
              } else {
                setRefreshLog(prev => [...prev, `❌ Order ${result.order_number}: ${result.message}`]);
              }
            }

            allResults.push(...data.results);
            setRefreshLog(prev => [...prev, `✅ Completed not-ready chunk ${chunkNumber}/${totalChunks} in ${data.totalTime?.toFixed(1)}s`]);

            // Small delay between chunks
            if (i + chunkSize < notReadyOrders.length) {
              setRefreshLog(prev => [...prev, `⏰ Waiting 2 seconds before next chunk...`]);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

          } catch (chunkError) {
            setRefreshLog(prev => [...prev, `❌ Error processing not-ready chunk ${chunkNumber}: ${chunkError.message}`]);
          }
        }
      }

      const successCount = allResults.filter(r => r.status === 'success' && r.changes).length;
      const errorCount = allResults.filter(r => r.status === 'error').length;
      
      setRefreshLog(prev => [...prev, `✨ Refresh complete! Updated ${successCount} orders, ${errorCount} errors.`]);

    } catch (error) {
      console.error('💥 Error processing orders:', error);
      setRefreshLog(prev => [...prev, `❌ Error during refresh: ${error.message}`]);
    } finally {
      setIsRefreshing(false);
      setIsRefreshConfirming(false);
      setRefreshProgress({ current: 0, total: 0 });
      fetchBoardSummary(true);
    }
  };

  // Loading screen component
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <img 
          src="/face.png" 
          alt="Loading..." 
          className="animate-spin-counter-clockwise h-24 w-24 mx-auto mb-4"
        />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Loading SuperHero Board</h2>
        <p className="text-gray-600">This may take a moment...</p>
      </div>
    </div>
  );

  // Show loading screen during initial load
  if (isInitialLoad) {
    return <LoadingScreen />;
  }

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
      >{/* This is the X in the sidebar */}
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
            <Link 
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
            </Link>
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
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
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
            {/* DISABLED: Not being used, has expensive real-time listeners */}
            {/* <Link 
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
            </Link> */}
            <Link 
              to="/countdown" 
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Countdown</span>
              </div>
            </Link>
            <Link 
              to="/client-reports" 
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
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Client Reports</span>
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
                {/* Toggle removed - only one view now */}
              </div>
              {/* Refresh button for mobile */}
              {(isAuthenticated && (userRole === 'admin' || userRole === 'limited')) && (
                <button
                  onClick={() => {
                    if (isRefreshing) return;
                    
                    if (!isRefreshConfirming) {
                      setIsRefreshConfirming(true);
                      setRefreshLog([]); // Clear previous logs
                      const timer = setTimeout(() => {
                        setIsRefreshConfirming(false);
                      }, 5000);
                      return () => clearTimeout(timer);
                    }
                    
                    // Orders to verify = today's orders from board summary
                    const ordersToVerify = ordersToShipToday;

                    // Get orders from not_ready_to_ship that need to be rechecked
                    const notReadyOrdersToVerify = notReadyToShipOrders.filter(order =>
                      needsShippedToday(order)
                    );

                    processOrders(ordersToVerify, notReadyOrdersToVerify);
                  }}
                  disabled={isRefreshing}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm text-sm ${
                    isRefreshing ? 'bg-blue-600 opacity-75 cursor-not-allowed' :
                    isRefreshConfirming ? 'bg-red-600 hover:bg-red-700 text-white' : 
                    'bg-slate-700 hover:bg-slate-800 text-white'
                  }`}
                >
                  <svg 
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d={isRefreshing ? 
                        "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" :
                        isRefreshConfirming ?
                        "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" :
                        "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      }
                    />
                  </svg>
                  {isRefreshing ? 
                    'Refreshing' : 
                    isRefreshConfirming ? 'Sure?' : 
                    'Refresh'}
                </button>
              )}
            </div>
          </div>

          {/* Desktop Layout - Hidden on mobile */}
          <div className="hidden md:block relative pt-10">
          <div className="text-center">
            <h1 className="text-6xl font-extrabold tracking-tight text-slate-800 mb-2">⚡ SuperHero Board ⚡</h1>
            <p className="text-slate-500 text-lg font-medium mb-8 pt-2">
              Real-time order overview for when <i>ship</i> gets real
            </p>
          </div>
          {/* Refresh Controls - icon-only below 1285px to avoid overlap with title */}
          <div className="absolute top-10 right-0 flex flex-col items-end">
            {(isAuthenticated && (userRole === 'admin' || userRole === 'limited')) && (
            <button
              onClick={() => {
                if (isRefreshing) return;
                
                if (!isRefreshConfirming) {
                  setIsRefreshConfirming(true);
                  setRefreshLog([]); // Clear previous logs
                  const timer = setTimeout(() => {
                    setIsRefreshConfirming(false);
                  }, 5000);
                  return () => clearTimeout(timer);
                }
                
                // Orders to verify = today's orders from board summary
                const ordersToVerify = ordersToShipToday;

                // Get orders from not_ready_to_ship that need to be rechecked
                const notReadyOrdersToVerify = notReadyToShipOrders.filter(order =>
                  needsShippedToday(order)
                );

                processOrders(ordersToVerify, notReadyOrdersToVerify);
              }}
              disabled={isRefreshing}
              title="Sync with ShipHero"
              className={`p-2 min-[1050px]:px-3 min-[1050px]:py-2 min-[1285px]:px-4 min-[1285px]:py-2 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm min-[1285px]:min-w-[160px] justify-center ${
                isRefreshing ? 'bg-blue-600 opacity-75 cursor-not-allowed' :
                isRefreshConfirming ? 'bg-red-600 hover:bg-red-700 text-white' : 
                'bg-slate-700 hover:bg-slate-800 text-white'
              }`}
            >
              <svg 
                className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={isRefreshing ? 
                    "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" :
                    isRefreshConfirming ?
                    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" :
                    "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  }
                />
              </svg>
              <span className="hidden min-[1050px]:inline min-[1285px]:hidden whitespace-nowrap">
                {isRefreshing ? `Syncing (${refreshProgress.current}/${refreshProgress.total})` : isRefreshConfirming ? 'Sure?' : 'Refresh'}
              </span>
              <span className="hidden min-[1285px]:inline whitespace-nowrap">
                {isRefreshing ? 
                  `Syncing (${refreshProgress.current}/${refreshProgress.total})` : 
                  isRefreshConfirming ? 'Are you sure?' : 
                  'Sync with ShipHero'}
              </span>
            </button>
            )}
            {isInitialLoad && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1.5 min-[1285px]:mt-0">
                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="hidden min-[1285px]:inline">Loading data...</span>
              </div>
            )}
          </div>

          {/* Mobile Title - Only visible on mobile */}
          <div className="block md:hidden text-center pt-4 pb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-800 mb-2">⚡ SuperHero Board ⚡</h1>
            <p className="text-slate-500 text-base font-medium">
              Real-time order overview for when <i>ship</i> gets real
            </p>
          </div>

        </div>

        {/* Shared refresh log for both mobile and desktop */}
        {isRefreshing && refreshLog.length > 0 && (
          <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
            <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-3">
              <h3 className="text-white font-semibold">Refresh Progress</h3>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto max-h-80">
              {refreshLog.map((log, index) => (
                <div key={index} className="text-sm text-gray-600">{log}</div>
              ))}
            </div>
          </div>
        )}

        {boardError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg flex items-center justify-between">
            <span className="text-red-800">Failed to load board: {boardError}</span>
            <button onClick={fetchBoardSummary} className="px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-sm">Retry</button>
          </div>
        )}
        <div className="flex flex-col md:flex-row items-start gap-6 md:gap-12 mt-6 md:mt-10 pt-2 md:pt-5">
          <div className="flex flex-col justify-start pt-2 flex-[1.6]">
            {boardLoading && !boardSummary ? (
              <div className="text-2xl text-slate-500 animate-pulse">Loading board...</div>
            ) : (
            <>
            <div className="text-6xl md:text-9xl font-extrabold text-slate-900 mb-2 text-left">{ordersToShipToday.length}</div>
            <div className="text-2xl md:text-4xl text-slate-700 font-medium text-left mb-1">🚚 Needs shipped today</div>
            <div className="text-6xl md:text-9xl font-extrabold text-slate-800 mb-2 text-left pt-6 md:pt-10">
              {shippedToday.length}
            </div>
            <div className="text-2xl md:text-4xl text-slate-600 font-medium text-left mb-1">🎉 Shipped today</div>
            <div className="text-6xl md:text-9xl font-extrabold text-slate-700 mb-2 text-left pt-6 md:pt-10">{ordersToShipTomorrow.length}</div>
            <div className="text-2xl md:text-4xl text-slate-500 font-medium text-left mb-1 pb-8 md:pb-12">📅 Needs shipped tomorrow</div>
            </>
            )}
          </div>

          <div className="flex-[1.4] min-w-0 w-full h-full">
            <div className="h-full min-w-0">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">🏆 Top Clients by Open Orders 🏆</h2>
                <div className="overflow-y-auto max-h-[300px]">
                  <ul className="divide-y divide-slate-200">
                    {visibleClients.slice(0, showAllClients ? undefined : 6).map(([client, count], idx) => (
                      <li
                        key={client}
                        className={`flex justify-between items-center py-2 px-3 transition ${
                          idx % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'
                        } hover:bg-slate-200`}
                      >
                        <span className="text-lg text-slate-800 font-semibold truncate">{client}</span>
                        <span className="text-lg font-bold text-slate-700 ml-2">{count}</span>
                      </li>
                    ))}
                  </ul>
                  {groupedSorted.length > 6 && (
                    <button
                      onClick={() => setShowAllClients(prev => !prev)}
                      className="mt-2 text-sm text-slate-600 hover:text-slate-800 hover:underline"
                    >
                      {showAllClients ? 'Show Less' : 'See All'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 mb-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 min-w-0">
                  <div className="relative shrink-0 w-[240px] min-w-[240px] h-[240px] sm:w-[280px] sm:min-w-[280px] sm:h-[280px] md:w-[300px] md:min-w-[300px] md:h-[300px] p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={110}
                          innerRadius={55}
                          isAnimationActive={true}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                            const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                            return (
                              <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="middle" className="text-sm sm:text-base font-bold">
                                {`${(percent * 100).toFixed(0)}%`}
                              </text>
                            );
                          }}
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="hidden min-[1315px]:flex flex-col items-start gap-6 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: COLORS[0] }}></div>
                      <div className="text-3xl text-slate-800">Shipped Orders</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: COLORS[1] }}></div>
                      <div className="text-3xl text-slate-800">Unshipped Orders</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">Orders To Ship Today</h2>
                <p className="text-blue-100 mt-1">Who needs a subtitle for a table?</p>
              </div>
              <button 
                onClick={() => exportToCSV(filteredTodayOrders, `orders_to_ship_today_${new Date().toISOString().split('T')[0]}.csv`)}
                className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export to CSV</span>
              </button>
            </div>
          </div>
          <FilterSection
            clientValue={selectedClient}
            onClientChange={setSelectedClient}
            statusValue={selectedStatus}
            onStatusChange={setSelectedStatus}
            dateRangeValue={dateRange}
            onDateRangeChange={setDateRange}
            customStart={customStartDate}
            onCustomStartChange={setCustomStartDate}
            customEnd={customEndDate}
            onCustomEndChange={setCustomEndDate}
            slaValue={'all'}
            onSLAChange={() => {}}
            showSLA={false}
            searchValue={todayOrderSearch}
            onSearchChange={setTodayOrderSearch}
            searchInputValue={todayOrderSearchInput}
            onSearchInputChange={setTodayOrderSearchInput}
            searchPlaceholder="Search by order number..."
            uniqueClients={uniqueClients}
            statusOptions={statusOptions}
            dateRangeOptions={dateRangeOptions}
            slaOptions={slaOptions}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center space-x-2">
                      <span>Order #</span>
                      <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook Type</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Items</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated At</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipped At</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isProcessingData ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Processing data...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginateData(filteredTodayOrders, todayPageSize, todayCurrentPage).map((order, idx) => (
                  <tr 
                    key={order.id} 
                    className={`
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      hover:bg-blue-50 transition-colors duration-150 ease-in-out
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{order.order_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{accountMap[order.account_uuid] || order.account_uuid || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.webhook_type || 'Order Allocated'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {typeof order.line_items_count === 'number' ? `${order.line_items_count} item(s)` : Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => { 
                        try { 
                          if (!order.allocated_at) return '—'; 
                          const date = parseShipHeroTimestamp(order.allocated_at);
                          return new Intl.DateTimeFormat('en-US', {
                            timeZone: 'America/New_York',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }).format(date);
                        } catch { 
                          return '—'; 
                        } 
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => { 
                        try { 
                          if (!order.shippedAt) return '—'; 
                          const date = parseShipHeroTimestamp(order.shippedAt);
                          return new Intl.DateTimeFormat('en-US', {
                            timeZone: 'America/New_York',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }).format(date);
                        } catch { 
                          return '—'; 
                        } 
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleManualComplete(order.order_number)}
                        className={`px-2 py-1 text-xs font-medium rounded border transition-colors duration-150 ${
                          confirmingManual === order.order_number 
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={confirmingManual === order.order_number ? "Click again to confirm manual completion" : "Mark as manually completed"}
                      >
                        {confirmingManual === order.order_number ? 'Confirm?' : 'Mark Done'}
                      </button>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="7" className="px-6 py-4">
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            total={filteredTodayOrders.length}
            pageSize={todayPageSize}
            currentPage={todayCurrentPage}
            setCurrentPage={setTodayCurrentPage}
            setPageSize={setTodayPageSize}
          />
        </div>

        {/* Needs Shipped Tomorrow Section */}
        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
          <div className="bg-gradient-to-r from-orange-600 to-orange-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">Orders To Ship Tomorrow</h2>
                <p className="text-orange-100 mt-1">Orders scheduled for tomorrow's shipment</p>
              </div>
              <button 
                onClick={() => exportToCSV(filteredTomorrowOrders, `orders_to_ship_tomorrow_${new Date().toISOString().split('T')[0]}.csv`)}
                className="bg-white text-orange-700 hover:bg-orange-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export to CSV</span>
              </button>
            </div>
          </div>
          <FilterSection
            clientValue={tomorrowOrdersClient}
            onClientChange={setTomorrowOrdersClient}
            statusValue={tomorrowOrdersStatus}
            onStatusChange={setTomorrowOrdersStatus}
            dateRangeValue={tomorrowOrdersDateRange}
            onDateRangeChange={setTomorrowOrdersDateRange}
            customStart={tomorrowOrdersCustomStartDate}
            onCustomStartChange={setTomorrowOrdersCustomStartDate}
            customEnd={tomorrowOrdersCustomEndDate}
            onCustomEndChange={setTomorrowOrdersCustomEndDate}
            slaValue={'all'}
            onSLAChange={() => {}}
            showSLA={false}
            searchValue={tomorrowOrdersSearch}
            onSearchChange={setTomorrowOrdersSearch}
            searchInputValue={tomorrowOrdersSearchInput}
            onSearchInputChange={setTomorrowOrdersSearchInput}
            searchPlaceholder="Search by order number..."
            uniqueClients={uniqueClients}
            statusOptions={statusOptions}
            dateRangeOptions={dateRangeOptions}
            slaOptions={slaOptions}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center space-x-2">
                      <span>Order #</span>
                      <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook Type</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Items</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated At</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Ship Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginateData(filteredTomorrowOrders, tomorrowPageSize, tomorrowCurrentPage).map((order, idx) => (
                  <tr 
                    key={order.id} 
                    className={`
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      hover:bg-orange-50 transition-colors duration-150 ease-in-out
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">{order.order_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{accountMap[order.account_uuid] || order.account_uuid || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.webhook_type || 'Order Allocated'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        {typeof order.line_items_count === 'number' ? `${order.line_items_count} item(s)` : Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => { 
                        try { 
                          if (!order.allocated_at) return '—'; 
                          const date = parseShipHeroTimestamp(order.allocated_at);
                          return new Intl.DateTimeFormat('en-US', {
                            timeZone: 'America/New_York',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }).format(date);
                        } catch { 
                          return '—'; 
                        } 
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => { 
                        try { 
                          const reqDate = getRequiredShipDate(order);
                          if (!reqDate) return '—';
                          const dateStr = new Intl.DateTimeFormat('en-US', {
                            timeZone: 'America/New_York',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }).format(reqDate);
                          
                          // Add indicator if using ShipHero override
                          if (order.required_ship_date_override) {
                            return (
                              <div className="flex items-center gap-1">
                                <span>{dateStr}</span>
                                <span 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  title="Date from ShipHero override"
                                >
                                  SH
                                </span>
                              </div>
                            );
                          }
                          return dateStr;
                        } catch { 
                          return '—'; 
                        } 
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="6" className="px-6 py-4">
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination
            total={filteredTomorrowOrders.length}
            pageSize={tomorrowPageSize}
            currentPage={tomorrowCurrentPage}
            setCurrentPage={setTomorrowCurrentPage}
            setPageSize={setTomorrowPageSize}
          />
        </div>

        {/* Add Not Ready to Ship Orders Section */}
        {notReadyToShipOrders.length > 0 && (
          <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
            <div className="bg-gradient-to-r from-pink-400 to-pink-600 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white">Not Ready to Ship</h2>
                  <p className="text-pink-100 mt-1">Orders removed from "Ship Today" due to ready_to_ship status change</p>
                </div>
                <button 
                  onClick={() => exportToCSV(notReadyToShipOrders, `not_ready_to_ship_${new Date().toISOString().split('T')[0]}.csv`)}
                  className="bg-white text-pink-700 hover:bg-pink-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export to CSV</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Items</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated At</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Removed At</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {notReadyToShipOrders.map((order, idx) => (
                    <tr 
                      key={order.id} 
                      className={`
                        ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        hover:bg-pink-50 transition-colors duration-150 ease-in-out
                      `}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-600">{order.order_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{accountMap[order.account_uuid] || order.account_uuid || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-pink-100 text-pink-800">
                          {typeof order.line_items_count === 'number' ? `${order.line_items_count} item(s)` : Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(() => { 
                          try { 
                            if (!order.allocated_at) return '—'; 
                            const date = parseShipHeroTimestamp(order.allocated_at);
                            return new Intl.DateTimeFormat('en-US', {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true
                            }).format(date);
                          } catch { 
                            return '—'; 
                          } 
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(() => {
                          try {
                            if (!order.removed_at) return '—';
                            const date = typeof order.removed_at.toDate === 'function'
                              ? order.removed_at.toDate()
                              : new Date(order.removed_at);
                            return new Intl.DateTimeFormat('en-US', {
                              timeZone: 'America/New_York',
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true
                            }).format(date);
                          } catch { 
                            return '—'; 
                          } 
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
      </div>

    </div>
  );
}

function App() {
  return (
    <PasswordGate>
      <AppWrapper />
    </PasswordGate>
  );
}

export default App;
