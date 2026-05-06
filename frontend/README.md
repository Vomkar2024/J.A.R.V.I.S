# J.A.R.V.I.S - Frontend UI

**Just A Rather Very Intelligent System - Neural Interface**

A premium, interactive AI assistant interface built with **React**, designed to provide a cinematic and highly responsive user experience. This interface serves as the primary touchpoint for interacting with the J.A.R.V.I.S core.

---

## 🚀 Key Features

### 1. **Interactive AI Core (FireAIBlob)**
- **Visual Engine**: Built with Three.js (WebGL).
- **Voice Reactive**: Animates and pulses based on real-time microphone volume.
- **Customizable**: Change colors, scale, and sensitivity via the Neural Interface settings.

### 2. **Neural Terminals**
- **BrainTerminal**: Displays live AI thinking states and types out responses with a futuristic terminal effect.
- **VoiceControl**: Shows real-time user transcription (subtitles) as you speak.
- **TranslationTerminal**: Automatic detection and display of language translations.

### 3. **Cinematic UX**
- **Startup Sequence**: A high-fidelity splash screen that initializes system resources.
- **Glassmorphism**: Sleek, translucent UI elements following modern design standards.
- **Absolute Imports**: Clean codebase using absolute paths (e.g., `import Navbar from 'component/Navbar'`).

---

## 🏗️ Architecture

### 🧠 Logic Hooks
- `useSpeech`: Manages microphone access, volume analysis, and local speech recognition.
- `useBrain`: Handles all communication with the Python backend and manages AI state.

### 🔌 Services
- `GroqService`: Direct integration with Groq API for text-based interactions.
- `TTSService`: Handles audio playback and local speech synthesis fallbacks.

---

## 📂 Project Structure
```
frontend/
├── src/
│   ├── component/
│   │   ├── core/        # Logic-heavy components (Terminals, VoiceControl)
│   │   ├── css/         # Global and shared component styling
│   │   ├── Navbar.js    # System configuration control
│   │   └── blob.js      # Three.js AI visualizer
│   ├── hooks/           # Custom React hooks (useBrain, useSpeech)
│   ├── services/        # API and TTS service layers
│   ├── App.js           # Main Neural Link controller
│   └── index.js         # Entry point
├── .env                 # API URL and Keys
└── jsconfig.json        # Path mapping for absolute imports
```

---

## 🚦 Getting Started
1. Install dependencies: `npm install`
2. Configure `.env` with `REACT_APP_API_URL`.
3. Start the interface: `npm start`
