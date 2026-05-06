import React from 'react';
import 'component/css/PuterStatus.css';

/**
 * PuterStatus Component
 * Displays a small, futuristic indicator when the Puter.js AI is processing speech.
 */
const PuterStatus = ({ isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="puter-status">
      <div className="status-orb"></div>
      <span className="status-label">NEURAL ENGINE ACTIVE</span>
      <div className="loading-bar">
        <div className="bar-progress"></div>
      </div>
    </div>
  );
};

export default PuterStatus;
