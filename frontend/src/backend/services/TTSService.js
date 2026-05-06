/**
 * TTSService
 * Provides humanoid voice feedback for J.A.R.V.I.S.
 * Uses the Web Speech API as a high-volume, free fallback, 
 * with logic to prefer high-quality "Neural" voices if available.
 */
let currentAudio = null;

const TTSService = {
  /**
   * speak
   * Converts text to humanoid speech via Web Speech API (fallback).
   */
  speak(text) {
    if (!text || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const startSpeech = (voices) => {
      const preferredVoice = voices.find(v => 
        v.name.includes('Google US English') || 
        v.name.includes('Neural') ||
        v.name.includes('Natural') ||
        v.name.includes('Samantha')
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.pitch = 1.0;
      utterance.rate = 1.0; 
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    };

    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        startSpeech(voices);
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      startSpeech(voices);
    }
  },

  /**
   * playAudio
   * Plays an audio blob returned from the backend (primary).
   */
  playAudio(audioBlob) {
    if (!audioBlob) return;
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    currentAudio = audio;
    
    audio.play().catch(e => console.warn('Audio playback interrupted:', e));
    
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    
    return audio;
  }
};

// Ensure voices are loaded (some browsers load them asynchronously)
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};

export default TTSService;
