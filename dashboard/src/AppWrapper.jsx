import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './App';
import EFMProductSizes from './EFMProductSizes';

const AppWrapper = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
      {/* Only show EFM Product Sizes to admin users */}
      {isAuthenticated && userRole === 'admin' && (
        <Route path="/efm-product-sizes" element={<EFMProductSizes isAuthenticated={isAuthenticated} isGuest={isGuest} userRole={userRole} onLogout={onLogout} />} />
      )}
    </Routes>
  );
};

export default AppWrapper; 