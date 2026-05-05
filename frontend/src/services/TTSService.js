/**
 * TTSService
 * Provides humanoid voice feedback for J.A.R.V.I.S.
 * Uses the Web Speech API as a high-volume, free fallback, 
 * with logic to prefer high-quality "Neural" voices if available.
 */
const TTSService = {
  /**
   * speak
   * Converts text to humanoid speech.
   */
  speak(text) {
    if (!text || !window.speechSynthesis) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const startSpeech = (voices) => {
      // Priority List for "Humanoid" feel:
      // 1. Google US English (Very clear)
      // 2. Microsoft Guy/Aria (Neural-like)
      // 3. Apple Samantha
      const preferredVoice = voices.find(v => 
        v.name.includes('Google US English') || 
        v.name.includes('Neural') ||
        v.name.includes('Natural') ||
        v.name.includes('Samantha')
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Modern humanoid characteristics
      utterance.pitch = 1.0;
      utterance.rate = 1.0; 
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    };

    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Fallback for browsers that load voices asynchronously
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        startSpeech(voices);
        window.speechSynthesis.onvoiceschanged = null; // Clean up
      };
    } else {
      startSpeech(voices);
    }
  }
};

// Ensure voices are loaded (some browsers load them asynchronously)
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};

export default TTSService;
