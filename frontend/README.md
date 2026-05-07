# J.A.R.V.I.S — Neural HUD Interface
**Jointly Advanced & Real-time Visionary Intelligence System — Neural Link**

The frontend is a premium React application designed to act as a futuristic HUD (Heads-Up Display). It combines real-time data streaming with cinematic animations and a highly reactive design system.

---

## 💎 The Design Philosophy

J.A.R.V.I.S uses **Advanced Glassmorphism**:
- **Transparency**: Every element feels like it is projected onto a glass surface.
- **Micro-Animations**: Subtle glows and pulses that make the interface feel alive.
- **Dynamic HUD**: Terminals and status bars that slide and expand based on system activity.

---

## 📡 Core Technologies

### 1. The Neural Core (FireAIBlob)
- **WebGL Rendering**: Uses Three.js to create a sphere composed of thousands of particles.
- **Frequency Analysis**: When you speak, the `useSpeech` hook sends audio frequency data to the core. The core then uses these values to displace the particles, creating a unique "visual voiceprint."

### 2. The Audio Engine (`TTSService`)
- **Direct Decoding**: Instead of using a simple `<audio>` tag, we use the **Web Audio API**. 
- **Binary Stream Processing**: When raw MP3 bytes arrive via WebSocket, they are decoded instantly in the browser's memory using `AudioContext.decodeAudioData()`. This prevents the "popping" and loading delays common in standard web audio.
- **Gesture Protection**: Modern browsers block audio until a user interacts. The "INITIALIZE" button is specifically designed to unlock the `AudioContext` and microphone in one go.

### 3. Neural Hooks
- **`useBrain`**: A custom hook that manages a singleton WebSocket connection. It handles auto-reconnection and parses incoming JSON/Binary mixed streams.
- **`useSpeech`**: Wraps the native `SpeechRecognition` API. It features a smart "Silence Threshold" (1.5s) that automatically submits your speech to the brain once you finish your thought.

---

## 📂 Component Map

- **`BrainTerminal`**: The conversation log. It uses a custom auto-scrolling engine to keep up with streaming AI tokens.
- **`VoiceControl`**: The subtitle overlay. It shows your voice input in real-time with a live "listening" wave animation.
- **`SystemStatus`**: A HUD widget that displays the "Health" of your connection to the J.A.R.V.I.S backend.
- **`SplashScreen`**: A cinematic entry sequence that prepares the user for the experience.

---

## 🚦 Interaction Guide

1. **Neural Link**: Click **INITIALIZE** at the top right to start the system.
2. **Conversation**: Speak clearly. Your voice will appear at the bottom.
3. **Response**: The AI response will stream into the side terminal, and the voice will play automatically.
4. **Customization**: Use the **SETTINGS** menu to change the core's color (Fire Orange, Plasma Blue, etc.) or scale.

---

*“Everything is under control, sir. J.A.R.V.I.S is operating at 100% capacity.”*
