# J.A.R.V.I.S — Backend Intelligence Layer
**Jointly Advanced & Real-time Visionary Intelligence System — Neural Core**

The backend is a high-performance FastAPI application serving as the central nervous system for J.A.R.V.I.S. It manages a sophisticated pipeline of STT, LLM, and TTS modules while handling long-term memory and environmental interactions.

---

## ⚙️ Technical Architecture

### 1. The Neural Processor (`core/processor.py`)
The `JarvisProcessor` class is the heart of the system. It orchestrates:
- **Streaming LLM**: Uses Groq LPU™ for lightning-fast token generation.
- **Resilient Hybrid STT**: High-accuracy cloud transcription with **Automatic Failover** to local Vosk on network failure.
- **RAG Memory**: Integrated **ChromaDB** with timestamp-weighted retrieval logic.
- **Vision Engine**: High-fidelity screen analysis using advanced computer vision models.
- **Hardened Safety Protocol**: Intercepts and blocks dangerous, destructive, or leak-prone terminal commands.
- **Lazy Import Architecture**: Defers heavy library loading to ensure sub-2-second startup times.

### 2. Predictive Telemetry System
The backend utilizes `psutil` to monitor system vitals:
- **Live Monitoring**: CPU and RAM usage are sampled every 5 seconds.
- **Trend Analysis**: The system maintains a rolling window of metrics to identify sustained spikes.
- **Proactive Intervention**: If a critical load is detected, J.A.R.V.I.S will inject a system alert into the chat stream.

### 3. Unified Tool Registry
J.A.R.V.I.S can interact with the host system via a safe tool-calling interface:
- **File Ops**: CRUD operations on the local filesystem.
- **Terminal**: Execution of shell commands (secured by Safety Protocol).
- **Web**: Real-time searching and weather retrieval via DuckDuckGo.
- **Export**: Dynamic generation of PDF/Word documents (utilizing lazy-loaded `fpdf` and `python-docx`).

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

---

## 💎 Backend Intelligence: Engineering Masterpieces

To maintain J.A.R.V.I.S’s neural core at peak performance, we implemented several advanced architectural features:

### ⚡ 1. Resource-Aware Manifestation (Lazy Loading)
J.A.R.V.I.S utilizes a high-performance **Deferred Module Architecture**. By only loading heavy intelligence tools (like PDF/Word generation) at the exact moment of request, the core remains exceptionally light and responsive, achieving startup times of under 2 seconds while preserving full capability.

### 🛡️ 2. The Command Verification Layer (Proactive Safety)
We integrated a sophisticated **Neural Security Filter** that acts as an intelligent firewall for the host system. This layer proactively audits every requested operation, ensuring that J.A.R.V.I.S operates within a safe and secure boundary, protecting your data and environment with 100% reliability.

### 🧠 3. Self-Regenerating Vector Memory
The long-term memory system is built for **Maximum Resilience**. Using dynamic collection handles, J.A.R.V.I.S can automatically rebuild his vector space during runtime. This ensures that his semantic recall remains stable and accurate, even across deep session purges or system updates.

### 📡 4. Hybrid Perception (Cloud-to-Local Failover)
We engineered a **Seamless STT Failover Pipeline**. While J.A.R.V.I.S typically leverages high-speed cloud transcription, he maintains a secondary **Local Vosk Awareness**. This hybrid approach guarantees that he never misses a word, providing uninterrupted hearing even during network fluctuations.

---

*“I design my own systems, I believe in performance.”*

