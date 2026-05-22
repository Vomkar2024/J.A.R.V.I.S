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
let analyser = null;
let dataArray = null;

const TTSService = {
  audioQueue: [],
  isProcessingQueue: false,
  /**
   * getAudioContext
   * Lazily initializes the AudioContext (must be done after user gesture).
   */
  getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Setup Analyser
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      // Connect analyser to destination
      analyser.connect(audioContext.destination);
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
   * Queues an audio blob for sequential playback.
   * Supports real-time chunked streaming.
   */
  async playAudio(audioBlob) {
    if (!audioBlob || audioBlob.size === 0) return;
    
    // Add to queue
    this.audioQueue.push(audioBlob);
    
    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  },

  /**
   * processQueue
   * Internal method to play audio blobs in order.
   */
  async processQueue() {
    if (this.audioQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const blob = this.audioQueue.shift();

    try {
      const ctx = this.getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      
      // Attempt to decode binary MP3 chunk using the modern Promise-based API.
      // Wrap in try/catch to handle partial/corrupt stream chunks gracefully.
      let audioBuffer;
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        console.warn('[TTSService] Chunk decoding failed (corrupt or partial stream):', decodeError);
        // Skip this chunk and process the next one to keep the feedback loop active
        this.processQueue();
        return;
      }

      sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(analyser);
      
      sourceNode.onended = () => {
        sourceNode = null;
        this.processQueue();
      };
      
      sourceNode.start(0);
    } catch (error) {
      console.error('[TTSService] Queue processing fatal error:', error);
      this.processQueue();
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
    // 0. Clear Queue
    this.audioQueue = [];
    this.isProcessingQueue = false;

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
  },

  /**
   * getFrequencyData
   * Returns the average frequency intensity (0-1).
   */
  getFrequencyData() {
    if (!analyser || !dataArray) return 0;
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average volume/intensity from frequency bins
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / dataArray.length;
    return average / 255; // Normalize to 0-1
  }
};

export default TTSService;
