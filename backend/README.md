# J.A.R.V.I.S — Backend Intelligence Layer
**Jointly Advanced & Real-time Visionary Intelligence System — Processing Brain**

The backend is a high-performance Python application designed to act as the central nervous system for J.A.R.V.I.S. It handles high-concurrency WebSockets, manages AI personality prompts, and coordinates the STT-LLM-TTS pipeline.

---

## ⚙️ Technical Deep-Dive

### 1. Neural WebSocket Lifecycle (`main.py`)
The backend uses a persistent `/ws` connection. Here is the message lifecycle:
1. **Connection**: Client establishes a link. The backend logs the handshake and prepares a `JarvisProcessor` instance.
2. **Text Inbound**: `{"type": "chat", "text": "..."}`
3. **LLM Activation**: The processor initiates a streaming completion with Groq.
4. **Token Pushing**: Each token is wrapped in a `{"type": "token", "data": "..."}` JSON frame and pushed immediately.
5. **Response Finalization**: Once the LLM is done, `{"type": "response_end"}` is sent.
6. **Voice Generation**: The processor converts the *entire* text response into binary MP3 chunks.
7. **Binary Push**: The backend pushes raw bytes directly to the socket. The client recognizes these as audio blobs.

### 2. The Processor Logic (`core/processor.py`)
- **System Prompt**: JARVIS is injected with a specialized "System Identity" that defines its tone: witty, helpful, sophisticated, and slightly dry.
- **Context Management**: It keeps a `deque(maxlen=10)` of recent messages. This ensures J.A.R.V.I.S remembers what you just said, enabling natural, multi-turn conversations.
- **Edge TTS Integration**: We use an asynchronous stream to capture voice synthesis data without blocking the server.

---

## 🛠️ Performance Optimizations

- **Llama 3.1 8B Instant**: We specifically selected this model for its balance of high intelligence and extreme throughput.
- **Asynchronous I/O**: The entire backend is built using `async/await`. This allows J.A.R.V.I.S to handle multiple simultaneous voice interactions without lag.
- **No Disk I/O**: In the main conversation loop, no files are written to disk. Audio is generated in memory and streamed as bytes, saving 100-200ms of latency per exchange.

---

## 📡 API Reference

### Real-Time Link
- **URL**: `ws://localhost:8000/ws`
- **Incoming JSON**: `{ "type": "chat", "text": "string" }`
- **Outgoing JSON**:
  - `{ "type": "status", "data": "thinking|speaking|idle" }`
  - `{ "type": "token", "data": "string" }`
  - `{ "type": "response_end" }`
  - `{ "type": "audio_start" }`
- **Outgoing Binary**: Raw MP3 byte stream.

### Fallback REST
- **POST `/ask`**: Returns JSON `{ "response": "string" }`.
- **POST `/tts`**: Returns an MP3 file stream.
- **GET `/health`**: Returns `{ "status": "ok", "engine": "J.A.R.V.I.S Core v3" }`.

---

## 📂 Logic Map

- `main.py`: Entry point, WebSocket handlers, and server config.
- `core/processor.py`: The "Brain" containing STT, LLM, and TTS methods.
- `requirements.txt`: Minimal, optimized dependency list.
- `test_tts.py`: A CLI tool for testing voice synthesis independently.

---

*“I design my own systems, I believe in performance.”*
