# J.A.R.V.I.S v2.0
**Just A Rather Very Intelligent System — Real-Time Edition**

J.A.R.V.I.S is a professional, production-ready AI voice assistant designed for extreme performance and low-latency interaction. Unlike traditional request-response AI apps, J.A.R.V.I.S v2.0 uses a bidirectional **WebSocket architecture** to deliver instant token streaming and gapless audio playback.

---

## 🏗️ System Architecture

The system is built on a high-performance, real-time pipeline:

### 1. [The Neural Frontend (React)](./frontend)
The interactive HUD (Heads-Up Display) for J.A.R.V.I.S.
- **WebSocket Hook**: Persistent connection to the brain for instant feedback.
- **Streaming UI**: Tokens appear in real-time as the AI thinks.
- **Audio Engine**: Upgraded to **Web Audio API (`AudioContext`)** for binary stream decoding.
- **Voice Control**: Native browser Speech Recognition with silence detection.

### 2. [The Processing Brain (Python/FastAPI)](./backend)
The logic engine that orchestrates intelligence and synthesis.
- **Neural WebSocket**: Handles bidirectional chat, binary audio delivery, and state management.
- **Intelligence**: Powered by **Groq (Llama 3.1 8B Instant)** for sub-second responses.
- **Voice Synthesis**: **Edge TTS** for high-quality, neural humanoid voices.
- **Memory**: Conversation history management for context-aware interactions.

---

## 🚀 Key Features

- **Bidirectional Streaming**: No more "waiting" for the AI. See tokens appear instantly and hear the voice while the response is still generating.
- **Gapless Audio**: MP3 chunks are delivered via binary WebSocket frames and decoded in memory.
- **Futuristic HUD**: Premium glassmorphism design with reactive particle blobs and real-time system status indicators.
- **Silence Detection**: Smart microphone management that knows exactly when you've finished speaking.

---

## 📂 Project Structure

```
J.A.R.V.I.S/
├── backend/             # Python logic, WebSocket engine, and AI Processor
├── frontend/            # React HUD, Web Audio services, and Neural hooks
├── .env                 # Central configuration for API keys and ports
├── package.json         # Orchestration scripts for the full system
└── README.md            # You are here
```

---

## 🚦 Getting Started

### 1. Prerequisite Setup
Ensure you have Node.js and Python 3.10+ installed.

### 2. Environment Configuration
Create a `.env` file in the root directory (the system will sync it automatically):
```env
# Backend
GROQ_API_KEY=your_key_here
BACKEND_PORT=8000

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

### 3. Launch the Full System
To start both the backend and frontend in parallel with colored logs:
```bash
npm run dev
```

---

## 🛠️ Tech Stack

- **Core**: Python 3, JavaScript (React)
- **API**: FastAPI, Uvicorn, WebSockets
- **AI**: Groq (Llama 3.1, Whisper Large V3 Turbo)
- **Voice**: Edge-TTS, Web Audio API
- **Styling**: Vanilla CSS (Advanced Glassmorphism)

---

*“Welcome home, sir. J.A.R.V.I.S is back online.”*