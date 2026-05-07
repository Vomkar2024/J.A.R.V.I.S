import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSpeech Hook
 * Handles microphone access, real-time speech recognition, and volume analysis.
 * No longer sends audio blobs — uses browser SpeechRecognition for instant transcription,
 * then sends final text via the brain's WebSocket.
 */
export const useSpeech = (onTranscriptChange, onFinalTranscript) => {
  // --- Audio State ---
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const accumulatedTextRef = useRef('');
  const lastResultIndexRef = useRef(0);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Initialize Permissions
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
        setPermissionGranted(result.state === 'granted');
        result.onchange = () => {
          setPermissionGranted(result.state === 'granted');
        };
      }).catch(() => {});
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        // Show real-time interim results
        const currentText = finalText + interimText;
        onTranscriptChange(currentText);

        // Reset silence timer on every result
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // If we have final text, wait for silence then send
        if (finalText.trim().length > 2) {
          accumulatedTextRef.current = finalText.trim();
          
          // Start silence detection — send after 1.5s of silence
          silenceTimerRef.current = setTimeout(() => {
            if (accumulatedTextRef.current && onFinalTranscript) {
              onFinalTranscript(accumulatedTextRef.current);
              accumulatedTextRef.current = '';
              onTranscriptChange('');
              lastResultIndexRef.current = 0;
              
              // Restart recognition to clear the results buffer
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch (e) { /* will restart via onend */ }
              }
            }
          }, 1500);
        }
      };

      recognition.onend = () => {
        // Only restart if we're still supposed to be listening
        if (isListeningRef.current && recognitionRef.current) {
          try { 
            recognitionRef.current.start(); 
          } catch (e) {
            // Ignore error if already started
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error('Recognition error:', event.error);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }
  }, [onTranscriptChange, onFinalTranscript]);

  /**
   * startSpeech
   * Initializes the microphone and audio analyzer for volume visualization.
   * Also starts the speech recognition engine.
   */
  const startSpeech = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      streamRef.current = stream;
      
      // Audio Analysis setup for blob visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Volume tracking
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let smoothedVolume = 0;
      
      const updateVolume = () => {
        if (!analyserRef.current) return;
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
      isListeningRef.current = true;
      accumulatedTextRef.current = '';
      
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { /* ignore */ }
      }
      
      return true;
    } catch (err) {
      console.error('Speech initialization failed:', err);
      setIsSupported(false);
      setPermissionGranted(false);
      return false;
    }
  }, []);

  /**
   * stopSpeech
   * Gracefully shuts down all audio resources.
   */
  const stopSpeech = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVolume(0);
    accumulatedTextRef.current = '';

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error('AudioContext close error:', e));
    }
  }, []);

  return {
    isListening,
    volume,
    isSupported,
    permissionGranted,
    startSpeech,
    stopSpeech
  };
};
