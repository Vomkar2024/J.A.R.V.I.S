import React from 'react';
import './css/VoiceControl.css';

/**
 * VoiceControl Component
 * This component is responsible for showing the user what they are saying
 * in real-time. It acts like a "Subtitle" box for your voice.
 */
const VoiceControl = ({ transcript, isSupported }) => {
  // If the browser doesn't support voice features, we show nothing
  if (!isSupported) return null;

  return (
    <div className="voice-control-container">
      {/* If there is a transcript (user is speaking), show the text box */}
      {transcript && (
        <div className="transcript-overlay">
          <p className="transcript-text">{transcript}</p>
        </div>
      )}
    </div>
  );
};


export default VoiceControl;
