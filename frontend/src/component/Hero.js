import React from 'react';
import './Hero.css';

const Hero = ({ showHero }) => {
  return (
    <main className="main-content">
      <section className="hero-section">
        <div className={`glass-panel ${!showHero ? 'fade-out-hero' : ''}`}>
          <h1 className="hero-title">J.A.R.V.I.S</h1>
          <p className="hero-subtitle">LOVE YOU 3000</p>
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
