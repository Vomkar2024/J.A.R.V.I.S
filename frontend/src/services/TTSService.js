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
    
    // Attempt to find the best "Humanoid" voice
    const voices = window.speechSynthesis.getVoices();
    
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

    // Modern humanoid characteristics: slightly slower and lower pitch
    utterance.pitch = 1.0;
    utterance.rate = 1.0; 
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }
};

// Ensure voices are loaded (some browsers load them asynchronously)
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};

export default TTSService;
