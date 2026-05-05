import { useState, useCallback } from 'react';
import GroqService from '../services/GroqService';
import TTSService from '../services/TTSService';

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

    const response = await GroqService.askJarvis(text);
    
    setAiResponse(response);
    setIsThinking(false);
    TTSService.speak(response);
  }, [lastProcessedTextRef]);

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
          
          handleBrainInteraction(result.text);
        }
        setIsProcessing(false);
        return;
      }

      // Fallback Google Translate
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
