import React, { useState, useEffect, useCallback, useRef } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './component/VoiceControl';
import TranslationTerminal from './component/TranslationTerminal';
import PuterStatus from './component/PuterStatus';
import './component/TranslationTerminal.css';
import './component/PuterStatus.css';

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
  
  // Translation State
  const [translationData, setTranslationData] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const translationTimeoutRef = useRef(null);

  // --- Technical References (Tools the App uses behind the scenes) ---
  const audioContextRef = useRef(null);   // For processing sound
  const analyserRef = useRef(null);       // For measuring volume
  const recognitionRef = useRef(null);    // For converting speech to text
  const animationFrameRef = useRef(null); // For smooth visual updates
  const isListeningRef = useRef(false);   
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isProcessingRef = useRef(false);// A helper to track listening state accurately

  // Syncs the listening state for internal functions
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  /**
   * Initialization Logic: Load saved settings
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ 
          ...prev, 
          ...parsed, 
          isDraggable: false 
        }));
      }
    } catch (error) {
      console.error('Failed to load blob settings:', error);
    }
  }, []);

  /**
   * Recognition Logic: Setup and handle language changes
   */
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      // Stop existing recognition if it exists
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Recognition already stopped');
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Use browser default or 'en-US' as baseline; translation API will handle detection
      recognition.lang = 'en-US'; 


      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            // Optional: Handle final results differently if needed
          }
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Handle restart errors silently or log them
          }
        }
      };
      recognitionRef.current = recognition;

      // If we were already listening, restart with the new language
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to start recognition after language change:', e);
        }
      }

    } else {
      setIsSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []); // Remove dependency on blobSettings.language

  /**
   * translateText Function
   * Uses a free translation bridge to detect and translate non-English speech.
   */
  const translateText = useCallback(async (text, audioBlob = null) => {
    if ((!text || text.trim().length < 3) && !audioBlob) return;

    try {
      // If we have an audio blob, use Puter.js for high-quality universal transcription/translation
      if (audioBlob && window.puter) {
        setIsProcessing(true);
        
        const result = await window.puter.ai.speech2txt({
          file: audioBlob,
          model: 'gpt-4o-transcribe',
          translate: true
        });

        if (result && result.text) {
          // Puter returns detected language and translated text
          setTranslationData({
            originalText: text || "Neural Detection Active",
            translatedText: result.text,
            detectedLang: "UNIVERSAL AI"
          });
          setShowTerminal(true);
        }
        setIsProcessing(false);
        return;
      }

      // Fallback to basic translation if Puter is not available or no blob
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data[0]) {
        const translated = data[0].map(item => item[0]).join('');
        const detectedLang = data[2];

        if (detectedLang && detectedLang !== 'en' && detectedLang !== 'en-US') {
          setTranslationData({
            originalText: text,
            translatedText: translated,
            detectedLang: detectedLang.toUpperCase()
          });
          setShowTerminal(true);
        } else {
          setShowTerminal(false);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      setIsProcessing(false);
    }
  }, []);

  /**
   * Effect to trigger translation with debouncing
   */
  useEffect(() => {
    if (transcript) {
      if (translationTimeoutRef.current) clearTimeout(translationTimeoutRef.current);
      
      translationTimeoutRef.current = setTimeout(() => {
        translateText(transcript);
      }, 500); // 500ms debounce to avoid excessive API calls
    } else {
      setShowTerminal(false);
    }
  }, [transcript, translateText]);

  /**
   * Animation cleanup
   */
  useEffect(() => {
    return () => {
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
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      source.connect(analyserRef.current);

      // --- Setup MediaRecorder for Puter.js ---
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        // Process the final audio with Puter.js
        if (audioChunksRef.current.length > 0) {
          translateText(null, audioBlob);
        }
        audioChunksRef.current = [];
      };

      // Start recording in chunks
      recorder.start(5000); // Record in 5s segments for processing
      mediaRecorderRef.current = recorder;

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
        // Boost lower volumes using square root and a higher multiplier
        const normalizedVolume = (average * 0.7 + max * 0.3) / 128;
        const boostedVolume = Math.sqrt(normalizedVolume) * 1.5;
        
        // Slightly faster smoothing for better responsiveness
        smoothedVolume = (smoothedVolume * 0.7) + (boostedVolume * 0.3);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setVolume(0);
    setTranscript('');
    setShowTerminal(false);
  }, []);

  /**
   * handleSave Function
   * Remembers your custom AI settings (color, size, etc.) even after you close the browser.
   */
  const handleSave = useCallback(() => {
    try {
      const { color, size, sensitivity, position, language } = blobSettings;
      localStorage.setItem('blobSettings', JSON.stringify({
        color,
        size,
        sensitivity,
        position,
        language
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

        {/* 7. The Translation Terminal (Shows when non-English is detected) */}
        <TranslationTerminal 
          translationData={translationData}
          isVisible={showTerminal}
        />

        {/* 8. Puter.js Status Indicator */}
        <PuterStatus isProcessing={isProcessing} />
        
        {/* 6. The Background Image */}
        <img src={background} className="bg-image" alt="Background" aria-hidden="true" />
      </div>
    </>
  );
}

export default App;


