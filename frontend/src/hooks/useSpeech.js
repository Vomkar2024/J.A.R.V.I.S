import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// Neural Link Constants — Speech Recognition Resilience
// ============================================================
const NEURAL_CONFIG = {
  // Restart Timing
  RESTART_DELAY: 300,               // Wait 300ms before restarting after end
  ERROR_RESTART_DELAY: 1000,        // Wait 1s after error before restart
  MAX_RESTART_DELAY: 5000,          // Cap restart delay at 5s
  RESTART_BACKOFF: 1.5,             // Gentle backoff on repeated errors

  // Silence Detection
  SILENCE_TIMEOUT: 1500,            // Send after 1.5s of silence

  // Health Monitoring
  HEALTH_CHECK_INTERVAL: 10000,     // Check recognition health every 10s
  MAX_CONSECUTIVE_ERRORS: 10,       // After 10 errors, do a full reset
  ERROR_WINDOW: 30000,              // Count errors within 30s window

  // Watchdog
  WATCHDOG_INTERVAL: 5000,          // Check if recognition is alive every 5s
};

/**
 * useSpeech Hook — Ironclad Neural Link
 * 
 * Handles microphone access, real-time speech recognition, and volume analysis.
 * 
 * Resilience features:
 * - Auto-restart on any error or unexpected end
 * - Watchdog timer detects silently-dead recognition
 * - Error rate tracking with full reset on repeated failures
 * - Graceful degradation with user feedback
 * - Uses browser SpeechRecognition for instant transcription
 */
