import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Navbar.css';

const Navbar = ({ blobSettings, setBlobSettings, onSave, onReset, showHero, isListening, onInitialize, onStop }) => {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  useEffect(() => {
    if (showSettings) {
      onStop();
      setBlobSettings(prev => ({ ...prev, position: { x: 90, y: 80 } }));
    } else {
      setBlobSettings(prev => ({ ...prev, position: { x: 50, y: 50 } }));
    }
  }, [showSettings, onStop, setBlobSettings]);


  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const updateSetting = useCallback((key, value) => {
    setBlobSettings(prev => ({ ...prev, [key]: value }));
  }, [setBlobSettings]);

  const handleToggle = () => {
    if (isListening) {
      onStop();
    } else {
      onInitialize();
    }
  };

  return (
    <nav className={`navbar ${showHero ? 'hidden' : ''}`}>
      <div className="nav-logo">
        J.A.R.V.I.S
      </div>
      
      <ul className="nav-links">
        <li className="nav-item">
          <a href="#home" className="nav-link">Home</a>
        </li>
        <li className="nav-item">
          <a href="#features" className="nav-link">Core</a>
        </li>
        <li className="nav-item">
          <a href="#nexus" className="nav-link">Nexus</a>
        </li>
        <li className="nav-item" ref={settingsRef}>
          <button 
            className="nav-link settings-trigger" 
            onClick={toggleSettings}
            aria-expanded={showSettings}
          >
            Settings
          </button>
          
          {showSettings && (
            <div className="settings-panel">
              <h3 className="settings-title">Blob Customization</h3>
              
              <div className="settings-group">
                <label htmlFor="color-picker">Color</label>
                <input 
                  id="color-picker"
                  type="color" 
                  value={blobSettings.color} 
                  onChange={(e) => updateSetting('color', e.target.value)}
                />
              </div>

              <div className="settings-group">
                <div className="label-with-value">
                  <label htmlFor="size-range">Size</label>
                  <span className="setting-value">{blobSettings.size.toFixed(1)}</span>
                </div>
                <input 
                  id="size-range"
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.1" 
                  value={blobSettings.size} 
                  onChange={(e) => updateSetting('size', parseFloat(e.target.value))}
                />
              </div>

              <div className="settings-group">
                <div className="label-with-value">
                  <label htmlFor="sensitivity-range">Sensitivity</label>
                  <span className="setting-value">{blobSettings.sensitivity.toFixed(1)}</span>
                </div>
                <input 
                  id="sensitivity-range"
                  type="range" 
                  min="0.1" 
                  max="5" 
                  step="0.1" 
                  value={blobSettings.sensitivity} 
                  onChange={(e) => updateSetting('sensitivity', parseFloat(e.target.value))}
                />
              </div>

              <hr className="settings-divider" />

              <div className="settings-row">
                <label htmlFor="drag-toggle">Enable Drag Interface</label>
                <input 
                  id="drag-toggle"
                  type="checkbox" 
                  checked={blobSettings.isDraggable} 
                  onChange={(e) => updateSetting('isDraggable', e.target.checked)}
                />
              </div>


              <div className="settings-actions">
                <button className="btn-save" onClick={onSave}>
                  Save
                </button>
                <button 
                  className="btn-reset" 
                  onClick={onReset}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </li>
      </ul>

      <div className="nav-actions">
        <button className={`btn-launch ${isListening ? 'listening' : ''}`} onClick={handleToggle}>
          {isListening ? 'Stop' : 'Initialize'}
        </button>
      </div>
    </nav>
  );
};


export default Navbar;

