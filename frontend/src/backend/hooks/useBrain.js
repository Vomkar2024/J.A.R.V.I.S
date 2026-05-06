import { useState, useCallback } from 'react';

import TTSService from '../services/TTSService';

/**
 * useBrain Hook
 * Handles AI interactions and translations.
 */
export const useBrain = (lastProcessedTextRef) => {
  // --- Neural State ---
  const [translationData, setTranslationData] = useState(null); // Stores cross-language translation logs
  const [aiResponse, setAiResponse] = useState('');           // Stores the latest string from JARVIS
  const [isThinking, setIsThinking] = useState(false);        // UI flag for LLM processing
  const [isProcessing, setIsProcessing] = useState(false);    // UI flag for Audio/STT processing
  const [showTerminal, setShowTerminal] = useState(false);    // Controls terminal visibility

  /**
   * handleBrainInteraction
   * Processes a text prompt by sending it to the JARVIS backend,
   * receiving a response, and automatically triggering the TTS playback.
   */
  const handleBrainInteraction = useCallback(async (text) => {
    if (!text || text.trim().length < 4 || text === lastProcessedTextRef.current) return;
    
    lastProcessedTextRef.current = text;
    setIsThinking(true);
    setShowTerminal(true);
    setAiResponse('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) throw new Error('Brain uplink failed');
      
      const data = await response.json();
      const aiMsg = data.response;
      
      setAiResponse(aiMsg);
      
      // Get TTS for this response
      const ttsRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiMsg })
      });
      
      if (ttsRes.ok) {
        const audioBlob = await ttsRes.blob();
        TTSService.playAudio(audioBlob);
      }
    } catch (error) {
      console.error('Brain Link Error:', error);
      setAiResponse('SYSTEM_ERROR: Neural connection unstable.');
    } finally {
      setIsThinking(false);
    }
  }, [lastProcessedTextRef]);

  /**
   * translateText
   * Dual-purpose function that handles:
   * 1. Real-time audio processing (full STT -> LLM -> TTS cycle)
   * 2. Text translation fallback via Google Translate API
   */
  const translateText = useCallback(async (text, audioBlob = null) => {
    if ((!text || text.trim().length < 3) && !audioBlob) return;

    try {
      if (audioBlob) {
        setIsProcessing(true);
        const formData = new FormData();
        formData.append('file', audioBlob, 'voice.webm');

        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/process-audio`, {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const blob = await response.blob();
          const userText = response.headers.get('X-User-Text');
          const aiResponseText = response.headers.get('X-AI-Response');

          setTranslationData({
            originalText: "Voice Signal",
            translatedText: userText || "Audio signal processed",
            detectedLang: "JARVIS CORE"
          });
          
          setAiResponse(aiResponseText || "");
          TTSService.playAudio(blob);
          setShowTerminal(true);
        }
        return;
      }

      // Fallback for text translation (Google Translate)
      const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=';
      const url = `${GOOGLE_TRANSLATE_API}${encodeURIComponent(text)}`;
      const resp = await fetch(url);
      
      if (!resp.ok) return;
      
      const data = await resp.json();
      
      if (data && data[0]) {
        const translated = data[0].map(item => item[0]).join('');
        const detectedLang = data[2];
        if (detectedLang && detectedLang !== 'en') {
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
    } finally {
      setIsProcessing(false);
      setIsThinking(false);
    }
  }, []);

  return {
    translationData,
    aiResponse,
    isThinking,
    isProcessing,
    showTerminal,
    setShowTerminal,
    handleBrainInteraction,
    translateText
  };
};
