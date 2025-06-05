import { useState } from 'react';
import { Link } from 'react-router-dom';

function EFMProductSizes() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sample product size data - you can replace this with actual data
  const productSizes = [
    {
      id: 1,
      sku: 'RCE-CBM-050',
      name: 'Creatine Monohydrate',
      category: 'Powders',
      size: '5 lbs',
      dimensions: '6" x 6" x 8"',
      weight: '5.2 lbs',
      shelfLife: '24 months'
    },
    {
      id: 2,
      sku: 'RCE-FMO-050',
      name: 'Fermented BCAA',
      category: 'Powders',
      size: '2.2 lbs',
      dimensions: '5" x 5" x 7"',
      weight: '2.5 lbs',
      shelfLife: '18 months'
    },
    {
      id: 3,
      sku: 'RCE-SER-030',
      name: 'Serrapeptase',
      category: 'Capsules',
      size: '120 count',
      dimensions: '3" x 3" x 4"',
      weight: '0.3 lbs',
      shelfLife: '36 months'
    },
    {
      id: 4,
      sku: 'EFM-PRO-001',
      name: 'Plant Protein Vanilla',
      category: 'Powders',
      size: '2 lbs',
      dimensions: '5.5" x 5.5" x 9"',
      weight: '2.3 lbs',
      shelfLife: '24 months'
    },
    {
      id: 5,
      sku: 'EFM-PRO-002',
      name: 'Plant Protein Chocolate',
      category: 'Powders',
      size: '2 lbs',
      dimensions: '5.5" x 5.5" x 9"',
      weight: '2.3 lbs',
      shelfLife: '24 months'
    },
    {
      id: 6,
      sku: 'EFM-VIT-001',
      name: 'Daily Multivitamin',
      category: 'Capsules',
      size: '60 count',
      dimensions: '2.5" x 2.5" x 4"',
      weight: '0.2 lbs',
      shelfLife: '24 months'
    }
  ];

  const categories = ['all', ...new Set(productSizes.map(product => product.category))];

  const filteredProducts = productSizes.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full md:w-[90%] lg:w-[85%] mx-auto px-4 font-sans">
        <div className="relative pt-10">
          <div className="text-center">
            <h1 className="text-6xl font-extrabold tracking-tight text-slate-800 mb-2">EFM Product Sizes</h1>
            <p className="text-slate-500 text-lg font-medium mb-8 pt-2">
              Comprehensive product dimensions and specifications
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
          <div className="bg-gradient-to-r from-green-600 to-green-800 p-6">
            <h2 className="text-2xl font-bold text-white">Product Filters</h2>
            <p className="text-green-100 mt-1">Search and filter products by category</p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by product name or SKU..."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-500">
                {filteredProducts.length} products found
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white shadow-xl rounded-xl border-0 overflow-hidden mt-10 mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
            <h2 className="text-2xl font-bold text-white">Product Catalog</h2>
            <p className="text-blue-100 mt-1">Detailed product specifications and dimensions</p>
          </div>
          <div className="p-6">
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {product.category}
                        </span>
                        <span className="text-sm font-mono text-gray-500">{product.sku}</span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">{product.name}</h3>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Size:</span>
                          <span className="text-sm font-medium text-gray-900">{product.size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Dimensions:</span>
                          <span className="text-sm font-medium text-gray-900">{product.dimensions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Weight:</span>
                          <span className="text-sm font-medium text-gray-900">{product.weight}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Shelf Life:</span>
                          <span className="text-sm font-medium text-gray-900">{product.shelfLife}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H9a1 1 0 00-1 1v1M4 13h2m13-8V4a1 1 0 00-1-1H9a1 1 0 00-1 1v1" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EFMProductSizes; 