import React, { useState, useEffect, useCallback, useRef } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './component/VoiceControl';
import BrainTerminal from './component/BrainTerminal';
import PuterStatus from './component/PuterStatus';
import SystemAlert from './component/SystemAlert';
import SystemStatus from './component/SystemStatus';
import GroqService from './services/GroqService';
import TTSService from './services/TTSService';
import './component/BrainTerminal.css';
import './component/PuterStatus.css';
import './component/SystemAlert.css';
import './component/SystemStatus.css';

/**
 * DEFAULT_SETTINGS
 * These are the initial values for the AI's appearance.
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
 * This is the main "brain" of the application.
 */
function App() {
  // --- State Management ---
  const [blobSettings, setBlobSettings] = useState(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHero, setShowHero] = useState(true);
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  
  // Brain & Translation State
  const [translationData, setTranslationData] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [alert, setAlert] = useState({ message: '', isVisible: false });

  // Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recognitionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isListeningRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const lastProcessedTextRef = useRef('');

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Load settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ ...prev, ...parsed, isDraggable: false }));
      }
    } catch (error) {
      console.error('Failed to load blob settings:', error);
    }
  }, []);

  /**
   * Initialization Logic: Check microphone permissions
   */
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
        setPermissionGranted(result.state === 'granted');
        result.onchange = () => {
          setPermissionGranted(result.state === 'granted');
        };
      });
    }
  }, []);

  // Setup Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; 

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };
      recognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false);
    }
  }, []);

  /**
   * handleBrainInteraction
   * Processes the text with Groq AI and speaks back.
   */
  const handleBrainInteraction = useCallback(async (text) => {
    if (!text || text.trim().length < 4 || text === lastProcessedTextRef.current) return;
    
    lastProcessedTextRef.current = text;
    setIsThinking(true);
    setShowTerminal(true);
    setAiResponse('');

    // 1. Get Intelligent Response from Groq
    const response = await GroqService.askJarvis(text);
    
    // 2. Set Response State (Triggers typing effect in Terminal)
    setAiResponse(response);
    setIsThinking(false);

    // 3. Speak the Response (Humanoid TTS)
    TTSService.speak(response);
  }, []);

  /**
   * translateText & Neural Logic
   */
  const translateText = useCallback(async (text, audioBlob = null) => {
    if ((!text || text.trim().length < 3) && !audioBlob) return;

    try {
      if (audioBlob && window.puter) {
        setIsProcessing(true);
        const result = await window.puter.ai.speech2txt({
          file: audioBlob,
          model: 'gpt-4o-transcribe',
          translate: true
        });

        if (result && result.text) {
          setTranslationData({
            originalText: text || "Neural Detection Active",
            translatedText: result.text,
            detectedLang: "UNIVERSAL AI"
          });
          
          // If the high-accuracy text is significant, let the brain handle it
          handleBrainInteraction(result.text);
        }
        setIsProcessing(false);
        return;
      }

      // Basic translation fallback for real-time visual
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
        }
      }
    } catch (error) {
      console.error('Neural glitch:', error);
      setIsProcessing(false);
    }
  }, [handleBrainInteraction]);

  // Debounced translation trigger
  useEffect(() => {
    if (transcript) {
      const timer = setTimeout(() => translateText(transcript), 800);
      return () => clearTimeout(timer);
    } else {
      setShowTerminal(false);
    }
  }, [transcript, translateText]);

  // Transitions
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowHero(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleSplashComplete = useCallback(() => setIsLoading(false), []);

  // Audio Capture
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (audioChunksRef.current.length > 0) translateText(null, audioBlob);
        audioChunksRef.current = [];
      };
      recorder.start(5000); // 5s neural chunks
      mediaRecorderRef.current = recorder;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let smoothedVolume = 0;
      
      const updateVolume = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const boostedVolume = Math.sqrt(average / 128) * 1.5;
        smoothedVolume = (smoothedVolume * 0.7) + (boostedVolume * 0.3);
        setVolume(smoothedVolume); 
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      setIsListening(true);
      if (recognitionRef.current) recognitionRef.current.start();
      setAlert({ message: 'Neural Link Established', isVisible: true });
    } catch (err) {
      console.error('Error:', err);
      setIsSpeechSupported(false);
      setPermissionGranted(false);
    }
  }, [translateText]);

  const stopAudio = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsListening(false);
    setVolume(0);
    setTranscript('');
    setShowTerminal(false);
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem('blobSettings', JSON.stringify(blobSettings));
    setAlert({ message: 'Memory Updated', isVisible: true });
  }, [blobSettings]);

  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    setAlert({ message: 'All settings are reset', isVisible: true });
    localStorage.removeItem('blobSettings');
  }, []);

  const handleMouseDown = useCallback(() => { if (blobSettings.isDraggable) setIsDragging(true); }, [blobSettings.isDraggable]);
  const handleMouseMove = useCallback((e) => {
    if (isDragging && blobSettings.isDraggable) {
      setBlobSettings(prev => ({ ...prev, position: { x: (e.clientX/window.innerWidth)*100, y: Math.max(15, (e.clientY/window.innerHeight)*100) } }));
    }
  }, [isDragging, blobSettings.isDraggable]);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <>
      {isLoading && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={`app-container ${isLoading ? 'hidden' : ''}`} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        <Navbar blobSettings={blobSettings} setBlobSettings={setBlobSettings} onSave={handleSave} onReset={handleReset} showHero={showHero} isListening={isListening} onInitialize={startAudio} onStop={stopAudio} />
        <Hero showHero={showHero} />
        <div className={`blob-wrapper ${showHero ? 'hidden' : ''} ${isDragging ? 'dragging' : ''}`} onMouseDown={handleMouseDown} style={{ left: `${blobSettings.position.x}%`, top: `${blobSettings.position.y}%`, transform: `translate(-50%, -50%) scale(${blobSettings.size})` }}>
          <FireAIBlob color={blobSettings.color} sensitivity={blobSettings.sensitivity} volume={volume} />
        </div>
        {!showHero && <VoiceControl transcript={transcript} isSupported={isSpeechSupported} />}
        
        {/* 10. Top Right System Status HUD */}
        <SystemStatus 
          isListening={isListening}
          isProcessing={isProcessing}
          isSupported={isSpeechSupported}
          permissionGranted={permissionGranted}
          showHero={showHero}
        />
        
        <BrainTerminal aiResponse={aiResponse} isThinking={isThinking} translationData={translationData} isVisible={showTerminal} />
        <PuterStatus isProcessing={isProcessing} />
        <SystemAlert message={alert.message} isVisible={alert.isVisible} onComplete={() => setAlert({ ...alert, isVisible: false })} />
        <img src={background} className="bg-image" alt="Background" />
      </div>
    </>
  );
}

export default App;
