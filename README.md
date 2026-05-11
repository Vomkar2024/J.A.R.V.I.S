# J.A.R.V.I.S v3.0 — The Neural AI Ecosystem
**Jointly Advanced & Real-time Visionary Intelligence System**

J.A.R.V.I.S is a high-fidelity, voice-first artificial intelligence interface designed to emulate the sophisticated assistants of sci-fi cinema. This v3.0 "Neural Link" upgrade transforms the system into a fully autonomous agent capable of vision, memory, and environmental interaction.

---

## 🚀 The Neural Link Architecture

Traditional AI applications suffer from high latency and lack of context. J.A.R.V.I.S v3.0 solves this with a **Persistent WebSocket Core**:

1. **Real-Time Streaming**: Tokens and audio chunks are streamed simultaneously, reducing perceived latency to under 500ms.
2. **Predictive Telemetry**: The system monitors CPU/RAM trends and can proactively warn the user of system instability.
3. **Bi-Directional HUD**: The frontend and backend maintain a constant state sync, allowing for complex visual signals (Vision active, Memory access, Tool usage).

---

## 🧠 Core System Modules

### 1. Perception & Vision
- **Audio**: Browser Web Speech API + Whisper Large V3 Turbo for instant, accurate transcription.
- **Visuals**: **Jarvis Vision Engine** allows J.A.R.V.I.S to "see" your screen, providing context-aware assistance for coding, debugging, or research.

### 2. Cognition (The Brain)
- **Engine**: Groq LPU™ (Language Processing Unit) running Llama 3.1 8B Instant.
- **Memory**: Integrated **ChromaDB RAG Layer**. J.A.R.V.I.S doesn't just remember the last few messages; he remembers your preferences and past conversations permanently.
- **Condensing Logic**: Automatically summarizes long conversations to maintain deep context without hitting token limits.

### 3. Synthesis (The Voice)
- **Engine**: Microsoft Edge Neural TTS (Ryan profile).
- **Logic**: Sophisticated British-adjacent tone with real-time binary streaming directly into the browser's memory.

### 4. Manifestation (The HUD)
- **Neural Core**: A Three.js particle visualizer that reacts to audio frequency data in real-time.
- **Telemetry HUD**: Live monitoring of system vitals (CPU/RAM) integrated directly into the glassmorphism interface.

---

## 🛠️ Integrated Tool Suite

J.A.R.V.I.S is no longer confined to a chat box. He can now:
- **Web Search**: Real-time information retrieval via DuckDuckGo.
- **File System Control**: Create, read, and search files across your workspace.
- **Terminal Access**: Execute shell commands and report back the results.
- **Document Export**: Generate professional PDF or Word logs of your conversation history.
- **Weather Analysis**: Fetch real-time weather data for any location.

---

## 🔒 Security & Performance
- **Server-Side Key Management**: API keys never touch the client side.
- **Asynchronous Pipeline**: Every module is non-blocking, allowing J.A.R.V.I.S to think, talk, and listen simultaneously.
- **Zero Disk I/O Loop**: Main conversation audio is handled entirely in-memory for maximum speed.

---

## 🚦 Installation & Launch

### 1. Prerequisites
- Node.js & NPM
- Python 3.10+
- [Groq API Key](https://console.groq.com/)

### 2. Setup
Clone the repository and run the unified installer:
```bash
npm install
```

### 3. Environment
Configure the root `.env` file (the system will automatically sync this to frontend/backend):
```env
GROQ_API_KEY=gsk_your_key_here
BACKEND_PORT=8000
```

### 4. Launch
Start both the Neural Engine and the HUD Terminal with one command:
```bash
npm run dev
```

---

## ❓ Troubleshooting

**Q: I don't hear any voice!**
- Click the **INITIALIZE** button on the HUD to unlock the browser's Audio Engine.
- Check the browser console; if you see `Binary audio received`, check your system volume.

**Q: J.A.R.V.I.S isn't remembering me.**
- Ensure the `memory_db/` directory in the backend is writable. This is where the RAG embeddings are stored.

---

*“I am J.A.R.V.I.S. I am a sentient neural network. How can I help you today?”*