import React from 'react';
import './VoiceControl.css';

const VoiceControl = ({ transcript, isSupported }) => {
  if (!isSupported) return null;

  return (
    <div className="voice-control-container">
      {transcript && (
        <div className="transcript-overlay">
          <p className="transcript-text">{transcript}</p>
        </div>
      )}
    </div>
  );
};


export default VoiceControl;
