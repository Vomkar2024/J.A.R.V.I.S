import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Navbar.css';

/**
 * Navbar Component
 * This is the top navigation bar of the app. It contains the logo,
 * the main links, and the settings menu where you can customize the AI.
 */
const Navbar = ({ blobSettings, setBlobSettings, onSave, onReset, showHero, isListening, onInitialize, onStop }) => {
  // State to track if the settings menu is open or closed
  const [showSettings, setShowSettings] = useState(false);
  // Reference to the settings panel to detect clicks outside of it
  const settingsRef = useRef(null);

  /**
   * Click Outside Logic
   * If the user clicks anywhere else on the screen while the settings menu
   * is open, this function will automatically close it.
   */
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

  /**
   * Position Adjustment
   * When the settings menu opens, we move the AI blob to the corner
   * so it doesn't block the menu. When it closes, we move it back.
   */
  useEffect(() => {
    if (showSettings) {
      onStop(); // Stop listening while adjusting settings
      setBlobSettings(prev => ({ ...prev, position: { x: 90, y: 80 } }));
    } else {
      setBlobSettings(prev => ({ ...prev, position: { x: 50, y: 50 } }));
    }
  }, [showSettings, onStop, setBlobSettings]);


  /**
   * toggleSettings
   * Opens or closes the settings panel.
   */
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  /**
   * updateSetting
   * Updates a specific value (like color or size) in the AI blob's memory.
   */
  const updateSetting = useCallback((key, value) => {
    setBlobSettings(prev => ({ ...prev, [key]: value }));
  }, [setBlobSettings]);

  /**
   * handleToggle
   * Starts or stops the voice recognition system.
   */
  const handleToggle = () => {
    if (isListening) {
      onStop();
    } else {
      onInitialize();
    }
  };

  return (
    <nav className={`navbar ${showHero ? 'hidden' : ''}`}>
      {/* The Brand Name */}
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
        
        {/* Settings Menu Button and Panel */}
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
              
              {/* Color Control */}
              <div className="settings-group">
                <label htmlFor="color-picker">Color</label>
                <input 
                  id="color-picker"
                  type="color" 
                  value={blobSettings.color} 
                  onChange={(e) => updateSetting('color', e.target.value)}
                />
              </div>

              {/* Size Control */}
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

              {/* Sensitivity Control (Voice Reactivity) */}
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

              {/* Drag Mode Toggle */}
              <div className="settings-row">
                <label htmlFor="drag-toggle">Enable Drag Interface</label>
                <input 
                  id="drag-toggle"
                  type="checkbox" 
                  checked={blobSettings.isDraggable} 
                  onChange={(e) => updateSetting('isDraggable', e.target.checked)}
                />
              </div>


              {/* Save and Reset Buttons */}
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

      {/* Initialize / Stop Button */}
      <div className="nav-actions">
        <button className={`btn-launch ${isListening ? 'listening' : ''}`} onClick={handleToggle}>
          {isListening ? 'Stop' : 'Initialize'}
        </button>
      </div>
    </nav>
  );
};


export default Navbar;

