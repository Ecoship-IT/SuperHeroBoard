import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import Home from './Home';
import EFMProductSizes from './EFMProductSizes';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/efm-product-sizes" element={<EFMProductSizes />} />
      </Routes>
    </div>
  );
}

export default App;
