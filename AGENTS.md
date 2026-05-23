# J.A.R.V.I.S Agent Guide

**Jointly Advanced & Real-time Visionary Intelligence System v3.1**

A high-fidelity voice-first AI assistant with real-time streaming, RAG memory, and integrated tool suite.

---

## 🎯 Project Overview

- **Type**: Fullstack application (voice-driven AI assistant)
- **Key Feature**: Real-time bi-directional WebSocket communication, parallel text/audio streaming, vision context
- **Setup**: Single `npm run dev` starts both Python backend + React frontend concurrently

---

## 🛠️ Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| **Frontend** | React 19 + Three.js | HUD, particle visualizer, real-time telemetry |
| **Backend** | Python 3.10+ + FastAPI | Core processing, WebSocket server |
| **AI Brain** | Groq LLM (Llama 3.1) | Ultra-fast inference |
| **STT** | Whisper (cloud) + Vosk (local) | Speech-to-text with fallback |
| **TTS** | Edge Neural TTS | Voice output streaming |
| **Memory** | ChromaDB | RAG vector embeddings, semantic recall |
| **Vision** | Screenshot capture + processing | Screen context for debugging/coding help |

---

## 📁 Directory Structure

```
J.A.R.V.I.S/
├── frontend/                    # React HUD + visualizer
│   ├── src/
│   │   ├── components/          # React UI components
│   │   ├── hooks/               # Custom hooks (useBrain, useSpeech)
│   │   ├── services/            # API/WebSocket services (TTSService, STTService)
│   │   └── styles/              # Global CSS + component styles
│   └── package.json
├── backend/                     # FastAPI server + AI core
│   ├── main.py                  # FastAPI server, WebSocket endpoint
│   ├── core/
│   │   ├── processor.py         # Main logic (LLM calls, tool routing)
│   │   ├── memory.py            # ChromaDB RAG layer
│   │   ├── tool_registry.py     # Extensible tool system
│   │   └── vision.py            # Screenshot + vision analysis
│   ├── stt_service.py           # Whisper + Vosk pipeline
│   ├── tts_service.py           # Edge TTS streaming
│   ├── requirements.txt         # Python dependencies
│   └── venv_jarvis/             # Python virtual environment
├── .env                         # Shared config (GROQ_API_KEY, BACKEND_PORT)
├── package.json                 # Root scripts (dev, build, test)
└── README.md                    # Full documentation

```

---

## 🚀 Development Commands

```bash
# Install all deps (Node + Python)
npm install

# Start both backend + frontend concurrently
npm run dev

# Frontend only (requires backend running separately)
npm start

# Backend only
npm run backend

# Build React app for production
npm run build

# Run React tests
npm test

# Sync .env to frontend/ and backend/ subdirs (auto-runs with dev/start/backend)
npm run sync-env
```

---

## 🧠 Core Architecture Patterns

### 1. **WebSocket Bi-Directional Streaming**
- **File**: `backend/main.py` → `/ws` endpoint
- **Protocol**: JSON messages (text input) + binary chunks (audio output)
- **Pattern**: Client sends text/voice → Server processes + streams response text + audio simultaneously
- **Key Feature**: Parallel streaming = low latency response

### 2. **Modular Tool Registry**
- **File**: `backend/core/tool_registry.py`
- **Pattern**: Lazy-loaded tool manifesto; tools register themselves at runtime
- **Use**: Extend J.A.R.V.I.S capabilities by adding new tool classes
- **Examples**: File I/O, web search, terminal commands, PDF export, weather

### 3. **ChromaDB RAG Memory**
- **File**: `backend/core/memory.py`
- **Pattern**: Semantic embeddings + timestamped recall
- **Behavior**: Automatically chunks long conversations, rebuilds vector DB on-demand
- **When Used**: Processor queries memory for historical context before LLM calls

### 4. **Hybrid STT Pipeline**
- **File**: `backend/stt_service.py`
- **Pattern**: Try Whisper (cloud) → fallback to Vosk (local) if network fails
- **Goal**: Always-on listening, zero drops during connectivity issues

### 5. **Resilient Audio Queue (TTS)**
- **File**: `backend/tts_service.py`
- **Pattern**: Chunked streaming with frame loss recovery
- **Behavior**: If audio packet lost, queue auto-repairs and continues

