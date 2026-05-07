/**
 * TTSService
 * Provides humanoid voice feedback for J.A.R.V.I.S.
 * 
 * UPGRADED: Now uses AudioContext for more robust binary audio playback,
 * which is more reliable for real-time streaming and avoiding browser locks.
 */

let currentAudio = null;
let audioContext = null;
let sourceNode = null;

const TTSService = {
  /**
   * getAudioContext
   * Lazily initializes the AudioContext (must be done after user gesture).
   */
  getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  },

  /**
   * speak
   * Converts text to humanoid speech via Web Speech API (fallback).
   */
  speak(text) {
    if (!text || !window.speechSynthesis) return;
    
    this.stop();

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
      utterance.rate = 1.05; 
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
   * Plays an audio blob (from backend TTS or WebSocket binary).
   * Now uses AudioContext for superior binary handling.
   */
  async playAudio(audioBlob) {
    console.log('[TTSService] playAudio request received. Blob size:', audioBlob.size);
    
    if (!audioBlob || audioBlob.size === 0) {
      console.warn('[TTSService] Empty audio blob, skipping.');
      return;
    }

    try {
      this.stop();
      
      const ctx = this.getAudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      console.log('[TTSService] Decoding audio data...');
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      console.log('[TTSService] Audio decoded successfully. Duration:', audioBuffer.duration.toFixed(2), 's');
      
      sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(ctx.destination);
      
      return new Promise((resolve) => {
        sourceNode.onended = () => {
          console.log('[TTSService] Audio playback finished.');
          sourceNode = null;
          resolve();
        };
        
        sourceNode.start(0);
        console.log('[TTSService] Audio source started.');
      });
    } catch (error) {
      console.error('[TTSService] Playback failed:', error);
      // Last resort fallback: try traditional Audio object if decoding fails
      return this.playAudioFallback(audioBlob);
    }
  },

  /**
   * playAudioFallback
   * Traditional HTML5 Audio object fallback.
   */
  playAudioFallback(audioBlob) {
    console.log('[TTSService] Using HTML5 Audio fallback...');
    return new Promise((resolve) => {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      currentAudio = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };

      audio.onerror = (e) => {
        console.error('[TTSService] Fallback failed:', e);
        URL.revokeObjectURL(url);
        if (currentAudio === audio) currentAudio = null;
        resolve();
      };
      
      audio.play().catch(e => {
        console.error('[TTSService] Play() failed:', e);
        resolve();
      });
    });
  },

  /**
   * stop
   * Stops all currently playing audio across all engines.
   */
  stop() {
    // 1. Stop Web Speech API
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    // 2. Stop HTML5 Audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    
    // 3. Stop AudioContext Source
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch (e) {
        // Source might have already stopped
      }
      sourceNode = null;
    }
  },

  /**
   * isPlaying
   * Returns whether audio is currently playing in any engine.
   */
  isPlaying() {
    const isSpeechPlaying = window.speechSynthesis ? window.speechSynthesis.speaking : false;
    const isAudioPlaying = currentAudio ? !currentAudio.paused : false;
    const isNodePlaying = !!sourceNode;
    return isSpeechPlaying || isAudioPlaying || isNodePlaying;
  }
};

export default TTSService;
