import React, { useEffect, useState } from 'react';
import './css/SplashScreen.css';
import splashGif from '../img/slashscreen.gif';

/**
 * SplashScreen Component
 * This is the very first thing the user sees. It's a loading screen
 * that makes the app feel like a high-tech system booting up.
 */
const SplashScreen = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => {
        onComplete();
      }, 800);
    }, 8000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-overlay ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="jarvis-logo">
          {/* Main Animated GIF */}
          <img src={splashGif} alt="Neural Processor" className="splash-gif" />
          
          {/* JARVIS Text Identity (Centered and matched to GIF breath) */}
          <div className="splash-identity">
            <h1 className="splash-title">J.A.R.V.I.S</h1>
          </div>
        </div>
        
        <div className="loading-container">
          <div className="loading-bar"></div>
          <p className="loading-text">INITIALIZING SYSTEMS...</p>
        </div>
        
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
