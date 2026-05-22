import React, { useEffect, useState } from 'react';
import './css/SplashScreen.css';
import splashGif from '../img/slashscreen.gif';

import { SPLASH_DURATION } from '../constants';

const SplashScreen = () => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, SPLASH_DURATION);

    return () => {
      clearTimeout(fadeTimer);
    };
  }, []);

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
