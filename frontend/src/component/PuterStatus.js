import React from 'react';
import './css/PuterStatus.css';

/**
 * NeuralEngineStatus Component
 * Displays a small, futuristic indicator when J.A.R.V.I.S is processing data.
 */
const NeuralEngineStatus = ({ isProcessing }) => {
  if (!isProcessing) return null;

  return (
    <div className="neural-engine-status">
      <div className="engine-orb"></div>
      <span className="engine-label">NEURAL ENGINE ACTIVE</span>
      <div className="engine-bar">
        <div className="engine-progress"></div>
      </div>
    </div>
  );
};

export default NeuralEngineStatus;
