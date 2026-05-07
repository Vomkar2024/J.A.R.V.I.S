# J.A.R.V.I.S — Backend Engine
**Just A Rather Very Intelligent System — Neural Processing Layer**

The backend is a high-performance Python application built with **FastAPI** and **WebSockets**. It acts as the "Brain" of the system, orchestrating real-time speech processing, streaming intelligence, and neural voice synthesis.

---

## 🧠 Core Neural Architecture

The system transitions from legacy REST to a **Real-Time Streaming Pipeline**:

### 1. The WebSocket Engine (`main.py`)
- **Path**: `/ws`
- **Protocol**: Bidirectional WebSocket
- **Function**: Manages persistent connections. It receives text from the user and streams back tokens (text) and binary audio chunks (TTS) in a unified session.

### 2. The Processor Layer (`core/processor.py`)
- **Streaming LLM**: Uses **Groq (Llama 3.1 8B Instant)** to yield response tokens as they are generated.
- **Contextual Memory**: Automatically maintains a rolling history of the last 10 exchanges for context-aware conversations.
- **Binary TTS**: Converts text to raw MP3 bytes using **Edge TTS** (`en-GB-RyanNeural`).
- **High-Speed STT**: Powered by **Whisper Large V3 Turbo** for near-instant transcription.

---

## 📡 Interfaces & Endpoints

### Real-Time Interface
| Channel | Type | Payload | Description |
| :--- | :--- | :--- | :--- |
| `/ws` | `WebSocket` | JSON / Binary | **Main Interaction Loop**. Handles real-time chat, status updates, and audio. |

### Legacy REST Fallbacks
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | `GET` | Verifies Neural Engine and AI connectivity. |
| `/ask` | `POST` | Traditional text request (Synchronous). |
| `/tts` | `POST` | Traditional text-to-speech file generation. |

---

## 🛠️ Tech Stack

- **Framework**: FastAPI (Asynchronous Python)
- **Networking**: `websockets`, `uvicorn[standard]`
- **AI Infrastructure**: Groq Cloud (LPU Powered)
- **Voice Synthesis**: `edge-tts` (Microsoft Neural Voices)
- **Environment**: `python-dotenv`

---

## 📂 Internal Structure

```
backend/
├── core/
│   ├── processor.py     # AI Pipeline Logic (LLM, TTS, STT)
│   └── __init__.py
├── temp/                # Workspace for temporary data processing
├── main.py              # WebSocket server & API Gateway
├── test_tts.py          # Diagnostic script for voice synthesis
└── requirements.txt     # Neural dependencies
```

---

## 🚦 System Startup

1. **Environment Setup**:
   Ensure your `GROQ_API_KEY` is present in the `.env` file.

2. **Installation**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Execution**:
   ```bash
   python main.py
   ```
   *The server will start on `http://localhost:8000` with the WebSocket active at `ws://localhost:8000/ws`.*

---

*“Logic is the beginning of wisdom, not the end.”*
