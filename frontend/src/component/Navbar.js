import React, { useState } from 'react';
import './Navbar.css';

const Navbar = ({ blobSettings, setBlobSettings, onSave, onReset }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <nav className="navbar">
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
        <li className="nav-item">
          <button 
            className="nav-link settings-trigger" 
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </button>
          
          {showSettings && (
            <div className="settings-panel">
              <h3 className="settings-title">Blob Customization</h3>
              
              <div className="settings-group">
                <label>Color</label>
                <input 
                  type="color" 
                  value={blobSettings.color} 
                  onChange={(e) => setBlobSettings({...blobSettings, color: e.target.value})}
                />
              </div>

              <div className="settings-group">
                <label>Size</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  step="0.1" 
                  value={blobSettings.size} 
                  onChange={(e) => setBlobSettings({...blobSettings, size: parseFloat(e.target.value)})}
                />
              </div>

              <div className="settings-group">
                <label>Sensitivity</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="5" 
                  step="0.1" 
                  value={blobSettings.sensitivity} 
                  onChange={(e) => setBlobSettings({...blobSettings, sensitivity: parseFloat(e.target.value)})}
                />
              </div>

              <div className="settings-group">
                <label>Enable Drag</label>
                <input 
                  type="checkbox" 
                  checked={blobSettings.isDraggable} 
                  onChange={(e) => setBlobSettings({...blobSettings, isDraggable: e.target.checked})}
                />
              </div>


              <div className="settings-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-save" style={{ flex: 1 }} onClick={onSave}>
                  Save
                </button>
                <button 
                  className="btn-save" 
                  style={{ flex: 1, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)' }} 
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
        <button className="btn-launch">
          Initialize
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

