import { useState } from 'react';
import { Link } from 'react-router-dom';

const LevelUpLog = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) {
      setSubmitMessage('❌ Please enter a number');
      setTimeout(() => setSubmitMessage(''), 3000);
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('Submitting pin:', inputValue);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Switch case to redirect to different Google Sheets based on pin
      let redirectUrl;
      
      switch (inputValue.trim()) {
        case '3681':
          // Tara Bare
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1bERTzdY0z1mnaTUMgtLbphAoNx2j_3BEO3SQshGbGsA/edit?gid=337733353#gid=337733353';
          break;
          
        case '3066':
          // Sammy Scott
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1e0ItpLktbUyO53exmjLu87HS6b5NJvbtT3Jje09ODCY/edit?gid=337733353#gid=337733353';
          break;

        case '1829':
          // Sophia Lavigna
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1jzRWHq-9kImAwsEu3PN6WLIH4abCtQVOESny_gaeSS8/edit?gid=337733353#gid=337733353';
          break;

        case '8910':
          // Sky Thrower
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1VswCJLFsnz-MpkVxXcCwRfjMOPra13gaj9AybI899PE/edit?gid=337733353#gid=337733353';
          break;

        case '7093':
          // Steffany McMullen
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1mDEW1OVm4p3nADcKMj8BcDemYoB46AR9xxrIaaxTF_U/edit?gid=337733353#gid=337733353';
          break;

        case '3736':
          // Patrica Beissel
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1L5tg2GLV7-THquK8eDyFQRHIHDmjRLUEs4cF0rXXUPM/edit?gid=337733353#gid=337733353';
          break;

        case '8178':
          // Pricilla Collazo
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1R3oKaaPn1WSEy2JOFLw9poUOh3gLkIOetyk1LN9p3D4/edit?gid=337733353#gid=337733353';
          break;
          
        case '7267':
          // Octavia Miller
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1l5VxNMnpk8zuKE4KN4eB8QWcI6eGx8t7wV-PCQqf2no/edit?gid=337733353#gid=337733353';
          break;

        case '2693':
          // Nicole Moyer
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1Iascppiq90VyKWKEB1JfnByDDwiDXWC56uOqTmSFfWE/edit?gid=337733353#gid=337733353';
          break;

        case '6075':
          // Nikolaus Hilken
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1OopHjd-QkQmyF8kO86wVWDgILSnacGNHgaXnfHen_Lg/edit?gid=337733353#gid=337733353';
          break;

        case '1079':
          // Nora Easteadt
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1dLugRKAycp1l500j6iMypPxlx1kk_hYnioVneXWy6gc/edit?gid=337733353#gid=337733353';
          break;

        case '2556':
          // Nick Murdoch
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1dA4SrFr13ZhTU4cuEjz-cia5DWjAHtXYe42GfqnUQ_U/edit?gid=337733353#gid=337733353';
          break;

        case '9940':
          // Molly Higley
          redirectUrl = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
          break;

        case '9404':
          // Melanie Lavigna
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1e066yKapnYsY2n1o96hifCFdS5jMxLMpyhTjr958Hsk/edit?gid=337733353#gid=337733353';
          break;

        case '4838':
          // Logan Clemmer
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1BjQZOKxbEbVAfsAuh1pD234hs_mvZCgYKH_QJO3lu1I/edit?gid=337733353#gid=337733353';
          break;

        case '4154':
          // Lauren Speicher
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1U9NwqjyvrNWls7dAtR4G-QnB5aEfBatJbp2RoDOMxMM/edit?gid=337733353#gid=337733353';
          break;

        case '2667':
          // Kristen Clemmer
          redirectUrl = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
          break;

        case '7999':
          // Kat Schell
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1jdXdpBK8wTRH-E4fuyQUYdyum6HPkFAVLUxHzhybUO8/edit?gid=337733353#gid=337733353';
          break;

        case '5794':
          // Keisha Wise
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1vD0xP9U0rRDKCB8IWrbvMO_eLOPkeAP3nuqOCdamykM/edit?gid=337733353#gid=337733353';
          break;

        case '5483':
          // Karen Mellinger
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1xuT7V6wnUfoWvkHNFMgp6yYV47l5XhSqqPyafVNUalc/edit?gid=337733353#gid=337733353';
          break;

        case '5275':
          // Jake Higley
          redirectUrl = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
          break;

        case '4544':
          // Kevin Blimline
          redirectUrl = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
          break;

        case '4715':
          // Emily Chavez
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1-dRuRG4mQrRye8QCCwndMr2Otew6EIPjYB54bMRdj0k/edit?gid=337733353#gid=337733353';
          break;

        case '2421':
          // Liz Epler-Espinoza
          redirectUrl = 'https://docs.google.com/spreadsheets/d/11GZDI_-AZw8WBFOxopZblJGDk56RfuhClytr-MMRgko/edit?gid=337733353#gid=337733353';
          break;

        case '5412':
          // Darren Delong
          redirectUrl = 'https://docs.google.com/spreadsheets/d/14yKhGGqmowXSIVs4n1Rn172xy9y8IflnARGlibQ1pr0/edit?gid=337733353#gid=337733353';
          break;

        case '5735':
          // David Dracha
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1Ja9_K0j4NrDKHikVdIVfg8sQNFfFGMaz28k3MwL7tCs/edit?gid=337733353#gid=337733353';
          break;

        case '2284':
          // Citalli Alejo
          redirectUrl = 'https://docs.google.com/spreadsheets/d/1dEZMeDCX7pALEJ5QiOoTeFfVhU-MCy-liULn9tKeaow/edit?gid=337733353#gid=337733353';
          break;

        case '1698':
          // Bimpe Ifagbuyi
          redirectUrl = 'https://www.youtube.com/watch?v=xvFZjo5PgG0';
          break;




        default:
          // Invalid pin - show error message instead of redirecting
          setSubmitMessage('❌ Invalid pin. Please check your pin and try again.');
          setTimeout(() => setSubmitMessage(''), 5000);
          return; // Exit early, don't redirect
      }
      
      // If we get here, we have a valid pin and URL - redirect
      console.log('Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
      
    } catch (error) {
      console.error('Error submitting:', error);
      setSubmitMessage('❌ Error submitting. Please try again.');
      setTimeout(() => setSubmitMessage(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    // Only allow numbers and decimal points
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Hamburger Menu Row */}
      <div className="w-full p-4 pb-0">
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
            {/* Temporarily hidden Level Up Log */}
            {/* <Link 
              to="/level-up-log" 
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
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 0 01-2-2v-2z"
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

      {/* Main Content */}
      <div className="px-4 pb-4">
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📈 Level Up Log 📊</h1>
        </div>

        {/* Main Form */}
        <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Number Input */}
            <div>
              <label 
                htmlFor="numberInput" 
                className="block text-lg font-semibold text-gray-700 mb-3"
              >
                Enter Pin:
              </label>
              <input
                id="numberInput"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={inputValue}
                onChange={handleInputChange}
                className="w-full px-4 py-4 text-2xl text-center border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
                disabled={isSubmitting}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !inputValue.trim()}
              className={`w-full py-4 text-xl font-bold rounded-lg transition-all duration-200 ${
                isSubmitting || !inputValue.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit'
              )}
            </button>
          </form>

          {/* Submit Message */}
          {submitMessage && (
            <div className={`mt-4 p-3 rounded-lg text-center font-medium ${
              submitMessage.startsWith('✅') 
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {submitMessage}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default LevelUpLog; 