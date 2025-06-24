import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, addDoc } from 'firebase/firestore';

function EFMProductSizes({ isAuthenticated, isGuest, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ sku: '', value: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('sku');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Box sizes state
  const [boxSizes, setBoxSizes] = useState([]);
  const [isAddingBoxSize, setIsAddingBoxSize] = useState(false);
  const [editingBoxSize, setEditingBoxSize] = useState(null);
  const [newBoxSize, setNewBoxSize] = useState({ boxSize: '', maxProductSize: '' });
  const [boxSearchTerm, setBoxSearchTerm] = useState('');
  const [boxSortBy, setBoxSortBy] = useState('boxSize');
  const [boxSortDirection, setBoxSortDirection] = useState('asc');
  const [boxCurrentPage, setBoxCurrentPage] = useState(1);
  const [boxPageSize, setBoxPageSize] = useState(25);

  // Box calculation testing state
  const [testOrder, setTestOrder] = useState(`{
  "webhook_type": "Order Allocated",
  "allocation_reference": 362137624,
  "account_id": 6334,
  "account_uuid": "QWNjb3VudDo2MzM0",
  "warehouse_id": 11790,
  "warehouse_uuid": "V2FyZWhvdXNlOjExNzkw",
  "allocated_at": "2021-07-24T02:03:01",
  "order_number": "MO351",
  "order_id": 204159062,
  "order_uuid": "T3JkZXI6MjA0MTU5MDYy",
  "partner_order_id": "MO351",
  "line_items": [
    {
      "id": 550365415,
      "item_uuid": "TGluZUl0ZW06NTUwMzY1NDE1",
      "partner_line_item_id": "MO351-301706334",
      "quantity": 2,
      "sku": "EFM-MCVC",
      "is_kit_component": false,
      "created_at": "2021-07-24T02:03:01"
    },
    {
      "id": 550365416,
      "item_uuid": "TGluZUl0ZW06NTUwMzY1NDE2",
      "partner_line_item_id": "MO351-301706335",
      "quantity": 2,
      "sku": "PP-BAN",
      "is_kit_component": false,
      "created_at": "2021-07-24T02:03:01"
    }
  ],
  "ready_to_ship": 1
}`);
  const [calculationResult, setCalculationResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Load products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'efm_products'), orderBy('sku', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setProducts(data);
    });
    return () => unsubscribe();
  }, []);

  // Load box sizes from Firestore
  useEffect(() => {
    const q = query(collection(db, 'box_sizes'), orderBy('boxSize', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setBoxSizes(data);
    });
    return () => unsubscribe();
  }, []);

  // Add new product
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.value) return;

    try {
      await addDoc(collection(db, 'efm_products'), {
        sku: newProduct.sku.trim(),
        value: parseFloat(newProduct.value) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewProduct({ sku: '', value: '' });
      setIsAddingProduct(false);
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product: ' + error.message);
    }
  };

  // Update product
  const handleUpdateProduct = async (productId, updatedData) => {
    try {
      const productRef = doc(db, 'efm_products', productId);
      await updateDoc(productRef, {
        ...updatedData,
        value: parseFloat(updatedData.value) || 0,
        updatedAt: serverTimestamp()
      });
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Error updating product: ' + error.message);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await deleteDoc(doc(db, 'efm_products', productId));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product: ' + error.message);
    }
  };

  // Filter and sort products
  const filteredAndSortedProducts = products
    .filter(product => 
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.value?.toString().includes(searchTerm)
    )
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'value') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Pagination component
  const Pagination = ({ total, pageSize, currentPage, setCurrentPage, setPageSize }) => {
    const totalPages = Math.ceil(total / pageSize);
    const pageSizeOptions = [25, 50, 100, 250];
    
    const getPageNumbers = () => {
      const pageNumbers = [];
      const maxVisible = 10;
      const halfVisible = Math.floor(maxVisible / 2);

      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);

      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

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
                className={`px-3 py-1 rounded border ${currentPage === page ? 'bg-green-500 text-white' : ''}`}
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

  // Paginate data
  const paginateData = (data, pageSize, currentPage) => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  };

  // Box size management functions
  const handleAddBoxSize = async (e) => {
    e.preventDefault();
    if (!newBoxSize.boxSize || !newBoxSize.maxProductSize) return;

    try {
      await addDoc(collection(db, 'box_sizes'), {
        boxSize: newBoxSize.boxSize.trim(),
        maxProductSize: parseFloat(newBoxSize.maxProductSize) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewBoxSize({ boxSize: '', maxProductSize: '' });
      setIsAddingBoxSize(false);
    } catch (error) {
      console.error('Error adding box size:', error);
      alert('Error adding box size: ' + error.message);
    }
  };

  const handleUpdateBoxSize = async (boxSizeId, updatedData) => {
    try {
      const boxSizeRef = doc(db, 'box_sizes', boxSizeId);
      await updateDoc(boxSizeRef, {
        ...updatedData,
        maxProductSize: parseFloat(updatedData.maxProductSize) || 0,
        updatedAt: serverTimestamp()
      });
      setEditingBoxSize(null);
    } catch (error) {
      console.error('Error updating box size:', error);
      alert('Error updating box size: ' + error.message);
    }
  };

  const handleDeleteBoxSize = async (boxSizeId) => {
    if (!confirm('Are you sure you want to delete this box size?')) return;
    
    try {
      await deleteDoc(doc(db, 'box_sizes', boxSizeId));
    } catch (error) {
      console.error('Error deleting box size:', error);
      alert('Error deleting box size: ' + error.message);
    }
  };

  // Filter and sort box sizes
  const filteredAndSortedBoxSizes = boxSizes
    .filter(boxSize => 
      boxSize.boxSize?.toLowerCase().includes(boxSearchTerm.toLowerCase()) ||
      boxSize.maxProductSize?.toString().includes(boxSearchTerm)
    )
    .sort((a, b) => {
      let aValue = a[boxSortBy];
      let bValue = b[boxSortBy];
      
      if (boxSortBy === 'maxProductSize') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }
      
      if (boxSortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleBoxSort = (field) => {
    if (boxSortBy === field) {
      setBoxSortDirection(boxSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setBoxSortBy(field);
      setBoxSortDirection('asc');
    }
    setBoxCurrentPage(1);
  };

  // Box Pagination component with blue theme
  const BoxPagination = ({ total, pageSize, currentPage, setCurrentPage, setPageSize }) => {
    const totalPages = Math.ceil(total / pageSize);
    const pageSizeOptions = [25, 50, 100, 250];
    
    const getPageNumbers = () => {
      const pageNumbers = [];
      const maxVisible = 10;
      const halfVisible = Math.floor(maxVisible / 2);

      let startPage = Math.max(1, currentPage - halfVisible);
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);

      if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
      }

      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) pageNumbers.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

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

  // Box size calculation logic
  const calculateBoxSize = async (orderData) => {
    setIsCalculating(true);
    setCalculationResult(null);

    try {
      // Parse the order JSON if it's a string
      const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;
      
      // Validation checks
      const validationErrors = [];
      
      // Check if order_number contains "Retain"
      if (order.order_number && order.order_number.toLowerCase().includes('retain')) {
        validationErrors.push('Order number contains "Retain" - skipping processing');
      }
      
      // Check if line_items exists and is not empty
      if (!order.line_items || !Array.isArray(order.line_items) || order.line_items.length === 0) {
        validationErrors.push('No line items found in order');
      }

      if (validationErrors.length > 0) {
        setCalculationResult({
          success: false,
          errors: validationErrors,
          order: order
        });
        setIsCalculating(false);
        return;
      }

      // Calculate total size
      let totalSize = 0;
      const lineItemDetails = [];
      const skuErrors = [];

      for (const lineItem of order.line_items) {
        const sku = lineItem.sku;
        const quantity = lineItem.quantity || 1;
        
        // Find the product in our EFM products
        const product = products.find(p => p.sku === sku);
        
        if (!product) {
          skuErrors.push(`SKU "${sku}" not found in EFM products table`);
          continue;
        }

        const itemSize = parseFloat(product.value) || 0;
        const itemTotalSize = itemSize * quantity;
        totalSize += itemTotalSize;

        lineItemDetails.push({
          sku: sku,
          quantity: quantity,
          unitSize: itemSize,
          totalSize: itemTotalSize
        });
      }

      // Find appropriate box size
      let selectedBox = null;
      let boxSelectionError = null;

      if (boxSizes.length === 0) {
        boxSelectionError = 'No box sizes available in database';
      } else {
        // Sort boxes by maxProductSize ascending to find the smallest box that fits
        const sortedBoxes = [...boxSizes].sort((a, b) => 
          parseFloat(a.maxProductSize) - parseFloat(b.maxProductSize)
        );
        
        // Find the first (smallest) box that can fit the total size
        selectedBox = sortedBoxes.find(box => 
          parseFloat(box.maxProductSize) >= totalSize
        );

        if (!selectedBox) {
          // If no box is big enough, use the largest box available
          selectedBox = sortedBoxes[sortedBoxes.length - 1];
        }
      }

      const result = {
        success: skuErrors.length === 0,
        order: order,
        totalSize: totalSize,
        lineItemDetails: lineItemDetails,
        selectedBox: selectedBox,
        skuErrors: skuErrors,
        timestamp: new Date().toISOString()
      };

      setCalculationResult(result);

    } catch (error) {
      setCalculationResult({
        success: false,
        errors: [`JSON parsing error: ${error.message}`],
        order: null
      });
    }

    setIsCalculating(false);
  };

  // Handle test order submission
  const handleTestOrder = () => {
    if (!testOrder.trim()) {
      alert('Please enter order JSON data');
      return;
    }
    calculateBoxSize(testOrder);
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
            <Link 
              to="/efm-product-sizes" 
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
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                <span>EFM Product Sizes</span>
              </div>
            </Link>
            <a 
              href="#" 
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
            </a>
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
        <div className="relative pt-10">
          <div className="text-center mb-8">
            <h1 className="text-6xl font-extrabold tracking-tight text-slate-800 mb-2">EFM Product Sizes</h1>
            <p className="text-slate-500 text-lg font-medium pt-2">
              Manage product SKUs and values
            </p>
          </div>

          {/* Controls */}
          <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mb-10">
            <div className="bg-gradient-to-r from-green-600 to-green-800 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Product Management</h2>
                  <p className="text-green-100 mt-1">{products.length} products total</p>
                </div>
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="bg-white text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b">
                              <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); // Reset to first page when searching
                      }}
                      placeholder="Search by SKU or value..."
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                <div className="text-sm text-gray-500 py-2">
                  Showing {filteredAndSortedProducts.length} of {products.length} products
                </div>
              </div>
            </div>

            {/* Add Product Form */}
            {isAddingProduct && (
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">Add New Product</h3>
                <form onSubmit={handleAddProduct} className="flex gap-4">
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="SKU"
                    className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.value}
                    onChange={(e) => setNewProduct({ ...newProduct, value: e.target.value })}
                    placeholder="Value"
                    className="w-32 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingProduct(false);
                      setNewProduct({ sku: '', value: '' });
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-base divide-y divide-gray-200 max-w-4xl mx-auto">
                <thead className="bg-gray-50">
                  <tr>
                                          <th 
                        className="group px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('sku')}
                      >
                        <span className="flex items-center space-x-2">
                          <span>SKU</span>
                        <svg className={`w-4 h-4 ${sortBy === 'sku' ? 'text-gray-700' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d={sortBy === 'sku' && sortDirection === 'desc' 
                            ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          } clipRule="evenodd" />
                        </svg>
                      </span>
                    </th>
                                          <th 
                        className="group px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('value')}
                      >
                        <span className="flex items-center space-x-2">
                          <span>Value</span>
                        <svg className={`w-4 h-4 ${sortBy === 'value' ? 'text-gray-700' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d={sortBy === 'value' && sortDirection === 'desc' 
                            ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          } clipRule="evenodd" />
                        </svg>
                      </span>
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginateData(filteredAndSortedProducts, pageSize, currentPage).map((product, idx) => (
                    <tr 
                      key={product.id} 
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors duration-150 ease-in-out`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {editingProduct === product.id ? (
                          <input
                            type="text"
                            defaultValue={product.sku}
                            onBlur={(e) => handleUpdateProduct(product.id, { sku: e.target.value, value: product.value })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateProduct(product.id, { sku: e.target.value, value: product.value });
                              }
                            }}
                            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                            autoFocus
                          />
                        ) : (
                          <span className="text-base font-medium text-green-600">{product.sku}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {editingProduct === product.id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.value}
                            onBlur={(e) => handleUpdateProduct(product.id, { sku: product.sku, value: e.target.value })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateProduct(product.id, { sku: product.sku, value: e.target.value });
                              }
                            }}
                            className="border rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-green-500 text-base"
                          />
                        ) : (
                          <span className="text-base text-gray-900">{parseFloat(product.value).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingProduct(editingProduct === product.id ? null : product.id)}
                            className={`px-3 py-1 text-sm font-medium rounded border transition-colors duration-150 ${
                              editingProduct === product.id 
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {editingProduct === product.id ? 'Done' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="px-3 py-1 text-sm font-medium rounded border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors duration-150"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginateData(filteredAndSortedProducts, pageSize, currentPage).length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        {searchTerm ? 'No products found matching your search.' : 'No products yet. Add one above!'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              total={filteredAndSortedProducts.length}
              pageSize={pageSize}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              setPageSize={setPageSize}
            />
          </div>

          {/* Box Sizes Section */}
          <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mb-10">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Box Size Management</h2>
                  <p className="text-blue-100 mt-1">{boxSizes.length} box sizes total</p>
                </div>
                <button
                  onClick={() => setIsAddingBoxSize(true)}
                  className="bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Box Size</span>
                </button>
              </div>
            </div>

            {/* Box Search */}
            <div className="p-4 border-b">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={boxSearchTerm}
                    onChange={(e) => {
                      setBoxSearchTerm(e.target.value);
                      setBoxCurrentPage(1);
                    }}
                    placeholder="Search by box size or max product size..."
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="text-sm text-gray-500 py-2">
                  Showing {filteredAndSortedBoxSizes.length} of {boxSizes.length} box sizes
                </div>
              </div>
            </div>

            {/* Add Box Size Form */}
            {isAddingBoxSize && (
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold mb-4">Add New Box Size</h3>
                <form onSubmit={handleAddBoxSize} className="flex gap-4">
                  <input
                    type="text"
                    value={newBoxSize.boxSize}
                    onChange={(e) => setNewBoxSize({ ...newBoxSize, boxSize: e.target.value })}
                    placeholder="Box Size (e.g., Small, Medium, Large)"
                    className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={newBoxSize.maxProductSize}
                    onChange={(e) => setNewBoxSize({ ...newBoxSize, maxProductSize: e.target.value })}
                    placeholder="Max Product Size"
                    className="w-40 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingBoxSize(false);
                      setNewBoxSize({ boxSize: '', maxProductSize: '' });
                    }}
                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}

            {/* Box Sizes Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-base divide-y divide-gray-200 max-w-4xl mx-auto">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="group px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleBoxSort('boxSize')}
                    >
                      <span className="flex items-center space-x-2">
                        <span>Box Size</span>
                        <svg className={`w-4 h-4 ${boxSortBy === 'boxSize' ? 'text-gray-700' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d={boxSortBy === 'boxSize' && boxSortDirection === 'desc' 
                            ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          } clipRule="evenodd" />
                        </svg>
                      </span>
                    </th>
                    <th 
                      className="group px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleBoxSort('maxProductSize')}
                    >
                      <span className="flex items-center space-x-2">
                        <span>Max Product Size</span>
                        <svg className={`w-4 h-4 ${boxSortBy === 'maxProductSize' ? 'text-gray-700' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d={boxSortBy === 'maxProductSize' && boxSortDirection === 'desc' 
                            ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          } clipRule="evenodd" />
                        </svg>
                      </span>
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginateData(filteredAndSortedBoxSizes, boxPageSize, boxCurrentPage).map((boxSize, idx) => (
                    <tr 
                      key={boxSize.id} 
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150 ease-in-out`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {editingBoxSize === boxSize.id ? (
                          <input
                            type="text"
                            defaultValue={boxSize.boxSize}
                            onBlur={(e) => handleUpdateBoxSize(boxSize.id, { boxSize: e.target.value, maxProductSize: boxSize.maxProductSize })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateBoxSize(boxSize.id, { boxSize: e.target.value, maxProductSize: boxSize.maxProductSize });
                              }
                            }}
                            className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                            autoFocus
                          />
                        ) : (
                          <span className="text-base font-medium text-blue-600">{boxSize.boxSize}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {editingBoxSize === boxSize.id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={boxSize.maxProductSize}
                            onBlur={(e) => handleUpdateBoxSize(boxSize.id, { boxSize: boxSize.boxSize, maxProductSize: e.target.value })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateBoxSize(boxSize.id, { boxSize: boxSize.boxSize, maxProductSize: e.target.value });
                              }
                            }}
                            className="border rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                          />
                        ) : (
                          <span className="text-base text-gray-900">{parseFloat(boxSize.maxProductSize).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingBoxSize(editingBoxSize === boxSize.id ? null : boxSize.id)}
                            className={`px-3 py-1 text-sm font-medium rounded border transition-colors duration-150 ${
                              editingBoxSize === boxSize.id 
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {editingBoxSize === boxSize.id ? 'Done' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDeleteBoxSize(boxSize.id)}
                            className="px-3 py-1 text-sm font-medium rounded border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors duration-150"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginateData(filteredAndSortedBoxSizes, boxPageSize, boxCurrentPage).length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        {boxSearchTerm ? 'No box sizes found matching your search.' : 'No box sizes yet. Add one above!'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <BoxPagination
              total={filteredAndSortedBoxSizes.length}
              pageSize={boxPageSize}
              currentPage={boxCurrentPage}
              setCurrentPage={setBoxCurrentPage}
              setPageSize={setBoxPageSize}
            />
          </div>

          {/* Box Size Calculation Testing Section */}
          <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mb-10">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Box Size Calculation Testing</h2>
                  <p className="text-purple-100 mt-1">Test order processing logic before webhook implementation</p>
                </div>
              </div>
            </div>

            {/* Test Order Input */}
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Test Order JSON</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste Order JSON (ShipHero Order Allocated format):
                  </label>
                  <textarea
                    value={testOrder}
                    onChange={(e) => setTestOrder(e.target.value)}
                    placeholder={`{
  "webhook_type": "Order Allocated",
  "order_number": "MO351",
  "line_items": [
    {
      "sku": "EFM-MCVC-FBA",
      "quantity": 2
    }
  ],
  "ready_to_ship": 1
}`}
                    className="w-full h-40 border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleTestOrder}
                    disabled={isCalculating}
                    className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {isCalculating ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Calculating...
                      </>
                    ) : (
                      'Calculate Box Size'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTestOrder('');
                      setCalculationResult(null);
                    }}
                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Calculation Results */}
            {calculationResult && (
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Calculation Results</h3>
                
                {/* Success/Error Status */}
                <div className={`p-4 rounded-lg mb-6 ${
                  calculationResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {calculationResult.success ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`font-semibold ${
                      calculationResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {calculationResult.success ? 'Calculation Successful' : 'Calculation Failed'}
                    </span>
                  </div>
                </div>

                {/* Errors */}
                {(calculationResult.errors || calculationResult.skuErrors) && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-red-800 mb-2">Issues Found:</h4>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      {calculationResult.errors?.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {calculationResult.skuErrors?.map((error, idx) => (
                        <li key={`sku-${idx}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Order Details */}
                {calculationResult.order && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Order Information</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Order Number:</span> {calculationResult.order.order_number}</p>
                        <p><span className="font-medium">Webhook Type:</span> {calculationResult.order.webhook_type}</p>
                        <p><span className="font-medium">Ready to Ship:</span> {calculationResult.order.ready_to_ship ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Calculation Summary</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Total Size:</span> {calculationResult.totalSize?.toFixed(2) || 'N/A'}</p>
                        <p><span className="font-medium">Selected Box:</span> {calculationResult.selectedBox?.boxSize || 'None'}</p>
                        <p><span className="font-medium">Box Capacity:</span> {calculationResult.selectedBox?.maxProductSize || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Line Item Details */}
                {calculationResult.lineItemDetails && calculationResult.lineItemDetails.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-3">Line Item Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">SKU</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Quantity</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Unit Size</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-700 border-b">Total Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculationResult.lineItemDetails.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 border-b">{item.sku}</td>
                              <td className="px-4 py-2 border-b">{item.quantity}</td>
                              <td className="px-4 py-2 border-b">{item.unitSize.toFixed(2)}</td>
                              <td className="px-4 py-2 border-b font-medium">{item.totalSize.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-purple-50 font-semibold">
                            <td className="px-4 py-2 border-b" colSpan="3">Total Order Size:</td>
                            <td className="px-4 py-2 border-b">{calculationResult.totalSize?.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw Result JSON (for debugging) */}
                <details className="mt-6">
                  <summary className="font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                    Raw Calculation Result (Debug)
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(calculationResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EFMProductSizes; 