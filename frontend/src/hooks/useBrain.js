import { useState, useCallback, useEffect, useRef } from 'react';
import TTSService from '../services/TTSService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = API_URL.replace('http', 'ws') + '/ws';

/**
 * useBrain Hook
 * Manages the WebSocket connection to J.A.R.V.I.S backend.
 * Handles real-time streaming of LLM tokens and TTS audio.
 */
export const useBrain = () => {
  // --- State ---
  const [aiResponse, setAiResponse] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [pipelineState, setPipelineState] = useState('idle'); // idle | listening | thinking | speaking
  const [conversationHistory, setConversationHistory] = useState([]);

  // --- Refs ---
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const streamingTextRef = useRef('');

  /**
   * connectWebSocket
   * Establishes and manages the WebSocket connection with auto-reconnect.
   */
  const connectWebSocket = useCallback(() => {
    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('[WS] Connected to J.A.R.V.I.S backend');
        setIsBackendConnected(true);
        // Explicitly set binaryType to blob for consistent handling
        ws.binaryType = 'blob';
        // Clear any reconnect timer
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = async (event) => {
        // Binary data = TTS audio
        if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
          console.log('[WS] Received binary audio data, type:', event.data.constructor.name);
          setIsSpeaking(true);
          setPipelineState('speaking');
          
          let audioBlob;
          if (event.data instanceof Blob) {
            audioBlob = new Blob([event.data], { type: 'audio/mpeg' });
          } else {
            audioBlob = new Blob([event.data], { type: 'audio/mpeg' });
          }
          
          console.log('[WS] Prepared audio blob, size:', audioBlob.size, 'type:', audioBlob.type);
          
          try {
            await TTSService.playAudio(audioBlob);
            console.log('[WS] Audio playback finished');
          } catch (err) {
            console.error('[WS] Audio playback error:', err);
          }
          
          setIsSpeaking(false);
          setPipelineState('idle');
          return;
        }

        // Text data = JSON messages
        try {
          const message = JSON.parse(event.data);
          console.log('[WS] Received message:', message.type);
          
          switch (message.type) {
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
                setPipelineState('idle');
              } else if (message.data === 'history_cleared') {
                setConversationHistory([]);
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
              // Audio binary will follow
              break;

            case 'error':
              console.error('[WS] Server error:', message.data);
              setIsThinking(false);
              setPipelineState('idle');
              break;

            default:
              break;
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setIsBackendConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          console.log('[WS] Attempting reconnect...');
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.warn('[WS] Connection error');
        setIsBackendConnected(false);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e);
      setIsBackendConnected(false);
      
      // Retry
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  /**
   * sendMessage
   * Sends a text message to J.A.R.V.I.S via WebSocket.
   * This triggers the full pipeline: LLM -> stream tokens -> TTS -> audio.
   */
  const sendMessage = useCallback((text) => {
    if (!text || text.trim().length < 2) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Not connected. Attempting reconnect...');
      connectWebSocket();
      return;
    }

    // Stop any currently playing audio
    TTSService.stop();

    // Add user message to conversation
    const userMsg = { role: 'user', text: text.trim(), timestamp: Date.now() };
    setConversationHistory(prev => [...prev, userMsg]);

    // Reset state
    setAiResponse('');
    setStreamingText('');
    streamingTextRef.current = '';

    // Send via WebSocket
    wsRef.current.send(JSON.stringify({ type: 'chat', text: text.trim() }));
  }, [connectWebSocket]);

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

  // When we get a final response, add it to conversation history
  useEffect(() => {
    if (aiResponse) {
      const aiMsg = { role: 'assistant', text: aiResponse, timestamp: Date.now() };
      setConversationHistory(prev => [...prev, aiMsg]);
    }
  }, [aiResponse]);

  return {
    aiResponse,
    streamingText,
    isThinking,
    isSpeaking,
    isBackendConnected,
    pipelineState,
    conversationHistory,
    sendMessage,
    clearHistory
  };
};
