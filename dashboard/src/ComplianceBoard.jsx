import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const ComplianceBoard = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'b2b', 'special_labels', 'pending'

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

  // Subscribe to orders from Firebase
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  // Filter for special compliance orders
  const specialOrders = useMemo(() => {
    return orders.filter(order => {
      // Filter for orders that need special handling
      const hasSpecialInstructions = order.line_items?.some(item => 
        item.special_instructions || 
        item.requires_client_labels || 
        item.is_b2b ||
        item.special_handling
      );
      
      // Also check if order has overall special flags
      const orderHasSpecialHandling = order.is_b2b || 
        order.requires_special_labels || 
        order.special_instructions ||
        order.compliance_required;
      
      return hasSpecialInstructions || orderHasSpecialHandling;
    });
  }, [orders]);

  // Filter orders based on selected filter
  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'all') return specialOrders;
    
    return specialOrders.filter(order => {
      switch (selectedFilter) {
        case 'b2b':
          return order.is_b2b || order.line_items?.some(item => item.is_b2b);
        case 'special_labels':
          return order.requires_special_labels || order.line_items?.some(item => item.requires_client_labels);
        case 'pending':
          return !['shipped', 'canceled', 'completed'].includes(order.status);
        default:
          return true;
      }
    });
  }, [specialOrders, selectedFilter]);

  // Get counts for each category
  const counts = useMemo(() => {
    const b2bCount = specialOrders.filter(order => 
      order.is_b2b || order.line_items?.some(item => item.is_b2b)
    ).length;
    
    const specialLabelsCount = specialOrders.filter(order => 
      order.requires_special_labels || order.line_items?.some(item => item.requires_client_labels)
    ).length;
    
    const pendingCount = specialOrders.filter(order => 
      !['shipped', 'canceled', 'completed'].includes(order.status)
    ).length;

    return { b2b: b2bCount, specialLabels: specialLabelsCount, pending: pendingCount };
  }, [specialOrders]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'picked': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'allocated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpecialHandlingTags = (order) => {
    const tags = [];
    
    if (order.is_b2b || order.line_items?.some(item => item.is_b2b)) {
      tags.push({ label: 'B2B', color: 'bg-purple-100 text-purple-800' });
    }
    
    if (order.requires_special_labels || order.line_items?.some(item => item.requires_client_labels)) {
      tags.push({ label: 'Client Labels', color: 'bg-orange-100 text-orange-800' });
    }
    
    if (order.special_instructions || order.line_items?.some(item => item.special_instructions)) {
      tags.push({ label: 'Special Instructions', color: 'bg-red-100 text-red-800' });
    }
    
    return tags;
  };

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
            <Link 
              to="/compliance-board"
              className="block px-6 py-3 text-gray-700 bg-blue-50 border-blue-200 rounded-lg transition-all duration-200 text-lg font-semibold border shadow-sm"
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

      {/* Mobile Header Row - Only visible on mobile */}
      <div className="block md:hidden pt-4 pb-2">
        <div className="flex items-center justify-center">
          {/* Mobile Hamburger Button */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
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
        </div>
      </div>

      {/* Main Content - Compliance Board */}
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Special Orders Compliance Board
            </h1>
            <p className="text-lg text-gray-600">
              Track orders requiring special handling: B2B, client labels, and special instructions
            </p>
          </header>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Special Orders */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Total Special Orders</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{specialOrders.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* B2B Orders */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">B2B Orders</h3>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{counts.b2b}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Special Labels */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Client Labels</h3>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{counts.specialLabels}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Pending Action</h3>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{counts.pending}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'all' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Special Orders ({specialOrders.length})
              </button>
              <button
                onClick={() => setSelectedFilter('b2b')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'b2b' 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                B2B ({counts.b2b})
              </button>
              <button
                onClick={() => setSelectedFilter('special_labels')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'special_labels' 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Client Labels ({counts.specialLabels})
              </button>
              <button
                onClick={() => setSelectedFilter('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedFilter === 'pending' 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pending ({counts.pending})
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Special Orders ({filteredOrders.length})
              </h2>
            </div>
            
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-lg font-medium text-gray-900">No special orders found</h3>
                <p className="mt-1 text-gray-500">No orders requiring special handling match your current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Special Handling</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {order.order_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {accountMap[order.account_uuid] || order.account_uuid || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {getSpecialHandlingTags(order).map((tag, index) => (
                              <span key={index} className={`px-2 py-1 text-xs font-medium rounded-full ${tag.color}`}>
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(() => { 
                            try { 
                              if (!order.allocated_at) return '—'; 
                              const date = order.allocated_at.toDate ? order.allocated_at.toDate() : new Date(order.allocated_at);
                              return new Intl.DateTimeFormat('en-US', {
                                timeZone: 'America/New_York',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              }).format(date);
                            } catch { 
                              return '—'; 
                            } 
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button className="text-blue-600 hover:text-blue-900 font-medium">
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceBoard; 