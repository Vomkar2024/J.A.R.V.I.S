import React from 'react';
import './css/Hero.css';

/**
 * Hero Component
 * This is the "Welcome Screen" of the application. It displays the iconic
 * J.A.R.V.I.S logo and the "Love You 3000" message when the app first starts.
 */
const Hero = ({ showHero }) => {
  return (
    <main className="main-content">
      <section className="hero-section">
        {/* The glass-panel contains the text. It fades away once the app is ready. */}
        <div className={`glass-panel ${!showHero ? 'fade-out-hero' : ''}`}>
          <h1 className="hero-title">J.A.R.V.I.S</h1>
          <p className="hero-subtitle">❤️ LOVE YOU 3000 ❤️</p>
          
          {/* Status indicator shown at the bottom of the welcome message */}
          <div className="hero-status-container">
            <div className="hero-status-line"></div>
            <span className="hero-status-text">NEURAL INTERFACE ACTIVE</span>
            <div className="hero-status-line"></div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Hero;
