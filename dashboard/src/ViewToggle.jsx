import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link } from 'react-router-dom';

const ViewToggle = () => {
  const location = useLocation();
  const isMainView = location.pathname === '/';
  const isAltView = location.pathname === '/superhero-alt';
  const [mounted, setMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => {
      setMounted(false);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Don't render on mobile (768px and below) or if not on main/alt routes
  // Also don't render during initial load (when orders haven't been fetched yet)
  if (!mounted || (!isMainView && !isAltView) || windowWidth <= 768) {
    return null;
  }

  const toggleContent = (
    <div 
      style={{
        position: 'absolute',
        top: '16px',
        left: '80px',
        zIndex: 30,
        pointerEvents: 'auto',
        backgroundColor: '#e5e7eb',
        borderRadius: '9999px',
        padding: '6px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {/* Toggle removed - only one view now */}
    </div>
  );

  return createPortal(toggleContent, document.body);
};

export default ViewToggle; 