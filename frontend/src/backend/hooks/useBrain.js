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
  
  // Custom Hinglish-to-English mapper for JARVIS precision
  const hinglishMap = {
    'recognise kar raha hai': 'Recognising it',
    'recognise kar raha hoon': 'Recognising it',
    'recognize kar raha hai': 'Recognising it',
    'recognize kar raha hoon': 'Recognising it',
    'kaise ho': 'How are you',
    'kya ho raha hai': 'What is happening',
    'theek hai': 'Alright',
    'shukriya': 'Thank you'
  };

  /**
   * preprocessHinglish
   * Normalizes Hinglish text and checks against the custom map.
   */
  const preprocessHinglish = (text) => {
    if (!text) return text;
    const normalized = text.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    
    // Check for direct matches or patterns
    for (const [key, value] of Object.entries(hinglishMap)) {
      if (normalized.includes(key)) {
        return value;
      }
    }
    return text;
  };

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

      // High-Accuracy LLM Translation
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      let translated = data.translation;
      
      if (translated) {
        // Apply custom Hinglish mapping as a final polish
        const mappedTranslation = preprocessHinglish(text);
        if (mappedTranslation !== text) {
          translated = mappedTranslation;
        }

        setTranslationData({
          originalText: text,
          translatedText: translated,
          detectedLang: "NEURAL_LINK"
        });
        setShowTerminal(true);
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
