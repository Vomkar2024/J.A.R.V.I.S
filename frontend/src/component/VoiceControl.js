import React from 'react';
import './css/VoiceControl.css';

/**
 * VoiceControl Component
 * Shows real-time voice transcript with listening animation.
 * Acts as a "subtitle" overlay for the user's voice.
 */
const VoiceControl = ({ transcript, isSupported, isListening, pipelineState }) => {
  // If the browser doesn't support voice features, show nothing
  if (!isSupported) return null;

  return (
    <div className="voice-control-container">
      {/* Listening indicator */}
      {isListening && !transcript && (
        <div className="listening-indicator">
          <div className="listening-waves">
            <span className="wave"></span>
            <span className="wave"></span>
            <span className="wave"></span>
          </div>
          <span className="listening-text">Listening...</span>
        </div>
      )}

      {/* Live transcript overlay */}
      {transcript && (
        <div className="transcript-overlay">
          <div className="transcript-label">
            <span className="mic-icon">🎤</span>
            <span className="label-text">VOICE INPUT</span>
            <span className="live-dot"></span>
          </div>
          <p className="transcript-text">{transcript}</p>
        </div>
      )}

      {/* Pipeline state indicator */}
      {pipelineState === 'thinking' && (
        <div className="pipeline-indicator thinking">
          <span className="pipeline-text">Processing your request...</span>
        </div>
      )}
      {pipelineState === 'speaking' && (
        <div className="pipeline-indicator speaking">
          <span className="pipeline-text">J.A.R.V.I.S is speaking...</span>
        </div>
      )}
    </div>
  );
};

export default VoiceControl;
