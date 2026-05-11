import React, { useState, useEffect, useCallback } from 'react';
import background from './img/background.jpeg';
import './App.css';

// Components
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './component/VoiceControl';
import BrainTerminal from './component/BrainTerminal';
import NeuralEngineStatus from './component/PuterStatus';
import SystemAlert from './component/SystemAlert';
import SystemStatus from './component/SystemStatus';

// Constants
import { HERO_TIMEOUT, ALERTS } from './constants';

// Hooks
import { useSpeech } from './hooks/useSpeech';
import { useBrain } from './hooks/useBrain';

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
 * - Voice Input (useSpeech) — real-time browser speech recognition
 * - AI Logic (useBrain) — WebSocket streaming to backend
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
  const [hudForceExpand, setHudForceExpand] = useState(false);

  // --- Brain Hook (WebSocket) ---
  const {
    aiResponse,
    streamingText,
    isThinking,
    isSpeaking,
    isBackendConnected,
    pipelineState,
    activeTool,
    conversationHistory,
    telemetry,
    sendMessage,
    clearHistory
  } = useBrain();

  // --- Speech Hook ---
  const onFinalTranscript = useCallback((text) => {
    if (text && text.trim().length > 2) {
      sendMessage(text);
    }
  }, [sendMessage]);

  const {
    isListening,
    volume,
    isSupported: isSpeechSupported,
    permissionGranted,
    startSpeech,
    stopSpeech
  } = useSpeech(setTranscript, onFinalTranscript, isSpeaking);

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

  // Handle hero screen transition
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowHero(false), HERO_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // --- Interaction Handlers ---
  
  const handleSplashComplete = useCallback(() => setIsLoading(false), []);

  const handleInitialize = useCallback(async () => {
    try {
      // Initialize AudioContext on user gesture to prevent blocking
      const TTSService = (await import('./services/TTSService')).default;
      TTSService.getAudioContext();
      
      const success = await startSpeech();
      if (success) {
        setAlert({ message: ALERTS.LINK_ESTABLISHED, isVisible: true });
        
        // CINEMATIC SEQUENCE: Expand HUD and trigger greeting
        setHudForceExpand(true);
        
        setTimeout(() => {
          sendMessage("Hello Jarvis. Run system greeting.");
          // Retract HUD after a few seconds of being fully initialized
          setTimeout(() => setHudForceExpand(false), 5000);
        }, 1000);
      } else {
        setAlert({ message: ALERTS.LINK_FAILED, isVisible: true });
      }
    } catch (error) {
      console.error('System Crash during initialization:', error);
    }
  }, [startSpeech, sendMessage]);

  const handleStop = useCallback(() => {
    stopSpeech();
    setTranscript('');
  }, [stopSpeech]);

  const handleSave = useCallback(() => {
    localStorage.setItem('blobSettings', JSON.stringify(blobSettings));
    setAlert({ message: ALERTS.MEMORY_UPDATED, isVisible: true });
  }, [blobSettings]);

  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    setAlert({ message: ALERTS.SETTINGS_RESET, isVisible: true });
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

  // Determine if terminal should show
  const showTerminal = isThinking || streamingText || aiResponse || conversationHistory.length > 0;

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
          onClearHistory={clearHistory}
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
            pipelineState={pipelineState}
          />
        </div>

        {!showHero && (
          <VoiceControl 
            transcript={transcript} 
            isSupported={isSpeechSupported}
            isListening={isListening}
            pipelineState={pipelineState}
          />
        )}
        
        <SystemStatus 
          isListening={isListening}
          isThinking={isThinking}
          isSpeaking={isSpeaking}
          isSupported={isSpeechSupported}
          permissionGranted={permissionGranted}
          showHero={showHero}
          isBackendConnected={isBackendConnected}
          pipelineState={pipelineState}
          activeTool={activeTool}
          telemetry={telemetry}
          forceExpand={hudForceExpand}
        />
        
        <BrainTerminal 
          streamingText={streamingText}
          aiResponse={aiResponse} 
          isThinking={isThinking} 
          conversationHistory={conversationHistory}
          isVisible={showTerminal && !showHero}
          pipelineState={pipelineState}
          activeTool={activeTool}
          onSendMessage={sendMessage}
        />

        <NeuralEngineStatus isProcessing={isThinking || isSpeaking} />

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
