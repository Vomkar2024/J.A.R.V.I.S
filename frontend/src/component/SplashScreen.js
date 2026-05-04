import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Show splash for 5 seconds, then start fade out
    const timer = setTimeout(() => {
      setIsFading(true);
      // After fade animation completes (0.8s), call onComplete
      setTimeout(() => {
        onComplete();
      }, 800);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`splash-overlay ${isFading ? 'fade-out' : ''}`}>
      <div className="splash-content">
        <div className="jarvis-logo">
          <h1 className="splash-title">J.A.R.V.I.S</h1>
          <div className="scan-line"></div>
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
