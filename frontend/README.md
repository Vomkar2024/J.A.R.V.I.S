# J.A.R.V.I.S — Frontend HUD
**Just A Rather Very Intelligent System — Neural Interface**

A professional, high-fidelity AI assistant interface built with **React**. This HUD (Heads-Up Display) provides a cinematic experience with real-time feedback, reactive 3D visuals, and low-latency voice interaction.

---

## 🚀 Advanced Interaction HUD

The frontend is engineered for perceived speed and visual excellence:

### 1. Neural Interface (FireAIBlob)
- **3D Engine**: Three.js WebGL visualizer.
- **Microphone Reactive**: The central core pulses and distorts in real-time based on your voice frequency and volume.
- **Draggable**: Unlock the core to move it anywhere on your HUD.

### 2. Live Terminals
- **BrainTerminal**: A conversation-style hub showing user history and **streaming AI tokens** as they arrive. Includes a LIVE badge and futuristic cursor blinking.
- **VoiceControl**: Real-time subtitles that display your speech as you talk, with built-in silence detection to trigger the AI.
- **SystemStatus**: A real-time HUD bar showing WebSocket connection status and AI thinking/speaking states.

---

## 🏗️ Logic & Hooks

### `useBrain` (WebSocket Client)
- **Real-Time Communication**: Replaces traditional HTTP with a persistent WebSocket link.
- **Streaming Tokens**: Updates the UI character-by-character for zero-wait responses.
- **Binary Audio**: Receives raw MP3 bytes from the backend and routes them to the Audio Engine.

### `useSpeech` (Voice Engine)
- **Smart Listening**: Uses browser `SpeechRecognition` for instant transcription.
- **Silence Detection**: Automatically detects a 1.5-second pause to send your message to the brain.
- **Volume Analysis**: Provides frequency data to the 3D visualizer.

### `TTSService` (Audio Engine)
- **Web Audio API**: Uses `AudioContext` to decode and play binary MP3 streams in memory.
- **Humanoid Fallback**: Uses browser Web Speech API if the neural backend is unavailable.

---

## 📂 Internal Structure

```
frontend/
├── src/
│   ├── component/       # UI Components (Navbar, Terminals, Status)
│   │   ├── css/         # Premium Glassmorphism styling
│   │   └── blob.js      # Three.js Neural Core visualizer
│   ├── hooks/           # useBrain (WebSocket) & useSpeech (Mic)
│   ├── services/        # TTSService (Web Audio API)
│   ├── App.js           # Neural Link Orchestrator
│   └── App.css          # Global Design System
├── public/              # Futuristic assets and HTML entry
└── jsconfig.json        # Path mappings
```

---

## 🚦 Startup

1. **Installation**:
   ```bash
   npm install
   ```

2. **Configuration**:
   Ensure `REACT_APP_API_URL` in `.env` points to your backend (default: `http://localhost:8000`).

3. **Execution**:
   ```bash
   npm start
   ```

---

*“The future is what we build today.”*
