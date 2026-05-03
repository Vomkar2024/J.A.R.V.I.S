import React, { useState, useEffect } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';

function App() {
  const [blobSettings, setBlobSettings] = useState({
    color: '#ff6b00', // Scorching fire orange
    size: 0.8,
    sensitivity: 25,
    position: { x: 50, y: 50 },
    isDraggable: false
  });

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('blobSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setBlobSettings(prev => ({ ...prev, ...parsed, isDraggable: false }));
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('blobSettings', JSON.stringify({
      color: blobSettings.color,
      size: blobSettings.size,
      sensitivity: blobSettings.sensitivity,
      position: blobSettings.position
    }));
    alert('Settings saved!');
  };

  const handleReset = () => {
    const defaultSettings = {
      color: '#ff6b00',
      size: 0.8,
      sensitivity: 1.5,
      position: { x: 50, y: 50 },
      isDraggable: false
    };
    setBlobSettings(defaultSettings);
    localStorage.removeItem('blobSettings');
  };

  const handleMouseDown = (e) => {
    if (blobSettings.isDraggable) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && blobSettings.isDraggable) {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setBlobSettings(prev => ({ ...prev, position: { x, y } }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="app-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Navbar
        blobSettings={blobSettings}
        setBlobSettings={setBlobSettings}
        onSave={handleSave}
        onReset={handleReset}
      />
      <div
        className="blob-wrapper"
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
          size={blobSettings.size}
          sensitivity={blobSettings.sensitivity}
          isDraggable={blobSettings.isDraggable}
          onPositionChange={(pos) => setBlobSettings(prev => ({ ...prev, position: pos }))}
        />

      </div>
      <img src={background} className="bg-image" alt="" aria-hidden="true" />
    </div>
  );
}


export default App;


