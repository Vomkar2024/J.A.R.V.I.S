import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSpeech Hook
 * Encapsulates Speech Recognition, Audio Analysis, and Microphone permissions.
 */
export const useSpeech = (onTranscriptChange, onAudioBlobReady) => {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false);

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
      });
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
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        onTranscriptChange(currentTranscript);
      };

      recognition.onend = () => {
        // Only restart if we're still supposed to be listening
        if (isListeningRef.current && recognitionRef.current) {
          try { 
            recognitionRef.current.start(); 
          } catch (e) {
            // Ignore error if already started
            if (e.error !== 'no-speech') console.error('Recognition restart failed:', e);
          }
        }
      };
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }
  }, [onTranscriptChange]);

  const startSpeech = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      streamRef.current = stream;
      
      // Audio Analysis setup
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Recorder setup
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        if (chunks.length > 0 && onAudioBlobReady) {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          onAudioBlobReady(audioBlob);
        }
      };
      
      recorder.start(5000); // 5s chunks
      mediaRecorderRef.current = recorder;

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
  }, [onAudioBlobReady]);

  const stopSpeech = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVolume(0);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
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
