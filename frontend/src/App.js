import React, { useState, useEffect, useCallback, useRef } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './component/VoiceControl';

/**
 * DEFAULT_SETTINGS
 * These are the initial values for the AI's appearance.
 * - color: The visual color of the AI (fire orange).
 * - size: How big the AI appears on screen.
 * - sensitivity: How much the AI reacts to your voice.
 * - position: Where the AI is placed (center of the screen).
 */
const DEFAULT_SETTINGS = {
  color: '#ff6b00', 
  size: 0.8,
  sensitivity: 0.7,
  position: { x: 50, y: 50 },
  isDraggable: false
};

/**
 * App Function
 * This is the main "brain" of the application. It connects all the pieces together:
 * the voice control, the visual AI blob, and the user interface.
 */
function App() {
  // --- State Management (The App's Memory) ---

  // Stores the current look and position of the AI blob
  const [blobSettings, setBlobSettings] = useState(DEFAULT_SETTINGS);
  // Tracks if the user is currently moving the AI blob with their mouse
  const [isDragging, setIsDragging] = useState(false);
  // Controls the initial "Loading" screen
  const [isLoading, setIsLoading] = useState(true);
  // Controls the "Hero" welcome message display
  const [showHero, setShowHero] = useState(true);
  
  // Tracks the loudness of the user's voice (0 to 1)
  const [volume, setVolume] = useState(0);
  // Tracks if the app is currently listening to the microphone
  const [isListening, setIsListening] = useState(false);
  // Stores the text of what the user is saying
  const [transcript, setTranscript] = useState('');
  // Checks if the user's browser supports voice-to-text
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // --- Technical References (Tools the App uses behind the scenes) ---
  const audioContextRef = useRef(null);   // For processing sound
  const analyserRef = useRef(null);       // For measuring volume
  const recognitionRef = useRef(null);    // For converting speech to text
  const animationFrameRef = useRef(null); // For smooth visual updates
  const isListeningRef = useRef(false);   // A helper to track listening state accurately

  // Syncs the listening state for internal functions
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  /**
   * Initialization Logic
   * This runs once when the app first opens. 
   * It loads saved settings and sets up the voice-to-text system.
   */
  useEffect(() => {
    // 1. Try to load previously saved settings from the browser's memory
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ 
          ...prev, 
          ...parsed, 
          isDraggable: false // Reset dragging to 'off' for safety on reload
        }));
      }
    } catch (error) {
      console.error('Failed to load blob settings:', error);
    }

    // 2. Setup the Voice Recognition system
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;     // Keep listening even if user pauses
      recognition.interimResults = true; // Show text as the user is speaking
      recognition.lang = 'en-US';        // Language set to English

      // This function triggers whenever the user speaks
      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript); // Save the text to display it
      };

      // Restarts listening if it accidentally stops
      recognition.onend = () => {
        if (isListeningRef.current) recognition.start();
      };

      recognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false); // Tell the user if their browser is too old
    }

    // Cleanup: Stop everything when the app closes
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  /**
   * Transition Logic
   * Once the app loads, it waits 5 seconds then hides the welcome message.
   */
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowHero(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  /**
   * handleSplashComplete
   * Called when the splash screen finishes its animation.
   */
  const handleSplashComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  /**
   * startAudio Function
   * This activates the microphone and starts measuring sound levels
   * to make the AI blob dance/react to your voice.
   */
  const startAudio = useCallback(async () => {
    try {
      // Request permission to use the microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup the audio processing "pipe"
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let smoothedVolume = 0;
      
      /**
       * updateVolume
       * This runs 60 times a second to check how loud the user is speaking.
       */
      const updateVolume = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        let max = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          if (dataArray[i] > max) max = dataArray[i];
        }
        const average = sum / bufferLength;
        // Formula to calculate "reactive" volume for the AI visual
        const reactiveVolume = (average * 0.7 + max * 0.3) / 128;
        
        // Smoothing the movement so the AI doesn't jitter too much
        smoothedVolume = (smoothedVolume * 0.8) + (reactiveVolume * 0.2);
        setVolume(smoothedVolume); 
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      
      // Start the voice-to-text engine
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access is required for voice features.');
    }
  }, []);

  /**
   * stopAudio Function
   * Turns off the microphone and resets the voice text.
   */
  const stopAudio = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setVolume(0);
    setTranscript('');
  }, []);

  /**
   * handleSave Function
   * Remembers your custom AI settings (color, size, etc.) even after you close the browser.
   */
  const handleSave = useCallback(() => {
    try {
      const { color, size, sensitivity, position } = blobSettings;
      localStorage.setItem('blobSettings', JSON.stringify({
        color,
        size,
        sensitivity,
        position
      }));
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please check your storage permissions.');
    }
  }, [blobSettings]);

  /**
   * handleReset Function
   * Returns everything to the original "Fire Orange" theme.
   */
  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem('blobSettings');
    } catch (error) {
      console.error('Failed to clear memory:', error);
    }
  }, []);

  /**
   * handleMouseDown / handleMouseMove / handleMouseUp
   * These functions allow you to click and drag the AI blob around the screen
   * when "Drag Mode" is enabled in the settings.
   */
  const handleMouseDown = useCallback((e) => {
    if (blobSettings.isDraggable) {
      setIsDragging(true);
    }
  }, [blobSettings.isDraggable]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && blobSettings.isDraggable) {
      const x = (e.clientX / window.innerWidth) * 100;
      const rawY = (e.clientY / window.innerHeight) * 100;
      // Prevent dragging the AI too high into the menu bar
      const y = Math.max(15, rawY); 
      setBlobSettings(prev => ({ ...prev, position: { x, y } }));
    }
  }, [isDragging, blobSettings.isDraggable]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Rendering (The visual structure of the App) ---
  return (
    <>
      {/* 1. Show the Loading Screen if still loading */}
      {isLoading && <SplashScreen onComplete={handleSplashComplete} />}
      
      <div
        className={`app-container ${isLoading ? 'hidden' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* 2. The Top Navigation Bar & Settings Menu */}
        <Navbar
          blobSettings={blobSettings}
          setBlobSettings={setBlobSettings}
          onSave={handleSave}
          onReset={handleReset}
          showHero={showHero}
          isListening={isListening}
          onInitialize={startAudio}
          onStop={stopAudio}
        />
        
        {/* 3. The Welcome Message (Hero Section) */}
        <Hero showHero={showHero} />

        {/* 4. The Interactive AI Blob */}
        <div
          className={`blob-wrapper ${showHero ? 'hidden' : ''} ${isDragging ? 'dragging' : ''}`}
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
            sensitivity={blobSettings.sensitivity}
            volume={volume}
          />
        </div>

        {/* 5. The Voice Feedback (Shows what you are saying) */}
        {!showHero && (
          <VoiceControl 
            transcript={transcript} 
            isSupported={isSpeechSupported}
          />
        )}
        
        {/* 6. The Background Image */}
        <img src={background} className="bg-image" alt="Background" aria-hidden="true" />
      </div>
    </>
  );
}

export default App;


