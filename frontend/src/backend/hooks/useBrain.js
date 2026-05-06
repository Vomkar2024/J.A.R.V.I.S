import { useState, useCallback } from 'react';
import GroqService from 'backend/services/GroqService';
import TTSService from 'backend/services/TTSService';

/**
 * useBrain Hook
 * Handles AI interactions and translations.
 */
export const useBrain = (lastProcessedTextRef) => {
  const [translationData, setTranslationData] = useState(null);
  const [aiResponse, setAiResponse] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

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
      const data = await response.json();
      const aiMsg = data.response;
      
      setAiResponse(aiMsg);
      setIsThinking(false);
      
      // Get TTS for this response
      const ttsRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiMsg })
      });
      const audioBlob = await ttsRes.blob();
      TTSService.playAudio(audioBlob);
    } catch (error) {
      console.error('Brain Link Error:', error);
      setIsThinking(false);
    }
  }, [lastProcessedTextRef]);

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
          const aiResponse = response.headers.get('X-AI-Response');

          setTranslationData({
            originalText: "Voice Signal",
            translatedText: userText,
            detectedLang: "JARVIS CORE"
          });
          
          setAiResponse(aiResponse);
          setIsThinking(false);
          TTSService.playAudio(blob);
          setShowTerminal(true);
        }
        setIsProcessing(false);
        return;
      }

      // Fallback for text translation (Google Translate)
      const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=';
      const url = `${GOOGLE_TRANSLATE_API}${encodeURIComponent(text)}`;
      const resp = await fetch(url);
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
      setIsProcessing(false);
    }
  }, [handleBrainInteraction]);

  return {
    translationData,
    aiResponse,
    isThinking,
    isProcessing,
    showTerminal,
    setShowTerminal,
    handleBrainInteraction,
    translateText,
    setAiResponse
  };
};
