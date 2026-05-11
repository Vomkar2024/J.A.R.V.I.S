# J.A.R.V.I.S — Backend Intelligence Layer
**Jointly Advanced & Real-time Visionary Intelligence System — Neural Core**

The backend is a high-performance FastAPI application serving as the central nervous system for J.A.R.V.I.S. It manages a sophisticated pipeline of STT, LLM, and TTS modules while handling long-term memory and environmental interactions.

---

## ⚙️ Technical Architecture

### 1. The Neural Processor (`core/processor.py`)
The `JarvisProcessor` class is the heart of the system. It orchestrates:
- **Streaming LLM**: Uses Groq LPU™ for lightning-fast token generation.
- **RAG Memory**: Integrated **ChromaDB** for persistent vector storage of past interactions.
- **Vision Engine**: High-fidelity screen analysis using advanced computer vision models.
- **Recursive Summarization**: Automatically condenses conversation history when token limits are approached.

### 2. Predictive Telemetry System
The backend utilizes `psutil` to monitor system vitals:
- **Live Monitoring**: CPU and RAM usage are sampled every 5 seconds.
- **Trend Analysis**: The system maintains a rolling window of metrics to identify sustained spikes.
- **Proactive Intervention**: If a critical load is detected, J.A.R.V.I.S will inject a system alert into the chat stream to warn the user.

### 3. Unified Tool Registry
J.A.R.V.I.S can interact with the host system via a safe tool-calling interface:
- **File Ops**: CRUD operations on the local filesystem.
- **Terminal**: Execution of shell commands (PowerShell/CMD).
- **Web**: Real-time searching and weather retrieval.
- **Export**: Dynamic generation of PDF/Word documents for session logging.

---

## 📡 WebSocket Protocol (`/ws`)

### Message Types (Outbound)
| Type | Data Description |
| :--- | :--- |
| `status` | Current AI state (`thinking`, `speaking`, `memory_access`, `tool_use`, `observing`) |
| `token` | Individual text tokens from the LLM stream |
| `telemetry` | JSON object containing `cpu`, `ram`, and `status` |
| `audio_start` | Signal that binary audio frames are about to follow |
| `response_end` | Final full text of the response for logging |

### Message Types (Inbound)
| Type | Description |
| :--- | :--- |
| `chat` | User input text |
| `clear_history` | Wipe the local session memory |
| `ping` | Keep-alive heartbeat |

---

## 📂 Internal Directory Map

- `core/processor.py`: Orchestration logic for all AI modules.
- `core/memory.py`: ChromaDB integration for RAG.
- `core/vision.py`: Visual perception and screen capture logic.
- `core/tool_registry.py`: Definition and execution logic for external tools.
- `memory_db/`: Persistent storage for vector embeddings.
- `temp/`: Scratch space for generating audio and document exports.

---

*“I design my own systems, I believe in performance.”*

