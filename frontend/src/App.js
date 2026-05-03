import React, { useState, useEffect, useCallback } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';

const DEFAULT_SETTINGS = {
  color: '#ff6b00', // Scorching fire orange
  size: 0.8,
  sensitivity: 1.5,
  position: { x: 50, y: 50 },
  isDraggable: false
};

function App() {
  const [blobSettings, setBlobSettings] = useState(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHero, setShowHero] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ 
          ...prev, 
          ...parsed, 
          isDraggable: false // Always default to not draggable on load
        }));
      }
    } catch (error) {
      console.error('Failed to load blob settings from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowHero(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleSave = useCallback(() => {
    try {
      const { color, size, sensitivity, position } = blobSettings;
      localStorage.setItem('blobSettings', JSON.stringify({
        color,
        size,
        sensitivity,
        position
      }));
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save blob settings:', error);
      alert('Failed to save settings. Please check your browser storage permissions.');
    }
  }, [blobSettings]);

  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem('blobSettings');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (blobSettings.isDraggable) {
      setIsDragging(true);
    }
  }, [blobSettings.isDraggable]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && blobSettings.isDraggable) {
      const x = (e.clientX / window.innerWidth) * 100;
      const rawY = (e.clientY / window.innerHeight) * 100;
      // Prevent blob from being dragged too high into the navbar area (min 15%)
      const y = Math.max(15, rawY); 
      setBlobSettings(prev => ({ ...prev, position: { x, y } }));
    }
  }, [isDragging, blobSettings.isDraggable]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <>
      {isLoading && <SplashScreen onComplete={() => setIsLoading(false)} />}
      <div
        className={`app-container ${isLoading ? 'hidden' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Navbar
          blobSettings={blobSettings}
          setBlobSettings={setBlobSettings}
          onSave={handleSave}
          onReset={handleReset}
          showHero={showHero}
        />
        
        <main className="main-content">
          <section className="hero-section">
            <div className={`glass-panel ${!showHero ? 'fade-out-hero' : ''}`}>
              <h1 className="hero-title">J.A.R.V.I.S</h1>
              <p className="hero-subtitle">Just A Rather Very Intelligent System</p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <div style={{ height: '2px', width: '50px', background: 'var(--fire-gradient)', margin: 'auto 0' }}></div>
                <span style={{ fontSize: '0.8rem', letterSpacing: '2px', color: 'var(--fire-yellow)' }}>NEURAL INTERFACE ACTIVE</span>
                <div style={{ height: '2px', width: '50px', background: 'var(--fire-gradient)', margin: 'auto 0' }}></div>
              </div>
            </div>
          </section>
        </main>

        <div
          className={`blob-wrapper ${showHero ? 'hidden' : ''}`}
          onMouseDown={handleMouseDown}
          style={{
            left: `${blobSettings.position.x}%`,
            top: `${blobSettings.position.y}%`,
            transform: `translate(-50%, -50%) scale(${blobSettings.size})`,
            cursor: blobSettings.isDraggable ? 'move' : 'default',
            userSelect: 'none'
          }}
        >
          <FireAIBlob
            color={blobSettings.color}
            sensitivity={blobSettings.sensitivity}
          />
        </div>
        
        <img src={background} className="bg-image" alt="Background" aria-hidden="true" />
      </div>
    </>
  );
}

export default App;