export const useSpeech = (onTranscriptChange, onFinalTranscript) => {
  // --- Audio State ---
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  // --- Core Refs ---
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const isListeningRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const accumulatedTextRef = useRef('');
  const lastResultIndexRef = useRef(0);

  // --- Resilience Refs ---
  const restartTimerRef = useRef(null);
  const restartDelayRef = useRef(NEURAL_CONFIG.RESTART_DELAY);
  const watchdogTimerRef = useRef(null);
  const errorTimestampsRef = useRef([]);
  const lastActivityRef = useRef(Date.now());
  const isRestartingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ============================================================
  // Error Rate Tracking
  // ============================================================

  const trackError = useCallback((errorType) => {
    const now = Date.now();
    errorTimestampsRef.current.push({ time: now, type: errorType });
    
    // Prune old errors outside the window
    errorTimestampsRef.current = errorTimestampsRef.current.filter(
      e => now - e.time < NEURAL_CONFIG.ERROR_WINDOW
    );

    const errorCount = errorTimestampsRef.current.length;
    console.log(`[Neural] ⚡ Error tracked: "${errorType}" (${errorCount} errors in ${NEURAL_CONFIG.ERROR_WINDOW / 1000}s window)`);

    return errorCount >= NEURAL_CONFIG.MAX_CONSECUTIVE_ERRORS;
  }, []);

  // ============================================================
  // Recognition Restart Engine
  // ============================================================

  const restartRecognition = useCallback((reason = 'unknown', forceImmediate = false) => {
    if (!isListeningRef.current || !mountedRef.current) return;
    if (isRestartingRef.current && !forceImmediate) return;

    isRestartingRef.current = true;

    // Clear any pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const delay = forceImmediate ? 0 : restartDelayRef.current;
    console.log(`[Neural] 🔄 Restarting recognition (reason: ${reason}, delay: ${delay}ms)`);

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      isRestartingRef.current = false;

      if (!isListeningRef.current || !mountedRef.current) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          lastActivityRef.current = Date.now();
          // Reset delay on successful restart
          restartDelayRef.current = NEURAL_CONFIG.RESTART_DELAY;
          console.log('[Neural] ✅ Recognition restarted successfully');
        } catch (e) {
          if (e.message && e.message.includes('already started')) {
            // Already running, that's fine
            restartDelayRef.current = NEURAL_CONFIG.RESTART_DELAY;
            isRestartingRef.current = false;
            return;
          }
          console.warn('[Neural] ⚠️ Restart failed:', e.message);
          // Increase delay with backoff
          restartDelayRef.current = Math.min(
            restartDelayRef.current * NEURAL_CONFIG.RESTART_BACKOFF,
            NEURAL_CONFIG.MAX_RESTART_DELAY
          );
          // Try again
          restartRecognition('restart_failed');
        }
      }
    }, delay);
  }, []);

  // ============================================================
  // Full Reset — Nuclear Option for Persistent Failures
  // ============================================================

  const fullRecognitionReset = useCallback(() => {
    console.log('[Neural] 🔥 Full recognition reset — too many errors');
    
    // Destroy current recognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }

    // Clear error history
    errorTimestampsRef.current = [];
    restartDelayRef.current = NEURAL_CONFIG.RESTART_DELAY;
    isRestartingRef.current = false;

    // Create a fresh recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Re-attach handlers (same logic as initial setup)
    attachRecognitionHandlers(recognition);
    recognitionRef.current = recognition;

    // Start immediately
    if (isListeningRef.current) {
      try {
        recognition.start();
        lastActivityRef.current = Date.now();
        console.log('[Neural] ✅ Fresh recognition instance started');
      } catch (e) {
        console.error('[Neural] 💥 Even fresh instance failed:', e);
      }
    }
  }, []); // attachRecognitionHandlers defined below, linked via ref pattern

  // ============================================================
  // Watchdog Timer — Detect Silently-Dead Recognition
  // ============================================================

  const startWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);

    watchdogTimerRef.current = setInterval(() => {
      if (!isListeningRef.current || !mountedRef.current) return;

      const timeSinceActivity = Date.now() - lastActivityRef.current;
      
      // If no activity in 2x the watchdog interval, recognition might be dead
      if (timeSinceActivity > NEURAL_CONFIG.WATCHDOG_INTERVAL * 2) {
        console.warn(`[Neural] 🐕 Watchdog: No activity for ${Math.round(timeSinceActivity / 1000)}s — poking recognition`);
        restartRecognition('watchdog_timeout', true);
      }
    }, NEURAL_CONFIG.WATCHDOG_INTERVAL);
  }, [restartRecognition]);

  const stopWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  // ============================================================
  // Recognition Event Handler Attachment
  // ============================================================

  const attachRecognitionHandlers = useCallback((recognition) => {
    recognition.onresult = (event) => {
      lastActivityRef.current = Date.now();
      
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
        }, NEURAL_CONFIG.SILENCE_TIMEOUT);
      }
    };

    recognition.onend = () => {
      lastActivityRef.current = Date.now();
      
      // Only restart if we're still supposed to be listening
      if (isListeningRef.current && mountedRef.current) {
        console.log('[Neural] 🔁 Recognition ended — auto-restarting...');
        restartRecognition('onend');
      }
    };

    recognition.onerror = (event) => {
      lastActivityRef.current = Date.now();
      
      // Benign errors — don't count these
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      console.error(`[Neural] ❌ Recognition error: ${event.error}`);
      
      // Track the error
      const needsReset = trackError(event.error);

      if (needsReset) {
        // Too many errors — full reset
        fullRecognitionReset();
      } else if (event.error === 'network') {
        // Network error — wait a bit longer before retry
        restartDelayRef.current = Math.max(restartDelayRef.current, NEURAL_CONFIG.ERROR_RESTART_DELAY);
        restartRecognition('network_error');
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Permission issue — stop trying
        console.error('[Neural] 🚫 Microphone permission denied');
        setPermissionGranted(false);
      } else {
        // Other errors — restart with backoff
        restartDelayRef.current = Math.min(
          restartDelayRef.current * NEURAL_CONFIG.RESTART_BACKOFF,
          NEURAL_CONFIG.MAX_RESTART_DELAY
        );
        restartRecognition(`error_${event.error}`);
      }
    };
  }, [onTranscriptChange, onFinalTranscript, trackError, restartRecognition, fullRecognitionReset]);

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

      attachRecognitionHandlers(recognition);
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }
  }, [attachRecognitionHandlers]);

  // ============================================================
  // Start Speech — Initialize All Systems
  // ============================================================

  /**
   * startSpeech
   * Initializes the microphone, audio analyzer, and speech recognition.
   * Starts the watchdog to ensure recognition never silently dies.
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
      
      // Reset resilience state
      restartDelayRef.current = NEURAL_CONFIG.RESTART_DELAY;
      errorTimestampsRef.current = [];
      isRestartingRef.current = false;
      lastActivityRef.current = Date.now();
      
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) { /* ignore */ }
      }

      // Start watchdog
      startWatchdog();
      
      console.log('[Neural] ✅ Neural Link established — all systems nominal');
      return true;
    } catch (err) {
      console.error('[Neural] 💥 Speech initialization failed:', err);
      setIsSupported(false);
      setPermissionGranted(false);
      return false;
    }
  }, [startWatchdog]);

  // ============================================================
  // Stop Speech — Graceful Shutdown of All Systems
  // ============================================================

  /**
   * stopSpeech
   * Gracefully shuts down all audio resources, recognition, and watchdog.
   */
  const stopSpeech = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    setVolume(0);
    accumulatedTextRef.current = '';
    isRestartingRef.current = false;

    // Clear all timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Stop watchdog
    stopWatchdog();

    // Stop recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error('AudioContext close error:', e));
    }

    console.log('[Neural] 🛑 Neural Link terminated — all systems offline');
  }, [stopWatchdog]);

  return {
    isListening,
    volume,
    isSupported,
    permissionGranted,
    startSpeech,
    stopSpeech
  };
};