---

## 📋 Module Responsibilities

### **Frontend** (`frontend/src/`)
- **HUD Components**: Voice button, memory indicator, tool status badges, system vitals (CPU/RAM)
- **Three.js Visualizer**: Real-time particle animation triggered by audio frequency data
- **WebSocket Client**: Bi-directional message/audio streaming
- **Custom Hooks**:
  - `useBrain()`: Manages conversation state, LLM response buffering
  - `useSpeech()`: Handles microphone I/O, real-time audio capture

### **Backend - Processor** (`backend/core/processor.py`)
- Main orchestrator: receives text input → queries memory → calls Groq LLM → routes to tools → streams response
- Handles error recovery, timeout logic, tool manifest lazy-loading
- Integrates all subsystems (memory, STT, TTS, tools, vision)

### **Backend - Memory** (`backend/core/memory.py`)
- ChromaDB vector store wrapper
- Semantic search for historical context
- Auto-chunking and summarization for long conversations
- Timestamped metadata for freshness

### **Backend - Tools** (`backend/core/tool_registry.py`)
- Extensible tool system; tools register themselves on init
- Built-in tools: file I/O, web search (DuckDuckGo), terminal, PDF export, weather
- Tool filtering for security (destructive commands blocked)

### **Backend - Vision** (`backend/core/vision.py`)
- Screenshot capture (Windows)
- Optional OCR/visual analysis of screen content
- Used for context-aware coding help, debugging visuals

---

## 🔧 Common Agent Tasks

### Adding a New Tool
1. Create tool class inheriting from base `Tool` in `tool_registry.py`
2. Implement `execute()` method
3. Register in `__init__()` with metadata (name, description, params)
4. Tool is auto-discovered on backend restart

### Fixing WebSocket Communication Issues
- Check `backend/main.py` `/ws` endpoint for protocol violations
- Verify frontend sends expected JSON schema (text, audio timestamps)
- Check backend logs for `WebSocketDisconnect` errors
- Verify CORS middleware allows frontend origin

### Improving RAG Memory Recall
- Review `backend/core/memory.py` chunking strategy
- Check ChromaDB similarity threshold in queries
- Monitor `memory_db/` directory growth (rebuild if corrupted)

### Enhancing HUD Responsiveness
- Check `frontend/src/hooks/useBrain.js` for state update debouncing
- Review WebSocket message batch sizes (too small = UI jank)
- Verify Three.js visualizer runs off-thread (Web Workers if needed)

### Debugging STT Failures
- Check `backend/stt_service.py` Whisper API latency
- Verify Vosk local model loaded on startup
- Monitor audio buffer for silence detection false positives
- Check microphone permissions in browser console

---

## 🛡️ Security & Safety

- **Command Filter**: `processor.py` blocks destructive shell commands (rm -rf, dd, etc.)
- **Rate Limiting**: Not yet implemented; add if public-facing
- **API Key**: GROQ_API_KEY stored in `.env` (never in code)
- **CORS**: Currently open (`*`); restrict in production

---

## 🎯 Important Conventions

1. **Environment Sync**: Always run `npm run sync-env` before dev; it's auto-included in `npm run dev`
2. **Backend Port**: Defaults to 8000; set `BACKEND_PORT` in `.env` if needed
3. **Frontend Port**: Defaults to 3000; React dev server auto-configures
4. **Async/Await**: All I/O is async; never block event loop
5. **Tool Execution**: Tools run in thread pool (non-blocking)
6. **Memory Queries**: Always await ChromaDB calls; chunking happens automatically
7. **WebSocket Messages**: Use JSON for control, binary for audio streams (not mixed in single frame)

---

## 📊 Performance Notes

- **Sub-2s Startup**: Lazy-loads heavy tools (PDF, Word generation) only when requested
- **Gapless Audio**: Intelligent queue prevents pauses between TTS chunks
- **Resilient Handshake**: Frontend/backend re-sync if either gets overloaded
- **Zero Disk I/O in Main Loop**: Audio buffered in RAM, only writes on export

---

## 🔗 Related Docs

- [README.md](README.md) — Full system architecture & features
- `.env` — Configuration (GROQ_API_KEY, BACKEND_PORT)
- `package.json` — NPM scripts & dependencies

