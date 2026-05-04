import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

/**
 * SplashScreen Component
 * This is the very first thing the user sees. It's a loading screen
 * that makes the app feel like a high-tech system booting up.
 */
const SplashScreen = ({ onComplete }) => {
  // State to track if we should start the "fade away" animation
  const [isFading, setIsFading] = useState(false);

  /**
   * Loading Timer
   * This logic waits for 5 seconds (simulating a system boot)
   * and then triggers the transition to the main app.
   */
  useEffect(() => {
    // 1. Wait 5 seconds
    const timer = setTimeout(() => {
      setIsFading(true); // Start the fading animation
      
      // 2. Wait for the animation to finish (0.8 seconds) before hiding completely
      setTimeout(() => {
        onComplete(); // Tell the main App that we are done loading
      }, 800);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-overlay ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        {/* The big J.A.R.V.I.S title */}
        <div className="jarvis-logo">
          <h1 className="splash-title">J.A.R.V.I.S</h1>
        </div>
        
        {/* The loading bar and status text */}
        <div className="loading-container">
          <div className="loading-bar"></div>
          <p className="loading-text">INITIALIZING SYSTEMS...</p>
        </div>
        
        {/* Decorative HUD (Heads-Up Display) corners for that "Iron Man" feel */}
        <div className="hud-decorations">
          <div className="corner top-left"></div>
          <div className="corner top-right"></div>
          <div className="corner bottom-left"></div>
          <div className="corner bottom-right"></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
