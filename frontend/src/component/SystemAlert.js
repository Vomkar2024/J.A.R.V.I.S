import React, { useEffect, useState } from 'react';
import './css/SystemAlert.css';

/**
 * SystemAlert Component
 * Displays a sleek, temporary message at the bottom center of the screen.
 */
const SystemAlert = ({ message, isVisible, onComplete }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        if (onComplete) onComplete();
      }, 3000); // Alert lasts for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!shouldRender) return null;

  return (
    <div className="system-alert-wrapper">
      <div className="system-alert">
        <div className="alert-glow"></div>
        <span className="alert-icon">⚡</span>
        <span className="alert-text">{message}</span>
        <div className="alert-progress-bar"></div>
      </div>
    </div>
  );
};

export default SystemAlert;
