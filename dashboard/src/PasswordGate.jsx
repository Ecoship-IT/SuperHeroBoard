import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PasswordGate = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Your dashboard password - change this to whatever you want
  const DASHBOARD_PASSWORD = 'teamlead';

  useEffect(() => {
    // Check if already authenticated (stored in localStorage)
    const isAuth = localStorage.getItem('dashboard-authenticated') === 'true';
    const isGuestMode = localStorage.getItem('dashboard-guest') === 'true';
    if (isAuth) {
      setIsAuthenticated(true);
    } else if (isGuestMode) {
      setIsGuest(true);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password === DASHBOARD_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem('dashboard-authenticated', 'true');
      localStorage.removeItem('dashboard-guest');
      setError('');
      navigate('/'); // Always go to main page
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  };

  const handleGuestAccess = () => {
    setIsGuest(true);
    localStorage.setItem('dashboard-guest', 'true');
    localStorage.removeItem('dashboard-authenticated');
    navigate('/'); // Always go to main page
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGuest(false);
    setPassword(''); // Clear the password field
    setError(''); // Clear any error messages
    localStorage.removeItem('dashboard-authenticated');
    localStorage.removeItem('dashboard-guest');
  };

  if (isAuthenticated || isGuest) {
    return (
      <div>
        {React.cloneElement(children, { 
          isAuthenticated,
          isGuest,
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