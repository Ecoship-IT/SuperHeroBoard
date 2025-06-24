import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './App';
import EFMProductSizes from './EFMProductSizes';

const AppWrapper = ({ isAuthenticated, isGuest, onLogout }) => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard isAuthenticated={isAuthenticated} isGuest={isGuest} onLogout={onLogout} />} />
      {/* Only show EFM Product Sizes to authenticated users */}
      {isAuthenticated && (
        <Route path="/efm-product-sizes" element={<EFMProductSizes isAuthenticated={isAuthenticated} isGuest={isGuest} onLogout={onLogout} />} />
      )}
    </Routes>
  );
};

export default AppWrapper; 