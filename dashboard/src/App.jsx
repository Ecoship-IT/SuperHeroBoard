import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function App() {
  const [orders, setOrders] = useState([]);
  const [showAllClients, setShowAllClients] = useState(false);
  const [currentSlide, setCurrentSlide] = useState('clientList');
  const [sortField, setSortField] = useState('allocated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [todayPageSize, setTodayPageSize] = useState(25);
  const [todayCurrentPage, setTodayCurrentPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRefreshConfirming, setIsRefreshConfirming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter states
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // All orders table filters
  const [allOrdersClient, setAllOrdersClient] = useState('all');
  const [allOrdersStatus, setAllOrdersStatus] = useState('all');
  const [allOrdersDateRange, setAllOrdersDateRange] = useState('all');
  const [allOrdersCustomStartDate, setAllOrdersCustomStartDate] = useState('');
  const [allOrdersCustomEndDate, setAllOrdersCustomEndDate] = useState('');
  const [allOrdersSLAMet, setAllOrdersSLAMet] = useState('all');

  const pageSizeOptions = [25, 50, 100, 250, 500];
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
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'cleared', label: 'Cleared' },
    { value: 'deallocated', label: 'Deallocated' }
  ];

  const slaOptions = [
    { value: 'all', label: 'All SLA Status' },
    { value: 'true', label: 'SLA Met' },
    { value: 'false', label: 'SLA Not Met' },
    { value: 'tbd', label: 'TBD' }
  ];

  const accountMap = {
    "QWNjb3VudDo4MzMyNw==": "Polymer Clay Superstore",
    "QWNjb3VudDo4Mzc4Mw==": "Waverles Shipping",
    "QWNjb3VudDo4Mzk3MQ==": "Friendly Robot",
    "QWNjb3VudDo4Mzk4Mw==": "Quilling Shipping",
    "QWNjb3VudDo4NDQxMw==": "Waterlust Shipping",
    "QWNjb3VudDo4NDQxNg==": "Omez Beauty",
    "QWNjb3VudDo4NDQxOQ==": "Gist Yarn",
    "QWNjb3VudDo4NDQzMQ==": "Bonne et Filou",
    "QWNjb3VudDo4NDQ0NA==": "Chiropractic Outside The Box",
    "QWNjb3VudDo4NDQ0NQ==": "Tracy Higley",
    "QWNjb3VudDo4NDQ1OA==": "Mary DeMuth Art",
    "QWNjb3VudDo4NDQ2Nw==": "Birmingham Pens",
    "QWNjb3VudDo4NDQ5Ng==": "Iron Snail",
    "QWNjb3VudDo4NDU1NA==": "Stephanie Whittier Wellness / T Spheres Brand",
    "QWNjb3VudDo4NDU3OQ==": "I Have ADHD",
    "QWNjb3VudDo4NDU4Mw==": "Visible Health",
    "QWNjb3VudDo4NDYwNw==": "Lisa T. Bergren",
    "QWNjb3VudDo4NDYwOA==": "Maker Milk",
    "QWNjb3VudDo4NDYzNw==": "Pit Command",
    "QWNjb3VudDo4NDcwMA==": "Radical Tea towel",
    "QWNjb3VudDo4NDcwMQ==": "Pack for Camp",
    "QWNjb3VudDo4NDcwMw==": "Venture Healthcare LTD",
    "QWNjb3VudDo4NDczOA==": "Forth, LLC",
    "QWNjb3VudDo4NDgwMA==": "Water eStore",
    "QWNjb3VudDo4NDg0MA==": "Monochrome Books Inc",
    "QWNjb3VudDo4NDg1MQ==": "Cottonique Shipping",
    "QWNjb3VudDo4NDg3Mg==": "Earth Fed Muscle",
    "QWNjb3VudDo4NDg5Mw==": "Rongrong Shipping",
    "QWNjb3VudDo4NDg5Ng==": "Forge and Foster",
    "QWNjb3VudDo4NDkxMw==": "Carmen Electra - Mawer Capital",
    "QWNjb3VudDo4NDkyMQ==": "TheTickSuit Shipping",
    "QWNjb3VudDo4NDkzOQ==": "Oh Flora Store",
    "QWNjb3VudDo4NTA0MQ==": "Blu & Green",
    "QWNjb3VudDo4NTA1MA==": "Northshea Shipping",
    "QWNjb3VudDo4NTEwNg==": "Rizo Radiance",
    "QWNjb3VudDo4NTIxNQ==": "Eco Ship",
    "QWNjb3VudDo4NTIxNw==": "Roccoco Botanicals",
    "QWNjb3VudDo4NTI2MA==": "Nano-B",
    "QWNjb3VudDo4NTQ0OA==": "Liv Holistic",
    "QWNjb3VudDo4NTQ1MA==": "Sustainable Threads",
    "QWNjb3VudDo4NTQ1OA==": "Just Tall Ltd",
    "QWNjb3VudDo4NTQ3MQ==": "Dancing Moon Coffee Co."
  };

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === 'clientList' ? 'pieChart' : 'clientList'));
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const needsShippedToday = (allocatedAt) => {
    if (!allocatedAt) return false;
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(8, 0, 0, 0);
    const isBeforeCutoff = alloc < cutoff;
    let shipDate = new Date(now);
    if (!isBeforeCutoff) shipDate.setDate(shipDate.getDate() + 1);
    while (shipDate.getDay() === 6 || shipDate.getDay() === 0) shipDate.setDate(shipDate.getDate() + 1);
    return shipDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
  };

  const getRequiredShipDate = (allocatedAt) => {
    if (!allocatedAt) return null;
    const alloc = allocatedAt.toDate ? allocatedAt.toDate() : new Date(allocatedAt);
    const cutoff = new Date(alloc);
    cutoff.setHours(8, 0, 0, 0);
    const isBeforeCutoff = alloc < cutoff;
    let shipDate = new Date(alloc);
    if (!isBeforeCutoff) shipDate.setDate(shipDate.getDate() + 1);
    while (shipDate.getDay() === 6 || shipDate.getDay() === 0) shipDate.setDate(shipDate.getDate() + 1);
    return shipDate;
  };

  const checkSLAMet = (shippedAt, allocatedAt) => {
    if (!shippedAt || !allocatedAt) return false;
    const shipped = shippedAt.toDate ? shippedAt.toDate() : new Date(shippedAt);
    const requiredShipDate = getRequiredShipDate(allocatedAt);
    if (!requiredShipDate) return false;
    
    // Compare dates without time
    const shippedDate = new Date(shipped.getFullYear(), shipped.getMonth(), shipped.getDate());
    const requiredDate = new Date(requiredShipDate.getFullYear(), requiredShipDate.getMonth(), requiredShipDate.getDate());
    
    return shippedDate <= requiredDate;
  };

  const ordersToShipToday = orders.filter(
    order => 
      needsShippedToday(order.allocated_at) &&
      !['shipped', 'cancelled', 'cleared', 'deallocated'].includes(order.status) &&
      order.ready_to_ship === true
  );

  const shippedToday = orders.filter(order => {
    if (order.status !== 'shipped' || !order.shippedAt) return false;
    try {
      const shipDate = order.shippedAt.toDate ? order.shippedAt.toDate() : new Date(order.shippedAt);
      return shipDate.toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  });

  const grouped = {};
  orders
    .filter(order => 
      needsShippedToday(order.allocated_at) &&
      !['shipped', 'cancelled', 'cleared', 'deallocated'].includes(order.status) &&
      order.ready_to_ship === true
    )
    .forEach(order => {
      const name = accountMap[order.account_uuid] || order.account_uuid || 'Unknown';
      grouped[name] = (grouped[name] || 0) + 1;
    });

  const groupedSorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const visibleClients = showAllClients ? groupedSorted : groupedSorted.slice(0, 10);

  const pieData = [
    { name: 'Shipped', value: shippedToday.length },
    { name: 'Unshipped', value: ordersToShipToday.length }
  ];

  const COLORS = ['#16a34a', '#dc2626'];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOrders = [...orders].sort((a, b) => {
    let aValue, bValue;

    if (sortField === 'client') {
      aValue = accountMap[a.account_uuid] || a.account_uuid || 'Unknown';
      bValue = accountMap[b.account_uuid] || b.account_uuid || 'Unknown';
    } else if (sortField === 'allocated_at' || sortField === 'shippedAt') {
      aValue = a[sortField]?.toDate?.() || new Date(a[sortField] || 0);
      bValue = b[sortField]?.toDate?.() || new Date(b[sortField] || 0);
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const exportToCSV = () => {
    const headers = ['Order #', 'Client', 'Status', 'Line Items', 'Allocated At', 'Shipped At'];
    const csvData = sortedOrders.map(order => [
      order.order_number,
      accountMap[order.account_uuid] || order.account_uuid || 'Unknown',
      order.status,
      Array.isArray(order.line_items) ? order.line_items.length : 0,
      order.allocated_at?.toDate?.()?.toLocaleString() || new Date(order.allocated_at).toLocaleString(),
      order.shippedAt?.toDate?.()?.toLocaleString() || (order.shippedAt ? new Date(order.shippedAt).toLocaleString() : '—')
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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

  const paginateData = (data, pageSize, currentPage) => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  const uniqueClients = [...new Set(orders.map(order => order.account_uuid))]
    .map(uuid => ({
      value: uuid || 'unknown',
      label: accountMap[uuid] || uuid || 'Unknown'
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const getDateRange = (rangeType, customStart = null, customEnd = null) => {
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
  };

  const filterOrders = (orders, clientFilter, statusFilter, dateRangeType, customStart, customEnd, slaFilter) => {
    return orders.filter(order => {
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
        if (slaFilter === 'true' && (!order.shippedAt || !checkSLAMet(order.shippedAt, order.allocated_at))) return false;
        if (slaFilter === 'false' && (!order.shippedAt || checkSLAMet(order.shippedAt, order.allocated_at))) return false;
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
  };

  // Filter the orders
  const filteredTodayOrders = filterOrders(
    ordersToShipToday,
    selectedClient,
    selectedStatus,
    dateRange,
    customStartDate,
    customEndDate,
    'all'
  );

  const filteredAllOrders = filterOrders(
    sortedOrders,
    allOrdersClient,
    allOrdersStatus,
    allOrdersDateRange,
    allOrdersCustomStartDate,
    allOrdersCustomEndDate,
    allOrdersSLAMet
  );

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
    showSLA = false
  }) => (
    <div className="p-4 border-b">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
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
        <div className="flex-1 min-w-[200px]">
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
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
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
          <div className="flex gap-4 flex-1 min-w-[400px]">
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
          <div className="flex-1 min-w-[200px]">
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

  const getHourlyShippingData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize data array with hours from 7 AM to 3 PM
    const hourlyData = Array.from({ length: 9 }, (_, index) => {
      const hour = index + 7;
      return {
        hour: `${hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}`,
        orders: 0,
        timestamp: new Date(today).setHours(hour, 0, 0, 0)
      };
    });

    // Count orders for each hour
    shippedToday.forEach(order => {
      try {
        const shippedTime = order.shippedAt.toDate ? order.shippedAt.toDate() : new Date(order.shippedAt);
        const hour = shippedTime.getHours();
        
        // Only count orders between 7 AM and 3 PM
        if (hour >= 7 && hour <= 15) {
          const index = hour - 7;
          if (hourlyData[index]) {
            hourlyData[index].orders++;
          }
        }
      } catch (error) {
        console.error('Error processing order:', error);
      }
    });

    return hourlyData;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 shadow-lg rounded-lg border border-gray-200">
          <p className="text-gray-600">{`Time: ${label}`}</p>
          <p className="text-blue-600 font-bold">{`Orders Shipped: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const parseShipHeroTimestamp = (timestamp) => {
    if (!timestamp) return null;
    // If it's a Firestore timestamp, use toDate()
    if (timestamp.toDate) return timestamp.toDate();
    
    // If it's a string in ShipHero format (YYYY-MM-DD HH:MM:SS)
    if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // Append EST timezone to the string
      return new Date(timestamp + ' GMT-0400');
    }
    
    // Fallback for any other format
    return new Date(timestamp);
  };

  const verifyOrderWithGraphQL = async (orderNumber) => {
    try {
      const response = await fetch('https://api.shiphero.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE'  // You'll need to replace this with your actual token
        },
        body: JSON.stringify({
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
                    }
                  }
                }
              }
            }
          `
        })
      });

      const data = await response.json();
      return data?.data?.orders?.data?.edges?.[0]?.node;
    } catch (error) {
      console.error(`Error verifying order ${orderNumber}:`, error);
      return null;
    }
  };

  const processOrders = async (ordersToProcess) => {
    setIsRefreshing(true);
    const updatedOrders = [...orders];

    for (const order of ordersToProcess) {
      const result = await verifyOrderWithGraphQL(order.order_number);
      
      if (result) {
        // Find the order in our local state
        const orderIndex = updatedOrders.findIndex(o => o.order_number === order.order_number);
        if (orderIndex === -1) continue;

        // Update based on fulfillment status
        if (result.fulfillment_status === 'fulfilled' || result.fulfillment_status === 'cancelled') {
          // Update the status in both tables
          updatedOrders[orderIndex] = {
            ...updatedOrders[orderIndex],
            status: result.fulfillment_status === 'fulfilled' ? 'shipped' : 'cancelled'
          };
        }

        // Update shipped at time if available
        if (result.shipments?.[0]?.created_date) {
          updatedOrders[orderIndex].shippedAt = result.shipments[0].created_date;
        }

        // Update Firestore
        const docRef = doc(db, 'orders', order.id);
        await updateDoc(docRef, {
          status: updatedOrders[orderIndex].status,
          shippedAt: updatedOrders[orderIndex].shippedAt
        });

        // Update local state after each order
        setOrders([...updatedOrders]);
      }

      // Wait 1 second before next query
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsRefreshing(false);
    setIsRefreshConfirming(false);
  };

  return (
    <div className="relative min-h-screen">
      {/* Hamburger Menu Button */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
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
        className={`fixed top-0 left-0 h-full w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
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
            <a 
              href="http://10.1.10.240:5173" 
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
            </a>
          </nav>
        </div>
      </div>

      <div className="w-full md:w-[90%] lg:w-[85%] mx-auto px-4 font-sans">
        <div className="relative pt-10">
          <div className="text-center">
            <h1 className="text-6xl font-extrabold tracking-tight text-slate-800 mb-2">SuperHero Board</h1>
            <p className="text-slate-500 text-lg font-medium mb-8 pt-2">
              Real-time order overview for when <i>ship</i> gets real
            </p>
          </div>
          <button
            onClick={() => {
              if (isRefreshing) return;
              
              if (!isRefreshConfirming) {
                setIsRefreshConfirming(true);
                // Only reset the confirmation state after 5 seconds
                const timer = setTimeout(() => {
                  setIsRefreshConfirming(false);
                  setIsRefreshing(false);
                }, 5000);
                return () => clearTimeout(timer); // Clean up timer if button is clicked again
                return;
              }
              
              // Get orders that need to be shipped today
              const ordersToVerify = orders.filter(order => 
                needsShippedToday(order.allocated_at) &&
                !['shipped', 'cancelled', 'cleared', 'deallocated'].includes(order.status) &&
                order.ready_to_ship === true
              );

              processOrders(ordersToVerify);
            }}
            disabled={isRefreshing}
            className={`absolute top-10 right-0 px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 shadow-sm min-w-[160px] justify-center ${
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
            {isRefreshing ? 'Refreshing...' : 
             isRefreshConfirming ? 'Are you sure?' : 
             'Refresh Orders'}
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-start gap-12 mt-10 pt-5">
          <div className="flex flex-col justify-start pt-2 flex-[1.6]">
            <div className="text-9xl font-extrabold text-slate-900 mb-2 text-left">{ordersToShipToday.length}</div>
            <div className="text-5xl text-slate-700 font-medium text-left mb-1">Needs shipped today</div>
            <div className="text-9xl font-extrabold text-slate-800 mb-2 text-left pt-10">
              {
                orders.filter(order =>
                  !needsShippedToday(order.allocated_at) &&
                  !['shipped', 'cancelled', 'cleared', 'deallocated'].includes(order.status) &&
                  order.ready_to_ship === true
                ).length
              }
            </div>
            <div className="text-5xl text-slate-600 font-medium text-left mb-1">Needs shipped tomorrow</div>
            <div className="text-9xl font-extrabold text-slate-700 mb-2 text-left pt-10">{shippedToday.length}</div>
            <div className="text-5xl text-slate-500 font-medium text-left mb-1">Shipped today</div>
          </div>

          <div className="flex-[1.4] w-full h-full">
            <div className="h-full">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">Top Clients by Open Orders</h2>
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

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="relative w-[300px]">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={pieData} 
                              dataKey="value" 
                              nameKey="name" 
                              outerRadius={150} 
                              innerRadius={75}
                              isAnimationActive={true}
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                return (
                                  <text
                                    x={x}
                                    y={y}
                                    fill="white"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="text-base font-bold"
                                  >
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
                    </div>
                    <div className="flex flex-col items-start gap-6 ml-8">
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: COLORS[1] }}></div>
                        <div className="text-3xl text-slate-800">
                          Unshipped Orders
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: COLORS[0] }}></div>
                        <div className="text-3xl text-slate-800">
                          Shipped Orders
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-40 mb-10">
          <div className="bg-gradient-to-r from-teal-600 to-teal-800 p-6">
            <h2 className="text-2xl font-bold text-white">Today's Shipping Activity</h2>
            <p className="text-teal-100 mt-1">Hourly breakdown of shipped orders</p>
          </div>
          <div className="p-6">
            <div className="w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getHourlyShippingData()}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 20,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="hour"
                    stroke="#6B7280"
                    tick={{ fill: '#374151' }}
                    tickLine={{ stroke: '#6B7280' }}
                  />
                  <YAxis
                    stroke="#6B7280"
                    tick={{ fill: '#374151' }}
                    tickLine={{ stroke: '#6B7280' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    name="Orders Shipped"
                    stroke="#0D9488"
                    strokeWidth={3}
                    dot={{ fill: '#0D9488', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
                onClick={exportToCSV}
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
            showSLA={false}
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginateData(filteredTodayOrders, todayPageSize, todayCurrentPage).map((order, idx) => (
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
                        {Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}
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
            total={filteredTodayOrders.length}
            pageSize={todayPageSize}
            currentPage={todayCurrentPage}
            setCurrentPage={setTodayCurrentPage}
            setPageSize={setTodayPageSize}
          />
        </div>

        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">All Orders</h2>
                <p className="text-purple-100 mt-1">Complete overview of your order history</p>
              </div>
              <button 
                onClick={exportToCSV}
                className="bg-white text-purple-700 hover:bg-purple-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Export to CSV</span>
              </button>
            </div>
          </div>
          <FilterSection
            clientValue={allOrdersClient}
            onClientChange={setAllOrdersClient}
            statusValue={allOrdersStatus}
            onStatusChange={setAllOrdersStatus}
            dateRangeValue={allOrdersDateRange}
            onDateRangeChange={setAllOrdersDateRange}
            customStart={allOrdersCustomStartDate}
            onCustomStartChange={setAllOrdersCustomStartDate}
            customEnd={allOrdersCustomEndDate}
            onCustomEndChange={setAllOrdersCustomEndDate}
            slaValue={allOrdersSLAMet}
            onSLAChange={setAllOrdersSLAMet}
            showSLA={true}
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
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line Items</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated At</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Ship Date</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shipped At</th>
                  <th className="group px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA Met</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginateData(filteredAllOrders, pageSize, currentPage).map((order, idx) => (
                  <tr 
                    key={order.id} 
                    className={`
                      ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      hover:bg-purple-50 transition-colors duration-150 ease-in-out
                    `}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">{order.order_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{accountMap[order.account_uuid] || order.account_uuid || 'Unknown'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        order.status === 'allocated' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'cleared' ? 'bg-gray-100 text-gray-800' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        {order.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {Array.isArray(order.line_items) ? `${order.line_items.length} item(s)` : '—'}
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
                          const reqDate = getRequiredShipDate(order.allocated_at);
                          if (!reqDate) return '—';
                          return new Intl.DateTimeFormat('en-US', {
                            timeZone: 'America/New_York',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          }).format(reqDate);
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        !order.shippedAt ? 'bg-gray-100 text-gray-600' :
                        checkSLAMet(order.shippedAt, order.allocated_at) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {!order.shippedAt ? 'TBD' : checkSLAMet(order.shippedAt, order.allocated_at) ? 'True' : 'False'}
                      </span>
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
            total={filteredAllOrders.length}
            pageSize={pageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setPageSize={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
