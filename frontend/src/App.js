import React, { useState, useEffect, useCallback, useRef } from 'react';
import background from './img/background.jpeg';
import './App.css';

// Components
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './backend/core/VoiceControl';
import BrainTerminal from './backend/core/BrainTerminal';
import PuterStatus from './component/PuterStatus';
import SystemAlert from './component/SystemAlert';
import SystemStatus from './component/SystemStatus';

// Hooks
import { useSpeech } from './backend/hooks/useSpeech';
import { useBrain } from './backend/hooks/useBrain';

/**
 * DEFAULT_SETTINGS
 * Initial values for the AI's appearance.
 */
const DEFAULT_SETTINGS = {
  color: '#ff6b00', 
  size: 0.8,
  sensitivity: 0.7,
  position: { x: 50, y: 50 },
  isDraggable: false
};

/**
 * J.A.R.V.I.S - Core Application
 * 
 * Main controller that orchestrates:
 * - Voice Input (useSpeech)
 * - AI Logic (useBrain)
 * - UI Components (Navbar, Terminals, Status)
 */
function App() {
  // --- State ---
  const [blobSettings, setBlobSettings] = useState(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHero, setShowHero] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [alert, setAlert] = useState({ message: '', isVisible: false });

  // --- Refs ---
  const lastProcessedTextRef = useRef('');

  const {
    translationData,
    aiResponse,
    isThinking,
    isProcessing,
    showTerminal,
    setShowTerminal,
    translateText
  } = useBrain(lastProcessedTextRef);

  // --- Custom Hooks ---
  const onAudioBlobReady = useCallback((blob) => {
    translateText(null, blob);
  }, [translateText]);

  const {
    isListening,
    volume,
    isSupported: isSpeechSupported,
    permissionGranted,
    startSpeech,
    stopSpeech
  } = useSpeech(setTranscript, onAudioBlobReady);

  // --- System Initialization ---
  
  // Load settings from persistent storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ 
          ...prev, 
          ...parsed, 
          isDraggable: false // Always start non-draggable for stability
        }));
      }
    } catch (error) {
      console.warn('System Memory: Failed to load user config', error);
    }
  }, []);

  // Debounced translation trigger
  useEffect(() => {
    if (transcript) {
      const timer = setTimeout(() => translateText(transcript), 800);
      return () => clearTimeout(timer);
    } else {
      setShowTerminal(false);
    }
  }, [transcript, translateText, setShowTerminal]);

  // Handle hero screen transition
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowHero(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // --- Interaction Handlers ---
  
  const handleSplashComplete = useCallback(() => setIsLoading(false), []);

  const handleInitialize = useCallback(async () => {
    try {
      const success = await startSpeech();
      if (success) {
        setAlert({ message: 'Neural Link Established', isVisible: true });
      } else {
        setAlert({ message: 'Neural Link Failed: Check Permissions', isVisible: true });
      }
    } catch (error) {
      console.error('System Crash during initialization:', error);
    }
  }, [startSpeech]);

  const handleStop = useCallback(() => {
    stopSpeech();
    setTranscript('');
    setShowTerminal(false);
  }, [stopSpeech, setShowTerminal]);

  const handleSave = useCallback(() => {
    localStorage.setItem('blobSettings', JSON.stringify(blobSettings));
    setAlert({ message: 'Memory Updated', isVisible: true });
  }, [blobSettings]);

  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    setAlert({ message: 'All settings are reset', isVisible: true });
    localStorage.removeItem('blobSettings');
  }, []);

  const handleAlertComplete = useCallback(() => {
    setAlert(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Mouse Interactivity for Blob
  const handleMouseDown = useCallback(() => { 
    if (blobSettings.isDraggable) setIsDragging(true); 
  }, [blobSettings.isDraggable]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && blobSettings.isDraggable) {
      setBlobSettings(prev => ({ 
        ...prev, 
        position: { 
          x: (e.clientX / window.innerWidth) * 100, 
          y: Math.max(15, (e.clientY / window.innerHeight) * 100) 
        } 
      }));
    }
  }, [isDragging, blobSettings.isDraggable]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <>
      {isLoading && <SplashScreen onComplete={handleSplashComplete} />}
      
      <div 
        className={`app-container ${isLoading ? 'hidden' : ''}`} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp}
      >
        <Navbar 
          blobSettings={blobSettings} 
          setBlobSettings={setBlobSettings} 
          onSave={handleSave} 
          onReset={handleReset} 
          showHero={showHero} 
          isListening={isListening} 
          onInitialize={handleInitialize} 
          onStop={handleStop} 
        />

        <Hero showHero={showHero} />

        <div 
          className={`blob-wrapper ${showHero ? 'hidden' : ''} ${isDragging ? 'dragging' : ''}`} 
          onMouseDown={handleMouseDown} 
          style={{ 
            left: `${blobSettings.position.x}%`, 
            top: `${blobSettings.position.y}%`, 
            transform: `translate(-50%, -50%) scale(${blobSettings.size})` 
          }}
        >
          <FireAIBlob 
            color={blobSettings.color} 
            sensitivity={blobSettings.sensitivity} 
            volume={volume} 
          />
        </div>

        {!showHero && <VoiceControl transcript={transcript} isSupported={isSpeechSupported} />}
        
        <SystemStatus 
          isListening={isListening}
          isProcessing={isProcessing}
          isSupported={isSpeechSupported}
          permissionGranted={permissionGranted}
          showHero={showHero}
        />
        
        <BrainTerminal 
          aiResponse={aiResponse} 
          isThinking={isThinking} 
          translationData={translationData} 
          isVisible={showTerminal} 
        />

        <PuterStatus isProcessing={isProcessing} />

        <SystemAlert 
          message={alert.message} 
          isVisible={alert.isVisible} 
          onComplete={handleAlertComplete} 
        />

        <img src={background} className="bg-image" alt="System Background" />
      </div>
    </>
  );
}

export default App;
