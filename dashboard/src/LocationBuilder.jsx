import { useState } from 'react';
import { Link } from 'react-router-dom';

const LocationBuilder = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('');
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState({ current: 0, total: 0 });
  const [creationErrors, setCreationErrors] = useState([]);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [formData, setFormData] = useState({
    warehouse: '',
    customWarehouse: '',
    aisle: { start: '', end: '' },
    bay: { start: '', end: '', filter: 'all' },
    level: { start: '', end: '' },
    position: { start: '', end: '' },
    locationType: ''
  });

  const warehouseOptions = [
    { value: 'C', label: 'C' },
    { value: 'B', label: 'B' },
    { value: 'EFM', label: 'EFM' },
    { value: 'Custom', label: 'Custom' }
  ];

  const locationTypeMapping = {
    'Pallet': 'TG9jYXRpb25UeXBlOjYwODc2',
    'Single Deep': 'TG9jYXRpb25UeXBlOjYwODcx', 
    'Double Deep': 'TG9jYXRpb25UeXBlOjYwODcz',
    'Large Bin': 'TG9jYXRpb25UeXBlOjYwODIz',
    '9acr Reg bin': 'TG9jYXRpb25UeXBlOjYwODc1',
    '23acr Mini bin': 'TG9jYXRpb25UeXBlOjYwODcw'
  };

  /*
   * GraphQL Mutation Data Structure:
   * 
   * When "Create Locations" is clicked, the following data will be available:
   * 
   * {
   *   locations: ["C-10-01-A-01", "C-10-01-A-02", ...], // Array of all location strings
   *   locationTypeId: "actual_graphql_id_here",          // Mapped ID for GraphQL
   *   locationTypeName: "Pallet",                        // Human-readable name
   *   preview: {
   *     firstLocation: "C-10-01-A-01",
   *     lastLocation: "C-12-05-C-20", 
   *     hasFiltering: true,
   *     filterType: "odd"
   *   }
   * }
   */

  const locationTypeOptions = [
    { value: 'Pallet', label: 'Pallet' },
    { value: 'Single Deep', label: 'Single Deep' },
    { value: 'Double Deep', label: 'Double Deep' },
    { value: 'Large Bin', label: 'Large Bin' },
    { value: '9acr Reg bin', label: '9acr Reg bin' },
    { value: '23acr Mini bin', label: '23acr Mini bin' }
  ];

  const layoutOptions = [
    {
      id: 'full',
      name: 'Standard Location',
      structure: 'Warehouse - Aisle - Bay - Level - Position',
      description: 'Example: C-10-16-A-01',
      levels: ['Warehouse', 'Aisle', 'Bay', 'Level', 'Position']
    },
    {
      id: 'simple',
      name: 'Pallet Location', 
      structure: 'Warehouse - Aisle - Position',
      description: 'Example: B-10-48',
      levels: ['Warehouse', 'Aisle', 'Position']
    }
  ];

  const handleLayoutChange = (layoutId) => {
    setSelectedLayout(layoutId);
    // Reset form data when layout changes
    setFormData({
      warehouse: '',
      customWarehouse: '',
      aisle: { start: '', end: '' },
      bay: { start: '', end: '', filter: 'all' },
      level: { start: '', end: '' },
      position: { start: '', end: '' },
      locationType: ''
    });
  };

  const handleWarehouseChange = (value) => {
    setFormData(prev => ({
      ...prev,
      warehouse: value,
      customWarehouse: value === 'Custom' ? prev.customWarehouse : ''
    }));
  };

  const handleCustomWarehouseChange = (value) => {
    setFormData(prev => ({
      ...prev,
      customWarehouse: value
    }));
  };

  const handleRangeChange = (field, type, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [type]: value
      }
    }));
  };

  const handleBayFilterChange = (filter) => {
    setFormData(prev => ({
      ...prev,
      bay: {
        ...prev.bay,
        filter: filter
      }
    }));
  };

  const handleLocationTypeChange = (value) => {
    setFormData(prev => ({
      ...prev,
      locationType: value
    }));
  };

  const getCurrentLayout = () => {
    return layoutOptions.find(layout => layout.id === selectedLayout);
  };

  const getWarehouseValue = () => {
    return formData.warehouse === 'Custom' ? formData.customWarehouse : formData.warehouse;
  };

  const generateLocationPreview = () => {
    const layout = getCurrentLayout();
    if (!layout) return null;
    
    const warehouseVal = getWarehouseValue();
    if (!warehouseVal) return null;
    
    // Check if all required fields are filled
    const allFieldsFilled = layout.levels.slice(1).every(level => {
      const fieldName = level.toLowerCase();
      const range = formData[fieldName];
      return range && range.start && range.end;
    });
    
    if (!allFieldsFilled) return null;
    
    // Generate first location
    const firstParts = [warehouseVal];
    layout.levels.slice(1).forEach(level => {
      const fieldName = level.toLowerCase();
      const range = formData[fieldName];
      firstParts.push(range.start);
    });
    
    // Generate last location  
    const lastParts = [warehouseVal];
    layout.levels.slice(1).forEach(level => {
      const fieldName = level.toLowerCase();
      const range = formData[fieldName];
      lastParts.push(range.end);
    });
    
    const firstLocation = firstParts.join('-');
    const lastLocation = lastParts.join('-');
    
    // Check if bay filtering is applied
    const bayFilter = formData.bay?.filter;
    const hasFiltering = bayFilter && bayFilter !== 'all';
    
    return {
      firstLocation,
      lastLocation,
      hasFiltering,
      filterType: bayFilter,
      areSame: firstLocation === lastLocation
    };
  };

  const isFormValid = () => {
    const layout = getCurrentLayout();
    if (!layout) return false;
    
    const warehouseVal = getWarehouseValue();
    if (!warehouseVal) return false;
    
    // Check that location type is selected
    if (!formData.locationType) return false;
    
    // Check that all required range fields have both start and end values
    return layout.levels.slice(1).every(level => {
      const fieldName = level.toLowerCase();
      const range = formData[fieldName];
      return range && range.start && range.end;
    });
  };

  const generateAllLocations = () => {
    const layout = getCurrentLayout();
    if (!layout || !isFormValid()) return [];
    
    const warehouseVal = getWarehouseValue();
    const allLocations = [];
    
    // Generate value arrays for each level
    const levelValues = {};
    
    layout.levels.slice(1).forEach(level => {
      const fieldName = level.toLowerCase();
      const range = formData[fieldName];
      const values = [];
      
      if (fieldName === 'bay' && range.filter !== 'all') {
        // Handle bay filtering for odd/even
        const start = parseInt(range.start);
        const end = parseInt(range.end);
        
        for (let i = start; i <= end; i++) {
          if (range.filter === 'odd' && i % 2 === 1) {
            values.push(range.start.length > 1 && i < 10 ? `0${i}` : i.toString());
          } else if (range.filter === 'even' && i % 2 === 0) {
            values.push(range.start.length > 1 && i < 10 ? `0${i}` : i.toString());
          }
        }
      } else {
        // Handle normal ranges (including alphanumeric)
        const start = range.start;
        const end = range.end;
        
        // Check if it's numeric
        if (!isNaN(start) && !isNaN(end)) {
          const startNum = parseInt(start);
          const endNum = parseInt(end);
          for (let i = startNum; i <= endNum; i++) {
            values.push(start.length > 1 && i < 10 ? `0${i}` : i.toString());
          }
        } else if (start.length === 1 && end.length === 1 && start.match(/[A-Za-z]/) && end.match(/[A-Za-z]/)) {
          // Handle single letter ranges (A-Z)
          const startChar = start.toUpperCase().charCodeAt(0);
          const endChar = end.toUpperCase().charCodeAt(0);
          for (let i = startChar; i <= endChar; i++) {
            values.push(String.fromCharCode(i));
          }
        } else {
          // If start and end are the same or can't determine range, just use both
          values.push(start);
          if (start !== end) values.push(end);
        }
      }
      
      levelValues[fieldName] = values;
    });
    
    // Generate all combinations
    const generateCombinations = (levels, currentIndex, currentLocation) => {
      if (currentIndex >= levels.length) {
        allLocations.push([warehouseVal, ...currentLocation].join('-'));
        return;
      }
      
      const level = levels[currentIndex];
      const fieldName = level.toLowerCase();
      const values = levelValues[fieldName];
      
      for (const value of values) {
        generateCombinations(levels, currentIndex + 1, [...currentLocation, value]);
      }
    };
    
    generateCombinations(layout.levels.slice(1), 0, []);
    
    return allLocations.sort();
  };

  const createLocationViaCloudFunction = async (locationName, locationTypeId) => {
    try {
      const response = await fetch('https://us-central1-superheroboardv2.cloudfunctions.net/createLocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: locationName,
          pickable: true,
          sellable: true,
          location_type_id: locationTypeId,
          zone: "A",
          warehouse_id: "V2FyZWhvdXNlOjExNDkwNA=="
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { 
          success: false, 
          locationName, 
          error: data.error || `HTTP ${response.status}`,
          fullError: data.fullError || null
        };
      }
      
      return { 
        success: true, 
        locationName,
        requestId: data.request_id
      };
    } catch (error) {
      return { 
        success: false, 
        locationName, 
        error: error.message 
      };
    }
  };

  const createAllLocationsWithProgress = async () => {
    const allLocations = generateAllLocations();
    const locationTypeId = locationTypeMapping[formData.locationType];
    
    if (!allLocations.length || !locationTypeId) {
      alert('Error: No locations to create or location type ID not found.');
      return;
    }

    // Show warning about leaving/refreshing
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'If you refresh or leave, the process will end and potentially break';
      return 'If you refresh or leave, the process will end and potentially break';
    };

    setIsCreating(true);
    setShowCreationModal(true);
    setCreationProgress({ current: 0, total: allLocations.length });
    setCreationErrors([]);
    
    // Add refresh/leave warning
    window.addEventListener('beforeunload', handleBeforeUnload);

    try {
      for (let i = 0; i < allLocations.length; i++) {
        const locationName = allLocations[i];
        
        setCreationProgress({ current: i + 1, total: allLocations.length });
        
        const result = await createLocationViaCloudFunction(locationName, locationTypeId);
        
        if (!result.success) {
          setCreationErrors(prev => [...prev, result]);
        }
        
        // 1 second delay between requests (except for the last one)
        if (i < allLocations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Unexpected error during location creation:', error);
    } finally {
      setIsCreating(false);
      // Remove refresh/leave warning
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
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
          {isAuthenticated && (
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
          )}
        </div>
      </div>

      {/* Mobile Header Row - Only visible on mobile */}
      <div className="block md:hidden pt-4 pb-2">
        <div className="flex items-center justify-between px-4">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-4">
        {/* Header */}
        <div className="text-center mb-8 pt-4 md:pt-20">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-2">🏗️ Location Builder 🎯</h1>
          <p className="text-gray-600 text-lg">Build and manage warehouse locations</p>
        </div>

        {/* Main Content Area */}
        <div className="max-w-4xl mx-auto">
          {/* Layout Selection */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
              <h2 className="text-2xl font-bold text-white">Step 1: Choose Layout</h2>
            </div>
            
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {layoutOptions.map((layout) => (
                  <div key={layout.id} className="relative">
                    <input
                      type="radio"
                      id={layout.id}
                      name="layout"
                      value={layout.id}
                      checked={selectedLayout === layout.id}
                      onChange={(e) => handleLayoutChange(e.target.value)}
                      className="sr-only"
                    />
                    <label
                      htmlFor={layout.id}
                      className={`block p-6 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        selectedLayout === layout.id
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                          selectedLayout === layout.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedLayout === layout.id && (
                            <div className="w-full h-full rounded-full bg-white scale-50"></div>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">{layout.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{layout.description}</p>
                      <div className="text-sm font-mono bg-gray-100 p-3 rounded border">
                        {layout.structure}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Location Input Form */}
          {selectedLayout && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-green-600 to-green-800 p-6">
                <h2 className="text-2xl font-bold text-white">Step 2: Location Details</h2>
              </div>
              
              <div className="p-6">
                                <div className="space-y-8 mb-6">
                  {/* Warehouse Section */}
                  <div className="py-6 px-6 bg-blue-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Warehouse
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                      value={formData.warehouse}
                      onChange={(e) => handleWarehouseChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      required
                    >
                      <option value="">Select Warehouse</option>
                      {warehouseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    
                    {/* Custom warehouse input */}
                    {formData.warehouse === 'Custom' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.customWarehouse}
                          onChange={(e) => handleCustomWarehouseChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          placeholder="Enter custom warehouse name"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Range inputs for other levels */}
                  {getCurrentLayout()?.levels.slice(1).map((level, index) => (
                    <div key={level} className={`py-6 px-6 rounded-lg ${
                      index % 2 === 0 ? 'bg-green-50' : 'bg-blue-50'
                    }`}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {level} Range
                        <span className="text-red-500 ml-1">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={formData[level.toLowerCase()]?.start || ''}
                            onChange={(e) => handleRangeChange(level.toLowerCase(), 'start', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            placeholder={`Start ${level.toLowerCase()}`}
                            required
                          />
                          <span className="text-xs text-gray-500 mt-1 block">Start value</span>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={formData[level.toLowerCase()]?.end || ''}
                            onChange={(e) => handleRangeChange(level.toLowerCase(), 'end', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            placeholder={`End ${level.toLowerCase()}`}
                            required
                          />
                          <span className="text-xs text-gray-500 mt-1 block">End value</span>
                        </div>
                      </div>
                      
                      {/* Special filter options for Bay */}
                      {level.toLowerCase() === 'bay' && (
                        <div className="mt-4 pt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filter Options
                          </label>
                          <div className="flex space-x-4">
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="bayFilter"
                                value="all"
                                checked={formData.bay.filter === 'all'}
                                onChange={(e) => handleBayFilterChange(e.target.value)}
                                className="mr-2 text-blue-600"
                              />
                              <span className="text-sm text-gray-700">All</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="bayFilter"
                                value="odd"
                                checked={formData.bay.filter === 'odd'}
                                onChange={(e) => handleBayFilterChange(e.target.value)}
                                className="mr-2 text-blue-600"
                              />
                              <span className="text-sm text-gray-700">Odd</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="bayFilter"
                                value="even"
                                checked={formData.bay.filter === 'even'}
                                onChange={(e) => handleBayFilterChange(e.target.value)}
                                className="mr-2 text-blue-600"
                              />
                              <span className="text-sm text-gray-700">Even</span>
                            </label>
                          </div>
                          <span className="text-xs text-gray-500 mt-1 block">
                            {formData.bay.filter === 'odd' ? 'Only odd-numbered bays will be created' :
                             formData.bay.filter === 'even' ? 'Only even-numbered bays will be created' :
                             'All bays in the range will be created'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Location Type Section */}
                  <div className="py-6 px-6 bg-green-50 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location Type
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <select
                      value={formData.locationType}
                      onChange={(e) => handleLocationTypeChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      required
                    >
                      <option value="">Select Location Type</option>
                      {locationTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500 mt-1 block">
                      Choose the storage type for these locations
                    </span>
                  </div>
                </div>
                
                {/* Floating Preview will be rendered separately */}
                
                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!isFormValid() || isCreating}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                      isFormValid() && !isCreating
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    onClick={createAllLocationsWithProgress}
                  >
                    {isCreating ? 'Creating...' : 'Create Locations'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Location Preview */}
      {(() => {
        const preview = generateLocationPreview();
        if (!preview) return null;
        
        return (
          <div className="fixed top-20 right-4 w-80 bg-white shadow-xl rounded-xl border border-gray-200 z-40">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 rounded-t-xl">
              <h3 className="text-lg font-bold text-white">📍 Location Preview</h3>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">First Location</span>
                  <div className="text-lg font-mono text-green-600 bg-green-50 p-2 rounded border">
                    {preview.firstLocation}
                  </div>
                </div>
                
                {!preview.areSame && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">Last Location</span>
                    <div className="text-lg font-mono text-blue-600 bg-blue-50 p-2 rounded border">
                      {preview.lastLocation}
                    </div>
                  </div>
                )}
                
                {preview.hasFiltering && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-sm font-medium text-amber-800">
                        Bay Filter: {preview.filterType === 'odd' ? 'Odd Numbers Only' : 'Even Numbers Only'}
                      </span>
                    </div>
                  </div>
                )}
                
                {formData.locationType && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="text-sm font-medium text-slate-700">
                      Type: {formData.locationType}
                    </span>
                  </div>
                )}
                
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500 flex-1">
                      {preview.areSame ? 
                        'Single location will be created' : 
                        'Multiple locations will be created in this range'
                      }
                    </span>
                    <button
                      onClick={() => setShowAllLocations(true)}
                      className="px-3 py-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors duration-150 whitespace-nowrap flex-shrink-0"
                    >
                      See All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
                 );
       })()}

      {/* All Locations Modal */}
      {showAllLocations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">📋 All Locations</h3>
                  <p className="text-purple-200 mt-1">Complete list of locations that will be created</p>
                </div>
                <button
                  onClick={() => setShowAllLocations(false)}
                  className="p-2 rounded-lg hover:bg-purple-700 transition-colors duration-150"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              {(() => {
                const allLocations = generateAllLocations();
                
                return (
                  <>
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Total Locations:</span>
                          <span className="ml-2 text-lg font-bold text-purple-600">{allLocations.length}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Location Type:</span>
                          <span className="ml-2 text-gray-600">{formData.locationType}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Layout:</span>
                          <span className="ml-2 text-gray-600">{getCurrentLayout()?.name}</span>
                        </div>
                      </div>
                      
                      {formData.bay?.filter && formData.bay.filter !== 'all' && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                          <span className="text-sm text-amber-800">
                            ⚠️ Bay filter applied: {formData.bay.filter === 'odd' ? 'Odd numbers only' : 'Even numbers only'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                      <div className="p-4 space-y-1">
                        {allLocations.map((location, index) => (
                          <div
                            key={location}
                            className={`p-3 rounded border font-mono text-sm ${
                              index % 2 === 0 ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                            }`}
                          >
                            <span className="text-xs text-gray-500 mr-3">{index + 1}.</span>
                            {location}
                          </div>
                        ))}
                      </div>
                      
                      {allLocations.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          <p>No locations to display. Please check your form inputs.</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        onClick={() => setShowAllLocations(false)}
                        className="px-4 py-2 text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors duration-150"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => {
                          setShowAllLocations(false);
                          createAllLocationsWithProgress();
                        }}
                        disabled={isCreating}
                        className={`px-6 py-2 rounded-lg font-semibold transition-colors duration-150 ${
                          isCreating
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {isCreating ? 'Creating...' : 'Create All Locations'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Creation Progress Modal */}
      {showCreationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="bg-gradient-to-r from-green-600 to-green-800 p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">🔄 Creating Locations</h3>
                  <p className="text-green-200 mt-1">
                    {isCreating ? 'Creating locations...' : 'Creation complete!'}
                  </p>
                </div>
                {!isCreating && (
                  <button
                    onClick={() => setShowCreationModal(false)}
                    className="p-2 rounded-lg hover:bg-green-700 transition-colors duration-150"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm text-gray-600">
                    {creationProgress.current} of {creationProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${creationProgress.total > 0 ? (creationProgress.current / creationProgress.total) * 100 : 0}%`
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isCreating ? 'Creating locations with 1 second delay between each...' : 'All locations have been processed!'}
                </p>
              </div>

              {/* Warning Message */}
              {isCreating && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                       Do not refresh or leave this page. The process will be interrupted!
                    </span>
                  </div>
                </div>
              )}

              {/* Errors Section */}
              {creationErrors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-red-600 mb-2">❌ Errors ({creationErrors.length})</h4>
                  <div className="border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                    <div className="p-4 space-y-2">
                      {creationErrors.map((error, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                          <div className="font-mono text-sm text-red-800 font-medium mb-1">
                            {error.locationName}
                          </div>
                          <div className="text-sm text-red-600">
                            {error.error}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Success Summary */}
              {!isCreating && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-lg font-semibold text-green-800 mb-2">✅ Creation Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-green-700">Total Processed:</span>
                      <span className="ml-2 text-green-600">{creationProgress.total}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">Successful:</span>
                      <span className="ml-2 text-green-600">{creationProgress.total - creationErrors.length}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">Errors:</span>
                      <span className="ml-2 text-red-600">{creationErrors.length}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-700">Success Rate:</span>
                      <span className="ml-2 text-green-600">
                        {creationProgress.total > 0 ? Math.round(((creationProgress.total - creationErrors.length) / creationProgress.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Close Button */}
              {!isCreating && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowCreationModal(false)}
                    className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-semibold transition-colors duration-150"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationBuilder; 