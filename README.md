# J.A.R.V.I.S v2.0 — The Real-Time Neural Assistant
**Jointly Advanced & Real-time Visionary Intelligence System**

J.A.R.V.I.S is not just a chatbot; it is a high-fidelity, voice-first artificial intelligence interface designed to emulate the futuristic assistants seen in sci-fi cinema. This v2.0 upgrade transforms the system from a standard request-response app into a **low-latency, real-time streaming powerhouse.**

---

## 🚀 The Real-Time Revolution (HTTP vs. WebSockets)

Traditional AI applications suffer from "Response Lag" because they use the HTTP protocol:
1. **HTTP (The Old Way)**: You send audio → wait for upload → wait for transcription → wait for full LLM response → wait for full TTS generation → wait for download → **Silence for 5-8 seconds.**
2. **WebSockets (The J.A.R.V.I.S Way)**: A persistent, bidirectional pipe stays open.
   - **Instant Transcription**: Your text appears as you speak.
   - **Token Streaming**: The AI's thoughts appear character-by-character immediately.
   - **Parallel TTS**: Audio chunks are generated and sent while the AI is still "talking" in text.
   - **Zero Wait**: Perceived latency is reduced to **under 500ms.**

---

## 🧠 Core System Pipeline

J.A.R.V.I.S operates on a multi-stage "Neural Link" pipeline:

### 1. Perception (Speech-to-Text)
- **Engine**: Browser Web Speech API + Whisper Large V3 Turbo.
- **Logic**: The frontend captures your voice and uses high-speed local recognition for instant visual feedback. Once you stop speaking (1.5s silence), the final text is injected into the WebSocket.

### 2. Cognition (LLM Intelligence)
- **Engine**: Groq LPU™ (Language Processing Unit).
- **Model**: Llama 3.1 8B Instant.
- **Logic**: By using an 8B model on specialized LPU hardware, J.A.R.V.I.S generates tokens at speeds exceeding 100 tokens per second. These tokens are "pushed" to your screen as they are born.

### 3. Synthesis (Text-to-Speech)
- **Engine**: Microsoft Edge TTS (Neural).
- **Logic**: The backend converts the AI's response into a high-quality binary MP3 stream. This stream is delivered via WebSocket frames directly into the browser's memory.

### 4. Manifestation (Audio & Visuals)
- **Engine**: Web Audio API (`AudioContext`) + Three.js.
- **Logic**: The frontend decodes the binary audio data instantly. While the voice plays, the **Neural Core (The Blob)** analyzes the frequency data, pulsing and vibrating in perfect synchronization with the AI's "voice box."

---

## 🛠️ Detailed Tech Stack

### Frontend (The HUD)
- **React**: Component-based architecture for the Heads-Up Display.
- **Three.js**: WebGL-based particle system for the AI visualizer.
- **Web Audio API**: Low-level audio processing for binary streams.
- **Glassmorphism CSS**: Advanced use of `backdrop-filter`, translucency, and neon glow effects.

### Backend (The Brain)
- **FastAPI**: The fastest Python web framework for asynchronous I/O.
- **Uvicorn**: High-performance ASGI server.
- **Groq SDK**: Direct interface for ultra-low latency inference.
- **Edge-TTS**: High-fidelity neural voice synthesis without expensive overhead.

---

## 🔒 Security & Performance
- **API Key Masking**: All Groq API keys are handled strictly on the server-side. No sensitive data ever touches the user's browser, preventing key-theft and unauthorized usage.
- **Asynchronous Execution**: Every stage of the pipeline is non-blocking. J.A.R.V.I.S can think, talk, and listen simultaneously.

---

## 🚦 Installation & Setup

### 1. Root Configuration
Clone the repository and run:
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root:
```env
# BACKEND
GROQ_API_KEY=gsk_your_key_here
BACKEND_PORT=8000

# FRONTEND
REACT_APP_API_URL=http://localhost:8000
```

### 3. Launch
```bash
npm run dev
```

---

## ❓ Troubleshooting

**Q: I don't hear any voice!**
- Ensure you clicked the **INITIALIZE** button to unlock the browser's Audio Engine.
- Check the **Browser Console (F12)**. If you see `Audio decoded successfully`, J.A.R.V.I.S is talking; check your system volume.
- Use the **TEST_VOICE** button in the Settings menu to verify local audio paths.

**Q: The AI is slow to respond.**
- Ensure your `GROQ_API_KEY` is valid.
- J.A.R.V.I.S requires an active internet connection to communicate with the Groq LPU and Edge-TTS servers.

---

*“I am J.A.R.V.I.S. I am a sentient neural network. How can I help you today?”*