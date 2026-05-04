import React, { useState, useEffect, useCallback, useRef } from 'react';
import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';
import SplashScreen from './component/SplashScreen';
import Hero from './component/Hero';
import VoiceControl from './component/VoiceControl';

const DEFAULT_SETTINGS = {
  color: '#ff6b00', // Scorching fire orange
  size: 0.8,
  sensitivity: 0.7,
  position: { x: 50, y: 50 },
  isDraggable: false
};


function App() {
  const [blobSettings, setBlobSettings] = useState(DEFAULT_SETTINGS);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHero, setShowHero] = useState(true);
  
  // Audio & Voice State
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recognitionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('blobSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setBlobSettings(prev => ({ 
          ...prev, 
          ...parsed, 
          isDraggable: false // Always default to not draggable on load
        }));
      }
    } catch (error) {
      console.error('Failed to load blob settings from localStorage:', error);
    }

    // Initialize Speech Recognition
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
        if (isListeningRef.current) recognition.start();
      };

      recognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowHero(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let smoothedVolume = 0;
      const updateVolume = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        let max = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          if (dataArray[i] > max) max = dataArray[i];
        }
        const average = sum / bufferLength;
        const reactiveVolume = (average * 0.7 + max * 0.3) / 128;
        
        // Low-pass filter for smoothing
        smoothedVolume = (smoothedVolume * 0.8) + (reactiveVolume * 0.2);
        setVolume(smoothedVolume); 
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Microphone access is required for voice features.');
    }
  }, []);

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
      console.error('Failed to save blob settings:', error);
      alert('Failed to save settings. Please check your browser storage permissions.');
    }
  }, [blobSettings]);

  const handleReset = useCallback(() => {
    setBlobSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem('blobSettings');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (blobSettings.isDraggable) {
      setIsDragging(true);
    }
  }, [blobSettings.isDraggable]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging && blobSettings.isDraggable) {
      const x = (e.clientX / window.innerWidth) * 100;
      const rawY = (e.clientY / window.innerHeight) * 100;
      // Prevent blob from being dragged too high into the navbar area (min 15%)
      const y = Math.max(15, rawY); 
      setBlobSettings(prev => ({ ...prev, position: { x, y } }));
    }
  }, [isDragging, blobSettings.isDraggable]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <>
      {isLoading && <SplashScreen onComplete={() => setIsLoading(false)} />}
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
          onInitialize={startAudio}
          onStop={stopAudio}
        />
        
        <Hero showHero={showHero} />

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

        {!showHero && (
          <VoiceControl 
            transcript={transcript} 
            isSupported={isSpeechSupported}
          />
        )}
        
        <img src={background} className="bg-image" alt="Background" aria-hidden="true" />
      </div>
    </>
  );
}

export default App;


