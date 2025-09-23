import { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const Countdown = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [goal, setGoal] = useState(50); // Default goal of 50 orders
  const [currentShipped, setCurrentShipped] = useState(0);
  const [orders, setOrders] = useState([]);
  const [countdown, setCountdown] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugTimeLeft, setDebugTimeLeft] = useState(0);
  const [audioPlayed, setAudioPlayed] = useState({
    tenMin: false,
    fiveMin: false,
    oneMin: false,
    thirtySec: false
  });
  const [annoyingBeepInterval, setAnnoyingBeepInterval] = useState(null);

  // Listen to orders collection
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('allocated_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });
    return () => unsubscribe();
  }, []);

  // Get reliable EST time functions
  const getESTTime = () => {
    const now = new Date();
    // Use JavaScript's built-in timezone handling for EST/EDT
    // This will automatically handle DST transitions
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return estTime;
  };

  const isDaylightSavingTime = (date) => {
    // Use a test date to check if we're in DST
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const janOffset = jan.getTimezoneOffset();
    const julOffset = jul.getTimezoneOffset();
    const currentOffset = date.getTimezoneOffset();
    
    // In DST, offset is typically smaller (closer to 0)
    return Math.max(janOffset, julOffset) !== currentOffset;
  };

  // Get today's session times (9:30 AM - 11:30 AM EST)
  const getTodaySessionTimes = () => {
    const estNow = getESTTime();
    const today = new Date(estNow);
    today.setHours(0, 0, 0, 0);
    
    const sessionStart = new Date(today);
    sessionStart.setHours(9, 30, 0, 0);
    
    const sessionEnd = new Date(today);
    sessionEnd.setHours(11, 30, 0, 0);
    
    return { sessionStart, sessionEnd, now: estNow };
  };

  // Calculate countdown to session end
  useEffect(() => {
    const { sessionStart, sessionEnd, now } = getTodaySessionTimes();
    
    // Check if we're in the session window
    if (now >= sessionStart && now < sessionEnd) {
      setIsActive(true);
      setIsExpired(false);
      
      const difference = sessionEnd.getTime() - now.getTime();
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setCountdown({ hours, minutes, seconds });
    } else if (now < sessionStart) {
      // Before session starts
      setIsActive(false);
      setIsExpired(false);
      const difference = sessionStart.getTime() - now.getTime();
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setCountdown({ hours, minutes, seconds });
    } else {
      // After session ends
      setIsActive(false);
      setIsExpired(true);
      setCountdown({ hours: 0, minutes: 0, seconds: 0 });
    }
  }, []);

  // Update countdown every second - OPTIMIZED
  useEffect(() => {
    let interval;
    
    // Only run timer if we're not expired
    if (!isExpired) {
      interval = setInterval(() => {
        if (debugMode) {
          // Debug mode - use debugTimeLeft
          if (debugTimeLeft > 0) {
            setDebugTimeLeft(prev => {
              const newTime = prev - 1;
              
              // Check for audio cues
              checkAudioCues(newTime);
              
              if (newTime <= 0) {
                // Stop annoying beep and play gong sound when timer hits zero
                stopAnnoyingBeep();
                const audio = new Audio('/gong.mp3');
                audio.play().catch(e => console.log('Could not play gong sound:', e));
                setIsExpired(true);
                setIsActive(false);
                return 0;
              }
              return newTime;
            });
            
            const hours = Math.floor(debugTimeLeft / 3600);
            const minutes = Math.floor((debugTimeLeft % 3600) / 60);
            const seconds = debugTimeLeft % 60;
            
            setCountdown(prev => {
              if (prev.hours !== hours || prev.minutes !== minutes || prev.seconds !== seconds) {
                return { hours, minutes, seconds };
              }
              return prev;
            });
          }
        } else {
          // Normal mode
          const { sessionStart, sessionEnd, now } = getTodaySessionTimes();
          
          if (now >= sessionStart && now < sessionEnd) {
            setIsActive(true);
            setIsExpired(false);
            
            const difference = sessionEnd.getTime() - now.getTime();
            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            
            // Check for audio cues
            checkAudioCues(totalSeconds);
            
            // Play gong sound when timer hits zero
            if (hours === 0 && minutes === 0 && seconds === 0) {
              stopAnnoyingBeep();
              const audio = new Audio('/gong.mp3');
              audio.play().catch(e => console.log('Could not play gong sound:', e));
            }
            
            setCountdown(prev => {
              // Only update if values actually changed
              if (prev.hours !== hours || prev.minutes !== minutes || prev.seconds !== seconds) {
                return { hours, minutes, seconds };
              }
              return prev;
            });
          } else if (now < sessionStart) {
            setIsActive(false);
            setIsExpired(false);
            const difference = sessionStart.getTime() - now.getTime();
            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            
            setCountdown(prev => {
              if (prev.hours !== hours || prev.minutes !== minutes || prev.seconds !== seconds) {
                return { hours, minutes, seconds };
              }
              return prev;
            });
          } else {
            setIsActive(false);
            setIsExpired(true);
            setCountdown({ hours: 0, minutes: 0, seconds: 0 });
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExpired, debugMode, debugTimeLeft]);

  // Cleanup effect to stop beeping when component unmounts
  useEffect(() => {
    return () => {
      stopAnnoyingBeep();
    };
  }, []);

  // Calculate shipped orders for today - OPTIMIZED
  const shippedToday = useMemo(() => {
    const { sessionStart, sessionEnd } = getTodaySessionTimes();
    
    return orders.filter(order => {
      // Quick exit conditions first
      if (!order.shippedAt || order.status !== 'shipped') return false;
      
      let shippedTime;
      try {
        if (order.shippedAt.toDate) {
          shippedTime = order.shippedAt.toDate();
        } else if (typeof order.shippedAt === 'string') {
          shippedTime = new Date(order.shippedAt);
        } else {
          shippedTime = new Date(order.shippedAt);
        }
        
        // Convert to EST for comparison using proper timezone conversion
        const estShippedTime = new Date(shippedTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
        
        return estShippedTime >= sessionStart && estShippedTime <= sessionEnd;
      } catch (error) {
        // Silent fail for performance
        return false;
      }
    });
  }, [orders, isActive]); // Only recalculate when orders change or session status changes

  // Update current shipped count - OPTIMIZED
  useEffect(() => {
    const newCount = shippedToday.length;
    if (newCount !== currentShipped) {
      setCurrentShipped(newCount);
    }
  }, [shippedToday, currentShipped]);

  // Memoize calculations to prevent unnecessary re-renders
  const progressPercentage = useMemo(() => {
    return goal > 0 ? Math.min((currentShipped / goal) * 100, 100) : 0;
  }, [currentShipped, goal]);

  const remainingOrders = useMemo(() => {
    return Math.max(goal - currentShipped, 0);
  }, [goal, currentShipped]);

  // Audio cue functions
  const playAudioCue = (audioFile) => {
    const audio = new Audio(audioFile);
    audio.play().catch(e => console.log('Could not play audio:', e));
  };

  const startAnnoyingBeep = () => {
    // Clear any existing beep interval
    if (annoyingBeepInterval) {
      clearInterval(annoyingBeepInterval);
    }
    
    // Start beeping every 500ms for the last 30 seconds
    const beepInterval = setInterval(() => {
      // Create a complex, aggressive alarm sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create multiple oscillators for complex harmonics
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const oscillator3 = audioContext.createOscillator();
      const oscillator4 = audioContext.createOscillator();
      const oscillator5 = audioContext.createOscillator();
      
      const gainNode = audioContext.createGain();
      const filter1 = audioContext.createBiquadFilter();
      const filter2 = audioContext.createBiquadFilter();
      const compressor = audioContext.createDynamicsCompressor();
      
      // Connect oscillators through filters and compressor for aggressive sound
      oscillator1.connect(filter1);
      oscillator2.connect(filter1);
      oscillator3.connect(filter2);
      oscillator4.connect(filter2);
      oscillator5.connect(filter2);
      
      filter1.connect(compressor);
      filter2.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set up complex frequency structure for alarm-like sound
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime); // Primary alarm frequency
      oscillator2.frequency.setValueAtTime(1600, audioContext.currentTime); // Octave
      oscillator3.frequency.setValueAtTime(1200, audioContext.currentTime); // Fifth
      oscillator4.frequency.setValueAtTime(2000, audioContext.currentTime); // Higher harmonic
      oscillator5.frequency.setValueAtTime(400, audioContext.currentTime); // Lower harmonic
      
      // Mix of wave types for complex, harsh sound
      oscillator1.type = 'square'; // Sharp, digital
      oscillator2.type = 'sawtooth'; // Aggressive, cutting
      oscillator3.type = 'square'; // More sharpness
      oscillator4.type = 'sawtooth'; // High frequency bite
      oscillator5.type = 'square'; // Low frequency punch
      
      // Set up aggressive filtering
      filter1.type = 'bandpass';
      filter1.frequency.setValueAtTime(1000, audioContext.currentTime);
      filter1.Q.setValueAtTime(5, audioContext.currentTime); // Very sharp resonance
      
      filter2.type = 'highpass';
      filter2.frequency.setValueAtTime(600, audioContext.currentTime);
      filter2.Q.setValueAtTime(2, audioContext.currentTime);
      
      // Set up aggressive compression for alarm-like punch
      compressor.threshold.setValueAtTime(-20, audioContext.currentTime);
      compressor.knee.setValueAtTime(30, audioContext.currentTime);
      compressor.ratio.setValueAtTime(20, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.001, audioContext.currentTime);
      compressor.release.setValueAtTime(0.1, audioContext.currentTime);
      
      // Very aggressive envelope - sharp attack, sustained alarm sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.8, audioContext.currentTime + 0.005); // Instant attack
      gainNode.gain.exponentialRampToValueAtTime(0.6, audioContext.currentTime + 0.15); // Sustained alarm
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4); // Longer decay
      
      // Start all oscillators
      oscillator1.start(audioContext.currentTime);
      oscillator2.start(audioContext.currentTime);
      oscillator3.start(audioContext.currentTime);
      oscillator4.start(audioContext.currentTime);
      oscillator5.start(audioContext.currentTime);
      
      // Stop after 400ms for a longer, more alarm-like beep
      oscillator1.stop(audioContext.currentTime + 0.4);
      oscillator2.stop(audioContext.currentTime + 0.4);
      oscillator3.stop(audioContext.currentTime + 0.4);
      oscillator4.stop(audioContext.currentTime + 0.4);
      oscillator5.stop(audioContext.currentTime + 0.4);
    }, 500);
    
    setAnnoyingBeepInterval(beepInterval);
  };

  const stopAnnoyingBeep = () => {
    if (annoyingBeepInterval) {
      clearInterval(annoyingBeepInterval);
      setAnnoyingBeepInterval(null);
    }
  };

  // Check for audio cues based on time remaining
  const checkAudioCues = (totalSeconds) => {
    if (totalSeconds <= 30 && !audioPlayed.thirtySec) {
      // Start annoying beep for last 30 seconds
      startAnnoyingBeep();
      setAudioPlayed(prev => ({ ...prev, thirtySec: true }));
    } else if (totalSeconds <= 60 && !audioPlayed.oneMin) {
      // 1 minute remaining
      playAudioCue('/audio/1min-remaining.mp3'); // You'll need to add this file
      setAudioPlayed(prev => ({ ...prev, oneMin: true }));
    } else if (totalSeconds <= 300 && !audioPlayed.fiveMin) {
      // 5 minutes remaining
      playAudioCue('/audio/5min-remaining.mp3'); // You'll need to add this file
      setAudioPlayed(prev => ({ ...prev, fiveMin: true }));
    } else if (totalSeconds <= 600 && !audioPlayed.tenMin) {
      // 10 minutes remaining
      playAudioCue('/audio/10min-remaining.mp3'); // You'll need to add this file
      setAudioPlayed(prev => ({ ...prev, tenMin: true }));
    }
  };

  // Debug functions
  const setDebugTime = (seconds) => {
    setDebugMode(true);
    setDebugTimeLeft(seconds);
    setIsExpired(false);
    setIsActive(true);
    // Reset audio played states for debug mode
    setAudioPlayed({ tenMin: false, fiveMin: false, oneMin: false, thirtySec: false });
    stopAnnoyingBeep();
  };

  const resetToNormal = () => {
    setDebugMode(false);
    setDebugTimeLeft(0);
    setIsExpired(false);
    setIsActive(false);
    setAudioPlayed({ tenMin: false, fiveMin: false, oneMin: false, thirtySec: false });
    stopAnnoyingBeep();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hamburger Menu Button */}
      <button 
        onClick={() => {/* Add sidebar toggle logic here */}}
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Main Dashboard - All in One Container */}
        <div className="bg-white shadow-2xl rounded-2xl border-0 overflow-hidden mb-8 transform hover:scale-[1.02] transition-all duration-300">
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 p-8 relative overflow-hidden">
              <div className="absolute inset-0 bg-black opacity-10"></div>
              <div className="relative z-10">
                 <h2 className="text-5xl font-bold text-white text-center mb-2">🚀📦 Fulfillment Frenzy 📦🚀</h2>
                <p className="text-pink-100 text-center text-lg">Daily Shipping Challenge</p>
              </div>
              {/* Decorative elements */}
              <div className="absolute top-4 left-4 w-8 h-8 bg-white opacity-20 rounded-full animate-bounce"></div>
              <div className="absolute top-8 right-8 w-6 h-6 bg-white opacity-30 rounded-full animate-bounce" style={{animationDelay: '0.5s'}}></div>
              <div className="absolute bottom-4 left-1/4 w-4 h-4 bg-white opacity-25 rounded-full animate-bounce" style={{animationDelay: '1s'}}></div>
            </div>
            
            <div className="p-10 bg-gradient-to-br from-gray-50 to-white">
              {/* All Three Metrics Together */}
              <div className="text-center">
                {isExpired ? (
                  <div className="transform hover:scale-105 transition-all duration-300">
                    <div className="text-8xl mb-6 animate-bounce">⏰</div>
                    <h3 className="text-3xl font-bold text-gray-700 mb-3">Session Ended</h3>
                    <p className="text-xl text-gray-600">Session ended at 11:30 AM EST</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Time Remaining */}
                    <div className="transform hover:scale-105 transition-all duration-300">
                      <h3 className="text-3xl font-semibold text-gray-700 mb-6 flex items-center justify-center">
                        {isActive ? (
                          <>
                            <span className="animate-pulse mr-3">⏱️</span>
                            Time Remaining
                            <span className="animate-pulse ml-3">⏱️</span>
                          </>
                        ) : (
                          <>
                            <span className="animate-pulse mr-3">⏳</span>
                            Session Starts In
                            <span className="animate-pulse ml-3">⏳</span>
                          </>
                        )}
                      </h3>
                       <div className="text-8xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
                      </div>
                      <div className="text-xl text-gray-600 font-medium">
                        {isActive ? 'Hours:Minutes:Seconds' : 'Until session starts'}
                      </div>
                    </div>

                    {/* Progress and Orders Left Side by Side - No Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Progress */}
                      <div className="text-center">
                        <h3 className="text-2xl font-semibold text-blue-600 mb-4 flex items-center justify-center">
                          <span className="mr-2">📊</span>
                          Progress
                          <span className="ml-2">📊</span>
                        </h3>
                        <div className="text-7xl font-bold text-blue-600 mb-4">{progressPercentage.toFixed(1)}%</div>
                        <div className="text-lg text-blue-500 font-medium mb-4">{currentShipped} of {goal} shipped</div>
                        
                        <div className="w-full bg-gray-300 rounded-full h-6 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-6 rounded-full transition-all duration-500 shadow-lg"
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Orders Remaining */}
                      <div className="text-center">
                        <h3 className="text-2xl font-semibold text-orange-600 mb-4 flex items-center justify-center">
                          <span className="mr-2">📦</span>
                          Orders Left
                          <span className="ml-2">📦</span>
                        </h3>
                        <div className="text-8xl font-bold text-orange-600 mb-4">{remainingOrders}</div>
                        <div className="text-lg text-orange-500 font-medium">
                          {remainingOrders === 0 ? '🎉 Goal Reached! 🎉' : `out of ${goal} orders`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Goal Setting Section - Moved to Bottom */}
        <div className="mt-16 bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 text-left">Set Daily Goal</h2>
          
          <div className="flex items-left justify-left space-x-4">
            <label className="text-sm font-medium text-gray-600">
              Target Orders:
            </label>
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold"
            />
            <span className="text-sm text-gray-600">orders by 11:30 AM EST</span>
          </div>
        </div>

        {/* Debug Section - At the very bottom */}
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-700 mb-3">🔧 Debug Controls</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setDebugTime(10)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
            >
              10 Seconds
            </button>
            <button
              onClick={() => setDebugTime(30)}
              className="px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition-colors duration-200 text-sm font-medium"
            >
              30 Seconds
            </button>
            <button
              onClick={() => setDebugTime(600)}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors duration-200 text-sm font-medium"
            >
              10 Minutes
            </button>
            <button
              onClick={resetToNormal}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200 text-sm font-medium"
            >
              Back to Normal
            </button>
            {debugMode && (
              <span className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-md text-sm font-medium">
                🐛 Debug Mode Active
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Countdown;
