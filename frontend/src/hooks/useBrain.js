import { useState, useCallback, useEffect, useRef } from 'react';
import TTSService from '../services/TTSService';

// Dynamic host resolution to support local network devices and alternate hostnames
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:8000`;
};
const API_URL = getApiUrl();
const WS_URL = `${API_URL.replace(/^http/, 'ws')}/ws`;

// ============================================================
// Connection Constants — Tuned for Maximum Resilience
// ============================================================
const WS_CONFIG = {
  // Reconnection
  INITIAL_RECONNECT_DELAY: 500,     // Start fast — 0.5s
  MAX_RECONNECT_DELAY: 10000,       // Cap at 10s (never wait longer)
  RECONNECT_DECAY: 1.5,             // Gentle exponential backoff multiplier
  RECONNECT_JITTER: 0.3,            // ±30% jitter to prevent thundering herd
  MAX_RECONNECT_ATTEMPTS: Infinity,  // NEVER give up

  // Heartbeat — Detect dead connections
  PING_INTERVAL: 15000,              // Send ping every 15s
  PONG_TIMEOUT: 5000,                // If no pong in 5s, connection is dead

  // Message Queue
  MAX_QUEUE_SIZE: 50,                 // Buffer up to 50 messages while disconnected
  QUEUE_FLUSH_DELAY: 100,            // Wait 100ms after reconnect before flushing

  // Health Check
  HEALTH_CHECK_INTERVAL: 30000,       // HTTP health check every 30s as fallback
};

/**
 * useBrain Hook — Bulletproof WebSocket Connection Manager
 * 
 * Manages the WebSocket connection to J.A.R.V.I.S backend with:
 * - Exponential backoff with jitter for reconnection
 * - Ping/Pong heartbeat to detect zombie connections
 * - Message queue that buffers sends during disconnection
 * - Visibility-aware reconnection (reconnects when tab becomes active)
 * - Connection state machine for precise status tracking
 * - Never gives up — will reconnect forever
 */
export const useBrain = () => {
  // --- State ---
  const [aiResponse, setAiResponse] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [pipelineState, setPipelineState] = useState('idle'); // idle | listening | thinking | speaking | observing | tool_use
  const [activeTool, setActiveTool] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [telemetry, setTelemetry] = useState({ cpu: 0, ram: 0, status: 'nominal' });
  const [translationData, setTranslationData] = useState(null);

  // --- Refs ---
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectDelayRef = useRef(WS_CONFIG.INITIAL_RECONNECT_DELAY);
  const streamingTextRef = useRef('');
  const messageQueueRef = useRef([]);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);
  const healthCheckIntervalRef = useRef(null);
  const isIntentionalCloseRef = useRef(false);
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const audioChunksRef = useRef([]);
  const isDownloadingAudioRef = useRef(false);

  // Helper to add system logs
  const addLog = useCallback((message, type = 'info') => {
    setSystemLogs(prev => [{
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      message,
      type,
      timestamp: Date.now()
    }, ...prev].slice(0, 50));
  }, []);

  // ============================================================
  // Heartbeat System — Detect Dead/Zombie Connections
  // ============================================================

  const clearHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((ws) => {
    clearHeartbeat();

    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Send application-level ping (JSON)
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          
          // Start pong timeout — if no response, connection is dead
          pongTimeoutRef.current = setTimeout(() => {
            console.warn('[WS] ❌ Heartbeat timeout — connection is dead. Force-closing.');
            // Force close the zombie connection
            try { ws.close(4000, 'Heartbeat timeout'); } catch (e) { /* ignore */ }
          }, WS_CONFIG.PONG_TIMEOUT);
        } catch (e) {
          console.warn('[WS] Failed to send ping:', e);
          try { ws.close(4001, 'Ping failed'); } catch (err) { /* ignore */ }
        }
      }
    }, WS_CONFIG.PING_INTERVAL);
  }, [clearHeartbeat]);

  // ============================================================
  // Message Queue — Never Lose a Message
  // ============================================================

  const queueMessage = useCallback((message) => {
    if (messageQueueRef.current.length < WS_CONFIG.MAX_QUEUE_SIZE) {
      messageQueueRef.current.push(message);
      console.log(`[WS] 📦 Message queued (${messageQueueRef.current.length}/${WS_CONFIG.MAX_QUEUE_SIZE})`);
    } else {
      console.warn('[WS] ⚠️ Message queue full — dropping oldest message');
      messageQueueRef.current.shift();
      messageQueueRef.current.push(message);
    }
  }, []);

  const flushMessageQueue = useCallback((ws) => {
    if (messageQueueRef.current.length === 0) return;

    console.log(`[WS] 📤 Flushing ${messageQueueRef.current.length} queued messages...`);
    
    setTimeout(() => {
      while (messageQueueRef.current.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = messageQueueRef.current.shift();
        try {
          ws.send(msg);
          console.log('[WS] ✅ Queued message sent');
        } catch (e) {
          console.error('[WS] Failed to send queued message:', e);
          messageQueueRef.current.unshift(msg); // Put it back
          break;
        }
      }
    }, WS_CONFIG.QUEUE_FLUSH_DELAY);
  }, []);

  // ============================================================
  // Core Connection — The Iron Link
  // ============================================================

  const connectWebSocket = useCallback(() => {
    // Guard: Don't create multiple connections
    if (connectingRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;
    if (!mountedRef.current) return;

    connectingRef.current = true;
    isIntentionalCloseRef.current = false;

    // Clean up any existing dead socket
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    }

    try {
      console.log(`[WS] 🔌 Connecting to ${WS_URL}...`);
      const ws = new WebSocket(WS_URL);
      ws.binaryType = 'blob';

      // --- CONNECTION OPENED ---
      ws.onopen = () => {
        console.log('[WS] ✅ Connected to J.A.R.V.I.S backend');
        addLog('Neural Link established via WebSocket', 'success');
        connectingRef.current = false;
        setIsBackendConnected(true);

        // Reset reconnection state on successful connect
        reconnectAttemptRef.current = 0;
        reconnectDelayRef.current = WS_CONFIG.INITIAL_RECONNECT_DELAY;

        // Clear any pending reconnect timer
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        // Start heartbeat monitoring
        startHeartbeat(ws);

        // Flush any messages that were queued while disconnected
        flushMessageQueue(ws);
      };

      // --- MESSAGE RECEIVED ---
      ws.onmessage = async (event) => {
        // Binary data = TTS audio
        if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
          console.log('[WS] Received binary audio data, type:', event.data.constructor.name);
          setIsSpeaking(true);
          setPipelineState('speaking');
          
          let chunkData;
          if (event.data instanceof Blob) {
            chunkData = event.data;
          } else {
            chunkData = new Blob([event.data], { type: 'audio/mpeg' });
          }
          
          // Accumulate raw MP3 streaming chunks instead of playing immediately.
          // This allows the browser to decode a single, complete MP3 buffer at the end of the streaming session,
          // completely eliminating clicks, voice cracking, and decoding failures.
          audioChunksRef.current.push(chunkData);
          console.log(`[WS] Cached audio chunk (Total stored: ${audioChunksRef.current.length})`);
          return;
        }

        // Text data = JSON messages
        try {
          const message = JSON.parse(event.data);
          
          // Handle heartbeat pong — reset timeout
          if (message.type === 'pong') {
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
              pongTimeoutRef.current = null;
            }
            return; // Don't log pongs, they're noisy
          }

          console.log('[WS] Received message:', message.type);
          
          switch (message.type) {
            case 'history_load':
              if (message.data && Array.isArray(message.data)) {
                setConversationHistory(message.data);
                addLog(`Recalled ${message.data.length / 2} previous conversation units`, 'success');
              }
              break;
            case 'status':
              if (message.data === 'thinking') {
                setIsThinking(true);
                setPipelineState('thinking');
                setStreamingText('');
                streamingTextRef.current = '';
              } else if (message.data === 'speaking') {
                setIsThinking(false);
                setPipelineState('speaking');
              } else if (message.data === 'idle') {
                // Audio streaming is done!
                isDownloadingAudioRef.current = false;
                if (audioChunksRef.current.length > 0) {
                  console.log(`[WS] Consolidating and playing ${audioChunksRef.current.length} cached audio chunks...`);
                  const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
                  audioChunksRef.current = [];
                  try {
                    await TTSService.playAudio(finalBlob);
                  } catch (err) {
                    console.error('[WS] Combined audio playback failed:', err);
                  }
                } else {
                  setPipelineState('idle');
                }
              } else if (message.data === 'observing') {
                setPipelineState('observing');
              } else if (message.data === 'history_cleared') {
                setConversationHistory([]);
              } else if (message.data === 'tool_use') {
                setPipelineState('tool_use');
                setActiveTool(message.tool || 'SYSTEM_TASK');
              }
              break;

            case 'token':
              streamingTextRef.current += message.data;
              setStreamingText(streamingTextRef.current);
              break;

            case 'response_end':
              setIsThinking(false);
              setAiResponse(message.data);
              setStreamingText('');
              streamingTextRef.current = '';
              break;

            case 'audio_start':
              // Reset the binary chunks accumulator and download status flag
              audioChunksRef.current = [];
              isDownloadingAudioRef.current = true;
              setIsSpeaking(true);
              setPipelineState('speaking');
              break;
            
            case 'telemetry':
              setTelemetry(message.data);
              break;

            case 'translation':
              setTranslationData(message.data);
              if (message.data) {
                addLog(`Detected: ${message.data.detectedLang} | Translated to: ${message.data.translatedText}`, 'info');
              }
              break;

            case 'error':
              console.error('[WS] Server error:', message.data);
              setIsThinking(false);
              isDownloadingAudioRef.current = false;
              audioChunksRef.current = [];
              setPipelineState('idle');
              break;

            default:
              break;
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      // --- CONNECTION CLOSED ---
      ws.onclose = (event) => {
        const wasClean = event.wasClean;
        const code = event.code;
        const reason = event.reason || 'No reason';

        console.log(`[WS] ⚡ Disconnected (code: ${code}, clean: ${wasClean}, reason: ${reason})`);
        addLog(`Link severed: ${reason}`, 'warning');
        
        connectingRef.current = false;
        setIsBackendConnected(false);
        wsRef.current = null;
        
        // Reset audio state
        isDownloadingAudioRef.current = false;
        audioChunksRef.current = [];
        
        // Stop heartbeat
        clearHeartbeat();

        // Auto-reconnect unless we intentionally closed
        if (!isIntentionalCloseRef.current && mountedRef.current) {
          scheduleReconnect();
        }
      };

      // --- CONNECTION ERROR ---
      ws.onerror = (error) => {
        console.warn('[WS] ⚠️ Connection error');
        connectingRef.current = false;
        setIsBackendConnected(false);
        
        // Reset audio state
        isDownloadingAudioRef.current = false;
        audioChunksRef.current = [];
        // onclose will fire after onerror, which will trigger reconnect if needed
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] 💥 Failed to create WebSocket:', e);
      connectingRef.current = false;
      setIsBackendConnected(false);
      
      // Schedule reconnect on creation failure
      if (!isIntentionalCloseRef.current && mountedRef.current) {
        scheduleReconnect();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startHeartbeat, clearHeartbeat, flushMessageQueue]);

  // ============================================================
  // Reconnection Engine — Exponential Backoff with Jitter
  // ============================================================

  const getReconnectDelay = useCallback(() => {
    const baseDelay = Math.min(
      WS_CONFIG.INITIAL_RECONNECT_DELAY * Math.pow(WS_CONFIG.RECONNECT_DECAY, reconnectAttemptRef.current),
      WS_CONFIG.MAX_RECONNECT_DELAY
    );
    // Add jitter to prevent all clients reconnecting simultaneously
    const jitter = baseDelay * WS_CONFIG.RECONNECT_JITTER * (Math.random() * 2 - 1);
    return Math.max(100, Math.round(baseDelay + jitter));
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (isIntentionalCloseRef.current || !mountedRef.current) return;
    if (reconnectTimerRef.current) return; // Already scheduled

    const delay = getReconnectDelay();
    reconnectAttemptRef.current += 1;

    console.log(
      `[WS] 🔄 Reconnect #${reconnectAttemptRef.current} scheduled in ${delay}ms ` +
      `(backoff: ${Math.round(delay)}ms)`
    );

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (!isIntentionalCloseRef.current && mountedRef.current) {
        connectWebSocket();
      }
    }, delay);
  }, [getReconnectDelay, connectWebSocket]); // Reconnect with backoff

  // ============================================================
  // Visibility-Aware Reconnection
  // When the user switches tabs and comes back, immediately check
  // if the connection is still alive and reconnect if needed.
  // ============================================================

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[WS] 👁️ Tab became visible — checking connection...');
        
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('[WS] 🔄 Connection lost while tab was hidden — reconnecting immediately');
          // Reset backoff for immediate reconnect when user returns
          reconnectAttemptRef.current = 0;
          
          // Clear any existing reconnect timer
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          
          connectWebSocket();
        }
      }
    };

    // Also reconnect when network comes back online
    const handleOnline = () => {
      console.log('[WS] 🌐 Network back online — reconnecting immediately');
      reconnectAttemptRef.current = 0;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      connectWebSocket();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [connectWebSocket]);

  // ============================================================
  // HTTP Health Check Fallback
  // Periodically checks if the backend is alive via REST.
  // If backend is up but WS is down, force reconnect.
  // ============================================================

  useEffect(() => {
    const healthCheck = async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return; // Already connected

      try {
        const response = await fetch(`${API_URL}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(3000) 
        });
        if (response.ok) {
          console.log('[WS] 🏥 Health check: Backend is UP but WS is down — forcing reconnect');
          reconnectAttemptRef.current = 0; // Reset backoff
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          connectWebSocket();
        }
      } catch (e) {
        // Backend is down, let normal reconnect handle it
      }
    };

    healthCheckIntervalRef.current = setInterval(healthCheck, WS_CONFIG.HEALTH_CHECK_INTERVAL);

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [connectWebSocket]);

  // ============================================================
  // Mount/Unmount — Connect on Mount, Cleanup on Unmount
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;
    connectWebSocket();

    return () => {
      mountedRef.current = false;
      isIntentionalCloseRef.current = true;
      
      // Cleanup all timers
      clearHeartbeat();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [connectWebSocket, clearHeartbeat]);

  // ============================================================
  // Send Message — With Queue Fallback
  // ============================================================

  /**
   * sendMessage
   * Sends a text message to J.A.R.V.I.S via WebSocket.
   * If disconnected, queues the message and triggers reconnect.
   * The message WILL be delivered once connection is restored.
   */
  const sendMessage = useCallback((text) => {
    if (!text || text.trim().length < 2) return;

    // Stop any currently playing audio and clear chunk buffers
    TTSService.stop();
    audioChunksRef.current = [];
    isDownloadingAudioRef.current = false;

    // Add user message to conversation immediately (optimistic)
    const userMsg = { role: 'user', text: text.trim(), timestamp: Date.now() };
    setConversationHistory(prev => [...prev, userMsg]);

    // Reset state
    setAiResponse('');
    setStreamingText('');
    streamingTextRef.current = '';

    const payload = JSON.stringify({ type: 'chat', text: text.trim() });

    // If connected, send immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(payload);
        return;
      } catch (e) {
        console.warn('[WS] Send failed, queuing message:', e);
      }
    }

    // If not connected, queue it and force reconnect
    console.warn('[WS] ⚠️ Not connected — queuing message and reconnecting...');
    queueMessage(payload);
    
    // Reset backoff and reconnect immediately
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    connectWebSocket();
  }, [connectWebSocket, queueMessage]);

  /**
   * clearHistory
   * Clears conversation history on both frontend and backend.
   */
  const clearHistory = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear_history' }));
    }
    setConversationHistory([]);
    setAiResponse('');
    setStreamingText('');
  }, []);

  const forceReconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  }, [connectWebSocket]);

  // When we get a final response, add it to conversation history
  useEffect(() => {
    if (aiResponse) {
      const aiMsg = { role: 'assistant', text: aiResponse, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, aiMsg]);
    }
  }, [aiResponse]);

  // Reactive audio playback monitor — unblocks mic only when J.A.R.V.I.S actually finishes speaking
  useEffect(() => {
    if (!isSpeaking) return;

    const interval = setInterval(() => {
      if (!isDownloadingAudioRef.current && !TTSService.isPlaying() && TTSService.audioQueue.length === 0) {
        setIsSpeaking(false);
        setPipelineState('idle');
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  return {
    aiResponse,
    streamingText,
    isThinking,
    isSpeaking,
    isBackendConnected,
    pipelineState,
    activeTool,
    conversationHistory,
    systemLogs,
    telemetry,
    translationData,
    sendMessage,
    clearHistory,
    forceReconnect
  };
};
