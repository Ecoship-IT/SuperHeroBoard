import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

const Countdown = ({ isAuthenticated, isGuest, userRole, onLogout }) => {
  const [goal, setGoal] = useState(50); // Default goal of 50 orders
  const [currentShipped, setCurrentShipped] = useState(0);
  const processedChangesRef = useRef(new Set());
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [hasPlayedVictorySound, setHasPlayedVictorySound] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isInFrenzyWindow, setIsInFrenzyWindow] = useState(false);
  const [shouldActivateListener, setShouldActivateListener] = useState(false);
  
  // Use refs to prevent multiple audio triggers
  const audioPlayedRef = useRef({
    tenMin: false,
    fiveMin: false,
    oneMin: false,
    thirtySec: false
  });

  // Fetch random radio station for background music
  const getRandomRadioStation = async () => {
    try {
      // Get upbeat, energetic stations - pop, rock, electronic, etc.
      // Add timestamp to ensure we get fresh results each time
      const timestamp = Date.now();
      const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?tag=pop&tag=rock&tag=electronic&tag=upbeat&tag=energy&tag=workout&tag=party&limit=100&_t=${timestamp}`);
      const stations = await response.json();
      
      // Filter out stations with potentially inappropriate names or tags
      const safeStations = stations.filter(station => {
        const name = (station.name || '').toLowerCase();
        const tags = (station.tags || '').toLowerCase();
        const country = (station.country || '').toLowerCase();
        const language = (station.language || '').toLowerCase();
        
        // Avoid Spanish and other non-English content
        const spanishKeywords = ['spanish', 'español', 'espanol', 'mexico', 'mexican', 'latin', 'latino', 'salsa', 'reggaeton', 'bachata', 'merengue'];
        const otherLanguageKeywords = ['french', 'français', 'german', 'deutsch', 'italian', 'italiano', 'portuguese', 'português', 'russian', 'русский', 'chinese', '中文', 'japanese', '日本語', 'korean', '한국어'];
        
        // Avoid stations with potentially inappropriate content
        const inappropriateKeywords = ['explicit', 'adult', 'hardcore', 'death', 'metal', 'hip-hop', 'rap', 'gangsta', 'explicit', 'adult'];
        
        // Check for Spanish/other language content
        const hasSpanishContent = spanishKeywords.some(keyword => 
          name.includes(keyword) || tags.includes(keyword) || country.includes(keyword)
        );
        
        const hasOtherLanguageContent = otherLanguageKeywords.some(keyword => 
          name.includes(keyword) || tags.includes(keyword) || country.includes(keyword)
        );
        
        // Check for inappropriate content
        const hasInappropriateContent = inappropriateKeywords.some(keyword => 
          name.includes(keyword) || tags.includes(keyword)
        );
        
        // Prefer English-language stations
        const isEnglish = language.includes('english') || language.includes('en') || 
                         (!language || language === '') || 
                         name.includes('english') || name.includes('en-');
        
        return !hasSpanishContent && !hasOtherLanguageContent && !hasInappropriateContent && isEnglish;
      });
      
      if (safeStations.length > 0) {
        const randomStation = safeStations[Math.floor(Math.random() * safeStations.length)];
        return randomStation.url;
      }
      return null;
    } catch (error) {
      console.error('Error fetching radio station:', error);
      return null;
    }
  };

  // Start background music
  const startBackgroundMusic = async () => {
    if (isMusicPlaying) return;
    
    try {
      const stationUrl = await getRandomRadioStation();
      if (stationUrl) {
        const audio = new Audio(stationUrl);
        audio.volume = 0.3; // Low volume so it doesn't interfere with beeps
        audio.loop = true;
        
        // Wait for user interaction to start audio
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setBackgroundMusic(audio);
            setIsMusicPlaying(true);
          }).catch(() => {
            console.log('Could not start background music - user interaction required');
          });
        }
      }
    } catch (error) {
      console.error('Error starting background music:', error);
    }
  };

  // Stop background music
  const stopBackgroundMusic = () => {
    if (backgroundMusic) {
      backgroundMusic.pause();
      setBackgroundMusic(null);
      setIsMusicPlaying(false);
    }
  };

  // Shuffle to a new radio station
  const shuffleMusic = async () => {
    if (!isMusicPlaying) return;
    
    try {
      // Stop current music completely
      if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0; // Reset to beginning
        setBackgroundMusic(null);
        setIsMusicPlaying(false);
      }
      
      // Wait longer for complete cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Start new music directly (no user interaction needed since we're already in a click handler)
      const stationUrl = await getRandomRadioStation();
      console.log('🎵 Shuffling to new station:', stationUrl);
      if (stationUrl) {
        const audio = new Audio(stationUrl);
        audio.volume = 0.3;
        audio.loop = true;
        
        // Start immediately since we're in a user interaction context
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setBackgroundMusic(audio);
            setIsMusicPlaying(true);
          }).catch((error) => {
            console.error('Could not start shuffled music:', error);
            // If it fails, try the regular start function as fallback
            startBackgroundMusic();
          });
        }
      }
    } catch (error) {
      console.error('Error shuffling music:', error);
    }
  };

  // Play victory sound when goal is reached
  const playVictorySound = async () => {
    try {
      // If music is playing, fade it out first
      if (backgroundMusic && isMusicPlaying) {
        await fadeOutMusic();
      }
      
      // Play victory sound
      const audio = new Audio('/victory.mp3');
      audio.volume = 0.7;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        
        // Wait for victory sound to finish
        await new Promise(resolve => {
          audio.onended = resolve;
        });
      } else {
        // Fallback to Web Audio API if file doesn't exist
        playFallbackVictorySound();
        // Wait a bit for the fallback sound
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // If music was playing, fade it back in
      if (backgroundMusic && isMusicPlaying) {
        await fadeInMusic();
      }
    } catch (error) {
      // Fallback to Web Audio API
      playFallbackVictorySound();
    }
  };

  // Fade out background music
  const fadeOutMusic = () => {
    return new Promise(resolve => {
      if (!backgroundMusic) {
        resolve();
        return;
      }
      
      const fadeOut = () => {
        if (backgroundMusic.volume > 0.1) {
          backgroundMusic.volume -= 0.1;
          setTimeout(fadeOut, 50);
        } else {
          backgroundMusic.volume = 0;
          resolve();
        }
      };
      
      fadeOut();
    });
  };

  // Fade in background music
  const fadeInMusic = () => {
    return new Promise(resolve => {
      if (!backgroundMusic) {
        resolve();
        return;
      }
      
      const targetVolume = 0.3; // Original volume
      const fadeIn = () => {
        if (backgroundMusic.volume < targetVolume) {
          backgroundMusic.volume += 0.05;
          setTimeout(fadeIn, 50);
        } else {
          backgroundMusic.volume = targetVolume;
          resolve();
        }
      };
      
      fadeIn();
    });
  };

  // Fallback victory sound using Web Audio API
  const playFallbackVictorySound = () => {
    try {
      const audioContext = getAudioContext();
      
      // Create a celebratory fanfare with multiple notes
      const playNote = (frequency, startTime, duration) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine';
        
        // Envelope for smooth sound
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      
      // Victory fanfare melody (C-E-G-C octave)
      playNote(523.25, now, 0.3);        // C5
      playNote(659.25, now + 0.1, 0.3);  // E5
      playNote(783.99, now + 0.2, 0.3);  // G5
      playNote(1046.50, now + 0.3, 0.5); // C6 (octave)
      
      // Add some sparkle with higher notes
      playNote(1318.51, now + 0.4, 0.2); // E6
      playNote(1567.98, now + 0.5, 0.2); // G6
      playNote(2093.00, now + 0.6, 0.4); // C7
      
    } catch (error) {
      console.error('Error playing victory sound:', error);
    }
  };

  // Periodic check to see if we're in the frenzy window
  // This controls whether the listener should be active
  useEffect(() => {
    const checkWindow = () => {
      const inWindow = checkIfInFrenzyWindow();
      setIsInFrenzyWindow(inWindow);
      
      // Only activate listener if we're in the window OR in debug mode
      if (inWindow || debugMode) {
        setShouldActivateListener(true);
        console.log('✅ In frenzy window - listener will be active');
      } else {
        setShouldActivateListener(false);
        console.log('⏸️ Outside frenzy window - listener inactive (cost savings mode)');
      }
    };
    
    // Check immediately
    checkWindow();
    
    // Check every 30 seconds
    const interval = setInterval(checkWindow, 30000);
    
    return () => clearInterval(interval);
  }, [debugMode]);

  // Real-time countdown - only count orders shipped during frenzy period (9:30-11:30 AM EST)
  // NOW with conditional activation based on time window!
  useEffect(() => {
    // Don't activate listener if we're outside the frenzy window
    if (!shouldActivateListener) {
      console.log('⏸️ Listener not activated - outside frenzy window');
      setIsInitialLoad(false);
      return;
    }
    
    console.log('🔄 Activating real-time listener - in frenzy window!');
    let initialCountLoaded = false;
    
    const q = query(
      collection(db, 'orders'), 
      orderBy('allocated_at', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // First load - get initial count for frenzy period only
      if (!initialCountLoaded) {
        let frenzyCount = 0;
        const frenzyOrders = []; // Array to store order details for logging
        const today = new Date();
        const todayEastern = today.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
        
        // Get today's frenzy period times
        const { sessionStart, sessionEnd } = getTodaySessionTimes();
        
        console.log(`🔍 Starting initial frenzy count analysis...`);
        console.log(`📅 Today Eastern: ${todayEastern}`);
        console.log(`⏰ Session times: ${sessionStart.toLocaleString()} - ${sessionEnd.toLocaleString()}`);
        console.log(`📊 Total orders in database: ${snapshot.docs.length}`);
        
        let processedCount = 0;
        let shippedTodayCount = 0;
        let frenzyWindowCount = 0;
        
        snapshot.docs.forEach((doc, index) => {
          const order = doc.data();
          processedCount++;
          
          // Log progress every 5000 orders
          if (processedCount % 5000 === 0) {
            console.log(`📈 Processed ${processedCount} orders... (${frenzyCount} frenzy orders found so far)`);
          }
          
          if (order.status === 'shipped' && order.shippedAt) {
            try {
              let shipDate;
              if (order.shippedAt.toDate) {
                shipDate = order.shippedAt.toDate();
              } else if (typeof order.shippedAt === 'string') {
                let timeStr = order.shippedAt;
                if (order.shippedAt.includes('T')) {
                  timeStr = order.shippedAt.replace('T', ' ');
                }
                shipDate = new Date(timeStr + ' UTC');
              } else {
                shipDate = new Date(order.shippedAt);
              }
              
              if (shipDate && !isNaN(shipDate.getTime())) {
                const shipDateEastern = shipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                if (shipDateEastern === todayEastern) {
                  shippedTodayCount++;
                  // Check if shipped during frenzy period (9:30-11:30 AM EST)
                  const shipTime = shipDate.getTime();
                  if (shipTime >= sessionStart.getTime() && shipTime <= sessionEnd.getTime()) {
                    frenzyCount++;
                    frenzyWindowCount++;
                    // Only log first 10 frenzy orders to avoid spam
                    if (frenzyCount <= 10) {
                      frenzyOrders.push({
                        order_number: order.order_number,
                        shippedAt: order.shippedAt,
                        shipTime: shipDate.toLocaleString('en-US', {timeZone: 'America/New_York'}),
                        shipTimeUTC: shipDate.toISOString()
                      });
                      console.log(`✅ FRENZY ORDER #${frenzyCount}: ${order.order_number} - Shipped at ${shipDate.toLocaleString('en-US', {timeZone: 'America/New_York'})}`);
                    }
                  }
                }
              }
            } catch (error) {
              // Skip invalid dates silently to avoid spam
            }
          }
        });
        
        console.log(`🔍 Initial frenzy count: ${frenzyCount} orders`);
        console.log(`📊 Analysis summary:`);
        console.log(`   - Total orders processed: ${processedCount}`);
        console.log(`   - Shipped today: ${shippedTodayCount}`);
        console.log(`   - In frenzy window (9:30-11:30 AM EST): ${frenzyWindowCount}`);
        console.log(`   - First 10 frenzy orders:`, frenzyOrders);
        setCurrentShipped(frenzyCount);
        initialCountLoaded = true;
        setIsInitialLoad(false);
        return;
      }
      
      // Subsequent updates - only process changes
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;
      
      const today = new Date();
      const todayEastern = today.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
      const { sessionStart, sessionEnd } = getTodaySessionTimes();
      
      let countChange = 0;
      
            changes.forEach(change => {
              const order = change.doc.data();
              const prevOrder = change.doc.metadata.fromCache ? null : change.doc.metadata.hasPendingWrites ? null : change.doc.data();
              
              // Create unique identifier for this change
              const changeId = `${change.type}-${order.order_number}-${change.doc.id}`;
              
              // Skip if we've already processed this exact change
              if (processedChangesRef.current.has(changeId)) {
                console.log(`⏭️ Skipping duplicate change: ${changeId}`);
                return;
              }
              
              // Mark this change as processed
              processedChangesRef.current.add(changeId);
              
              // Clean up old processed changes to prevent memory leaks (keep last 1000)
              if (processedChangesRef.current.size > 1000) {
                const entries = Array.from(processedChangesRef.current);
                processedChangesRef.current.clear();
                entries.slice(-500).forEach(id => processedChangesRef.current.add(id));
              }
              
              console.log(`📦 Order change: type=${change.type}, order=${order.order_number}, status=${order.status}`);
              
              // Handle different change types
              if (change.type === 'added') {
          // New order added - only count if it's shipped and in frenzy period
          if (order.status === 'shipped' && order.shippedAt) {
            try {
              let shipDate;
              if (order.shippedAt.toDate) {
                shipDate = order.shippedAt.toDate();
              } else if (typeof order.shippedAt === 'string') {
                let timeStr = order.shippedAt;
                if (order.shippedAt.includes('T')) {
                  timeStr = order.shippedAt.replace('T', ' ');
                }
                shipDate = new Date(timeStr + ' UTC');
              } else {
                shipDate = new Date(order.shippedAt);
              }
              
              if (shipDate && !isNaN(shipDate.getTime())) {
                const shipDateEastern = shipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                if (shipDateEastern === todayEastern) {
                  // Check if shipped during frenzy period (9:30-11:30 AM EST)
                  const shipTime = shipDate.getTime();
                  if (shipTime >= sessionStart.getTime() && shipTime <= sessionEnd.getTime()) {
                    countChange += 1;
                    console.log(`📊 Count change: +1 (added) for order ${order.order_number}`);
                  }
                }
              }
            } catch {
              // Skip invalid dates
            }
          }
        } else if (change.type === 'removed') {
          // Order removed - only count if it was previously shipped and in frenzy period
          // Note: We can't check the previous state easily, so we'll skip decrements for removed orders
          // This is safer than incorrectly decrementing
          console.log(`📊 Skipping removed order ${order.order_number} (can't verify previous state)`);
        } else if (change.type === 'modified') {
          // Order modified - if it's now shipped and in frenzy period, count it as +1
          // Since orders almost never go from shipped to not shipped, this is safe
          if (order.status === 'shipped' && order.shippedAt) {
            try {
              let shipDate;
              if (order.shippedAt.toDate) {
                shipDate = order.shippedAt.toDate();
              } else if (typeof order.shippedAt === 'string') {
                let timeStr = order.shippedAt;
                if (order.shippedAt.includes('T')) {
                  timeStr = order.shippedAt.replace('T', ' ');
                }
                shipDate = new Date(timeStr + ' UTC');
              } else {
                shipDate = new Date(order.shippedAt);
              }
              
              if (shipDate && !isNaN(shipDate.getTime())) {
                const shipDateEastern = shipDate.toLocaleDateString('en-US', {timeZone: 'America/New_York'});
                if (shipDateEastern === todayEastern) {
                  // Check if shipped during frenzy period (9:30-11:30 AM EST)
                  const shipTime = shipDate.getTime();
                  if (shipTime >= sessionStart.getTime() && shipTime <= sessionEnd.getTime()) {
                    countChange += 1;
                    console.log(`📊 Count change: +1 (modified to shipped) for order ${order.order_number}`);
                  }
                }
              }
            } catch {
              // Skip invalid dates
            }
          } else {
            console.log(`📊 Skipping modified order ${order.order_number} (status: ${order.status})`);
          }
        }
      });
      
      // Update count by the change amount
      console.log(`📈 Total count change: ${countChange}`);
      
      // Only update if there's actually a change to prevent duplicate processing
      if (countChange !== 0) {
        setCurrentShipped(prev => {
          const newCount = Math.max(0, prev + countChange);
          console.log(`📊 Orders count: ${prev} + ${countChange} = ${newCount}`);
          return newCount;
        });
      }
    }, (error) => {
      console.error('❌ Firestore listener error:', error);
      // Don't crash the app, just log the error
      // The listener will automatically retry
    });
    
    return () => unsubscribe();
  }, [shouldActivateListener]); // Re-run when listener should activate/deactivate

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

  // Check if we're currently in the frenzy window (9:30-11:30 AM EST)
  const checkIfInFrenzyWindow = () => {
    const { sessionStart, sessionEnd, now } = getTodaySessionTimes();
    return now >= sessionStart && now < sessionEnd;
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

  // Simple, reliable timer - no complex logic
  useEffect(() => {
    const interval = setInterval(() => {
        if (debugMode) {
        // Debug mode
          if (debugTimeLeft > 0) {
            setDebugTimeLeft(prev => {
              const newTime = prev - 1;
              
              
              // Check audio cues with current time (prev), not new time
              checkAudioCues(prev);
              
              // Update countdown display with new time
              const hours = Math.floor(newTime / 3600);
              const minutes = Math.floor((newTime % 3600) / 60);
              const seconds = newTime % 60;
              setCountdown({ hours, minutes, seconds });
              
              // Play gong when hitting 0 seconds (before setting expired)
              if (newTime === 0) {
                console.log('🔔 Playing gong at 0 seconds (debug mode)');
                stopAnnoyingBeep();
                const audio = new Audio('/gong.mp3');
                audio.play().catch(e => console.log('Could not play gong sound:', e));
                console.log('🏁 Setting session as expired and inactive');
                setIsExpired(true);
                setIsActive(false);
                return 0;
              }
              
              if (newTime <= 0) {
                console.log('🏁 Session ending due to newTime <= 0');
                setIsExpired(true);
                setIsActive(false);
                return 0;
              }
              
              return newTime;
            });
          }
        } else {
        // Normal mode - simple calculation
          const { sessionStart, sessionEnd, now } = getTodaySessionTimes();
          
          if (now >= sessionStart && now < sessionEnd) {
            setIsActive(true);
            setIsExpired(false);
            
            const difference = sessionEnd.getTime() - now.getTime();
            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            
            
            checkAudioCues(totalSeconds);
            
          // Play gong sound when timer hits 0 seconds
            if (hours === 0 && minutes === 0 && seconds === 0) {
              console.log('🔔 Playing gong at 0 seconds (normal mode)');
              stopAnnoyingBeep();
              const audio = new Audio('/gong.mp3');
              audio.play().catch(e => console.log('Could not play gong sound:', e));
            }
            
          setCountdown({ hours, minutes, seconds });
          } else if (now < sessionStart) {
            setIsActive(false);
            setIsExpired(false);
            const difference = sessionStart.getTime() - now.getTime();
            const hours = Math.floor(difference / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            setCountdown({ hours, minutes, seconds });
          } else {
            setIsActive(false);
            setIsExpired(true);
            setCountdown({ hours: 0, minutes: 0, seconds: 0 });
          }
        }
      }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, debugMode, debugTimeLeft]);

  // Cleanup effect to stop beeping and music when component unmounts
  useEffect(() => {
    return () => {
      stopAnnoyingBeep();
      stopBackgroundMusic();
    };
  }, []);

  // currentShipped is now updated directly in the onSnapshot listener above
  // No need for separate calculation since we're counting directly

  // Memoize calculations to prevent unnecessary re-renders
  const progressPercentage = useMemo(() => {
    return goal > 0 ? Math.min((currentShipped / goal) * 100, 100) : 0;
  }, [currentShipped, goal]);

  // Play victory sound when reaching 100%
  useEffect(() => {
    if (progressPercentage >= 100 && !hasPlayedVictorySound) {
      playVictorySound();
      setHasPlayedVictorySound(true);
    } else if (progressPercentage < 100) {
      // Reset victory sound flag if they go below 100% (in case goal changes)
      setHasPlayedVictorySound(false);
    }
  }, [progressPercentage, hasPlayedVictorySound]);

  const remainingOrders = useMemo(() => {
    return Math.max(goal - currentShipped, 0);
  }, [goal, currentShipped]);

  // Audio cue functions
  const playAudioCue = (audioFile) => {
    const audio = new Audio(audioFile);
    audio.play().catch(e => console.log('Could not play audio:', e));
  };

  // Create a single AudioContext to reuse
  const audioContextRef = useRef(null);
  
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const startAnnoyingBeep = () => {
    // Clear any existing beep interval
    if (annoyingBeepInterval) {
      clearInterval(annoyingBeepInterval);
    }
    
    // Start beeping every 500ms for the last 30 seconds
    const beepInterval = setInterval(() => {
      // Create a complex, aggressive alarm sound using Web Audio API
      const audioContext = getAudioContext();
      
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
      
      // Set up complex frequency structure for alarm-like sound with more bass
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime); // Primary alarm frequency
      oscillator2.frequency.setValueAtTime(1600, audioContext.currentTime); // Octave
      oscillator3.frequency.setValueAtTime(1200, audioContext.currentTime); // Fifth
      oscillator4.frequency.setValueAtTime(2000, audioContext.currentTime); // Higher harmonic
      oscillator5.frequency.setValueAtTime(120, audioContext.currentTime); // Much lower bass frequency
      
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
    // Don't play audio cues if session is over or expired
    if (isExpired) {
      stopAnnoyingBeep();
      return;
    }
    
    // Use refs to prevent multiple triggers
    if (totalSeconds <= 30 && totalSeconds >= 0 && !audioPlayedRef.current.thirtySec) {
      // Start annoying beep for last 30 seconds (including at 0)
      console.log('🔊 Starting beep at', totalSeconds, 'seconds');
      startAnnoyingBeep();
      audioPlayedRef.current.thirtySec = true;
      setAudioPlayed(prev => ({ ...prev, thirtySec: true }));
    } else if (totalSeconds <= 60 && totalSeconds > 0 && !audioPlayedRef.current.oneMin) {
      // 1 minute remaining
      playAudioCue('/Audio/1Minute.m4a');
      audioPlayedRef.current.oneMin = true;
      setAudioPlayed(prev => ({ ...prev, oneMin: true }));
    } else if (totalSeconds <= 300 && totalSeconds > 0 && !audioPlayedRef.current.fiveMin) {
      // 5 minutes remaining
      playAudioCue('/Audio/5Minutes.m4a');
      audioPlayedRef.current.fiveMin = true;
      setAudioPlayed(prev => ({ ...prev, fiveMin: true }));
    } else if (totalSeconds <= 600 && totalSeconds > 0 && !audioPlayedRef.current.tenMin) {
      // 10 minutes remaining
      playAudioCue('/Audio/10Minutes.m4a');
      audioPlayedRef.current.tenMin = true;
      setAudioPlayed(prev => ({ ...prev, tenMin: true }));
    }
    
    // Only stop annoying beep when we're past 30 seconds (let it run until gong plays)
    if (totalSeconds > 30 && audioPlayedRef.current.thirtySec) {
      console.log('🔇 Stopping beep at', totalSeconds, 'seconds (past 30)');
      stopAnnoyingBeep();
    }
  };

  // Loading screen component
  const LoadingScreen = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <img 
          src="/face.png" 
          alt="Loading..." 
          className="animate-spin-counter-clockwise h-24 w-24 mx-auto mb-4"
        />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Loading Countdown</h2>
        <p className="text-gray-600">This may take a moment...</p>
      </div>
    </div>
  );

  // Outside frenzy window component
  const OutsideWindowScreen = () => {
    const { sessionStart, sessionEnd, now } = getTodaySessionTimes();
    const isBeforeSession = now < sessionStart;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <div className="text-8xl mb-6 animate-pulse">⏰</div>
          <h2 className="text-4xl font-bold text-gray-800 mb-4">
            {isBeforeSession ? '⏳ Frenzy Hasn\'t Started Yet' : '🏁 Frenzy Period Ended'}
          </h2>
          <p className="text-xl text-gray-600 mb-6">
            {isBeforeSession 
              ? 'The Fulfillment Frenzy runs from 9:30 AM - 11:30 AM EST'
              : 'Today\'s frenzy period has ended. See you tomorrow!'}
          </p>
          
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Frenzy Schedule</h3>
            <div className="flex justify-center items-center space-x-4 text-gray-600">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🚀</span>
                <div>
                  <p className="text-sm text-gray-500">Starts</p>
                  <p className="font-semibold">9:30 AM EST</p>
                </div>
              </div>
              <div className="text-2xl text-gray-400">→</div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🏁</span>
                <div>
                  <p className="text-sm text-gray-500">Ends</p>
                  <p className="font-semibold">11:30 AM EST</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  // Show loading screen during initial load
  if (isInitialLoad) {
    return <LoadingScreen />;
  }

  // Show outside window screen if not in frenzy period (unless debug mode is active)
  if (!shouldActivateListener && !debugMode) {
    return <OutsideWindowScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
        {/* This is the X in the sidebar */}
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
            <a 
              href="http://10.1.10.240:5173" 
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
            </a>
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
              to="/countdown" 
              className="block px-6 py-3 text-blue-600 bg-blue-50 rounded-lg transition-all duration-200 text-lg font-semibold border border-blue-200 shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-blue-300"
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Countdown</span>
              </div>
            </Link>
          </nav>
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
                        {isActive ? 'Hours:Minutes:Seconds' : ''}
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
                          Orders Left to Ship
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
        <div className="mt-32 bg-gray-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-700 text-left">Set Daily Goal</h2>
            
            {/* Shuffle Music Button */}
            <button
              onClick={shuffleMusic}
              disabled={!isMusicPlaying}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium flex items-center gap-2"
            >
              <span>🎵</span>
              {isMusicPlaying ? 'Shuffle Music' : 'No Music Playing'}
            </button>
          </div>
          
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
              onClick={() => setDebugTime(75)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 text-sm font-medium"
            >
              1 Min 15 Sec
            </button>
            <button
              onClick={() => setDebugTime(30)}
              className="px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition-colors duration-200 text-sm font-medium"
            >
              30 Seconds
            </button>
            <button
              onClick={() => setDebugTime(45)}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors duration-200 text-sm font-medium"
            >
              45 Seconds
            </button>
            <button
              onClick={() => setDebugTime(60)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
            >
              1 Minute
            </button>
            <button
              onClick={resetToNormal}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200 text-sm font-medium"
            >
              Back to Normal
            </button>
            
            {/* Music Controls */}
            <div className="mt-4 pt-4 border-t border-gray-300">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">🎵 Background Music</h4>
              <div className="flex gap-2">
                <button
                  onClick={startBackgroundMusic}
                  disabled={isMusicPlaying}
                  className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                >
                  {isMusicPlaying ? '🎵 Playing...' : '▶️ Start Music'}
                </button>
                <button
                  onClick={stopBackgroundMusic}
                  disabled={!isMusicPlaying}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 text-sm font-medium"
                >
                  ⏹️ Stop Music
                </button>
              </div>
            </div>
            
            {/* Sound Effects */}
            <div className="mt-4 pt-4 border-t border-gray-300">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">🔊 Sound Effects</h4>
              <div className="flex gap-2">
                <button
                  onClick={playVictorySound}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors duration-200 text-sm font-medium"
                >
                  🎉 Test Victory Sound
                </button>
              </div>
            </div>
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
