import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin', 'limited', 'guest'
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Load passwords from environment variables
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'teamlead';
  const LIMITED_PASSWORD = import.meta.env.VITE_LIMITED_PASSWORD || 'testaccount';

  useEffect(() => {
    // Check if already authenticated (stored in localStorage)
    const isAuth = localStorage.getItem('dashboard-authenticated') === 'true';
    const isGuestMode = localStorage.getItem('dashboard-guest') === 'true';
    const storedRole = localStorage.getItem('user-role');
    
    if (isAuth && storedRole) {
      setIsAuthenticated(true);
      setUserRole(storedRole);
    } else if (isGuestMode) {
      setIsGuest(true);
      setUserRole('guest');
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setUserRole('admin');
      localStorage.setItem('dashboard-authenticated', 'true');
      localStorage.setItem('user-role', 'admin');
      localStorage.removeItem('dashboard-guest');
      setError('');
      navigate('/');
    } else if (password === LIMITED_PASSWORD) {
      setIsAuthenticated(true);
      setUserRole('limited');
      localStorage.setItem('dashboard-authenticated', 'true');
      localStorage.setItem('user-role', 'limited');
      localStorage.removeItem('dashboard-guest');
      setError('');
      navigate('/');
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleGuestAccess = () => {
    setIsGuest(true);
    setUserRole('guest');
    localStorage.setItem('dashboard-guest', 'true');
    localStorage.setItem('user-role', 'guest');
    localStorage.removeItem('dashboard-authenticated');
    navigate('/');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGuest(false);
    setUserRole(null);
    setPassword('');
    setError('');
    localStorage.removeItem('dashboard-authenticated');
    localStorage.removeItem('dashboard-guest');
    localStorage.removeItem('user-role');
  };

  if (isAuthenticated || isGuest) {
    return (
      <div>
        {React.cloneElement(children, { 
          isAuthenticated,
          isGuest,
          userRole,
          onLogout: handleLogout 
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <img 
            src="/ES hollow - trans.png" 
            alt="Logo" 
            className="w-32 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">SuperHero Board</h1>
          <p className="text-gray-600 mt-2">Enter password to access dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-150 font-medium"
          >
            Access Dashboard
          </button>
        </form>
        
        <div className="text-center mt-4">
          <span className="text-gray-500 text-sm">or</span>
        </div>
        
        <button
          onClick={handleGuestAccess}
          className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors duration-150 font-medium mt-4"
        >
          Continue as Guest
        </button>
        
        <div className="text-center mt-6 text-sm text-gray-500">
          Protected internal tool
        </div>
      </div>
    </div>
  );
};

export default PasswordGate; 