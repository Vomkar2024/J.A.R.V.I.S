# J.A.R.V.I.S Developer Guide (CLAUDE.md)

This document provides a comprehensive operational blueprint for developers and AI agents working on the **Jointly Advanced & Real-time Visionary Intelligence System (J.A.R.V.I.S)**. It outlines key development commands, architectural rules, code style guidelines, and crucial connection resiliency systems.

---

## 🚀 Development Command Reference

### 📦 Root Level (Unified Orchestration)
All dependencies and concurrency scripts are managed from the root directory.
* **Install All Dependencies**: `npm install` (Installs React and backend environment configurations)
* **Start Core Application Concurrently**: `npm run dev` (Launches React HUD + FastAPI server concurrently)
* **Sync Environment Files**: `npm run sync-env` (Automatically replicates root `.env` values to frontend/ and backend/ subdirectories)

### 📡 React HUD Frontend (`/frontend`)
The React HUD resides in the `/frontend` directory and is built using React 19 and Three.js.
* **Start React Dev Server**: `npm run start` (Starts development server on http://localhost:3000)
* **Build Production Bundle**: `npm run build` (Compiles React components and assets into the `/build` folder)
* **Run Linter / Verification**: `npm run lint` (Checks frontend files for errors or structural anomalies)
* **Execute Tests**: `npm run test` (Runs React component test suites)

### 🧠 FastAPI Core Backend (`/backend`)
The FastAPI application resides in the `/backend` directory and manages STT/TTS processing, local ChromaDB embeddings, tool executions, and WebSocket stream orchestration.
* **Activate Virtual Environment (Windows PowerShell)**: `.\venv_jarvis\Scripts\Activate.ps1`
* **Activate Virtual Environment (Windows CMD)**: `.\venv_jarvis\Scripts\activate.bat`
* **Activate Virtual Environment (UNIX/macOS)**: `source venv_jarvis/bin/activate`
* **Install Python Dependencies**: `pip install -r requirements.txt`
* **Start Backend Server**: `npm run backend` or `python main.py` (Launches FastAPI on port `8000`)
* **Validate Compilation**: `python -m py_compile main.py core/processor.py core/memory.py`

---

## 🎨 Architectural Design & Coding Guidelines

### 1. Unified React State Management
* **Custom Hooks**: Business logic and state coordination are strictly encapsulated in custom hooks:
  * `useBrain.js`: Encapsulates connection lifecycle, WebSockets state machine, and data processing.
  * `useSpeech.js`: Orchestrates local browser-based/Whisper-based speech capture and visualizer telemetry.
* **Component Styling**: Always leverage dynamic Vanilla CSS classes under `/styles` for precise rendering control. Keep UI responsive and visually stunning (glassmorphic visualizer panels, particle systems, HSL-derived color scales).
* **Component Separation**: Keep HUD layouts modular. Decouple visual assets/Three.js renderers from connection and logical states.

### 2. Python Backend Core Architecture
* **Strict Non-Blocking I/O**: Utilize modern `async`/`await` routines for all networking and pipeline tasks. Any heavy computation (e.g. PDF generation, deep OS tools) must be executed in external executors or background thread pools to avoid blocking the FastAPI event loop.
* **Modular Extensibility**: To extend J.A.R.V.I.S capabilities, subclasses must inherit from `Tool` under `backend/core/tool_registry.py` and register their manifest parameters. This lazy-loads tools and secures them against shell execution vectors.
* **Strict Parameter Typing**: Ensure defensive variable checking and type casting when parsing arguments from the LLM or standard configurations.

---

## 🛡️ Connection & Audio Resilience Architecture

J.A.R.V.I.S is engineered for bulletproof reliability across varying local network interfaces, secure contexts, and high-frequency conversation pipelines. These core resilience pillars must never be bypassed:

### Pillar 1: Dynamic WebSocket Address Resolution
To support mobile testing, local area networks (LANs), and custom domains, J.A.R.V.I.S dynamically resolves connection URIs rather than relying on hardcoded `localhost` schemas.
* **Implementation** (`useBrain.js`):
  ```javascript
  const getApiUrl = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
    }
    const protocol = window.location.protocol;
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:8000`;
  };
  ```
* **Reconnection Protocol**: Employs dynamic exponential backoff with a randomized jitter multiplier andvisibility-aware wakeups (tab focus or network restoration triggers instantaneous re-connection handshakes).

### Pillar 2: True Audio Playback Monitoring (No Self-Talk Feedback)
To prevent the critical feedback loop where J.A.R.V.I.S captures and transcribes his own speech (leading to infinite loops), microphone input is strictly governed by a reactive audio monitor.
* **The Bug**: Synchronous calls to `playAudio()` return immediately while the sound card continues playing the binary audio stream.
* **The Solution**: An active playback polling monitor checks `TTSService.isPlaying()` and `TTSService.audioQueue.length` every 100ms. The microphone and speech capture channels remain muted until the audio playback queue is fully drained:
  ```javascript
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = setInterval(() => {
      if (!TTSService.isPlaying() && TTSService.audioQueue.length === 0) {
        setIsSpeaking(false);
        setPipelineState('idle');
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isSpeaking]);
  ```

### Pillar 3: Secure Context Guards & getUserMedia Safety Checks
Modern browsers prevent microphone access on insecure connections (standard HTTP outside of localhost). J.A.R.V.I.S guards against raw API crashes by warning early and handling failures gracefully.
* **Implementation** (`useSpeech.js`):
  ```javascript
  const isSecure = window.isSecureContext !== false;
  if (!isSecure) {
    console.warn('[Neural] App is running in an insecure context. Microphone API might be disabled by the browser.');
  }
  
  // Guard inside startSpeech
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microphone API (getUserMedia) is not supported on this browser or connection is insecure. Chrome/Firefox/Safari restrict audio capture to secure contexts (localhost or HTTPS).");
  }
  ```

---

## 🔍 Code Review & Verification Guidelines

Before submitting any code modifications, perform these mandatory checks:

1. **Python Syntax Compilation**: Run `python -m py_compile backend/core/processor.py` to confirm zero static compiler errors.
2. **React Production Compilation**: Run `npm run build --prefix frontend` to guarantee typescript/javascript syntax compiles without breaking visual styles.
3. **Log Level Management**: Keep WebSocket ping/pong logs silenced (`type: 'pong'`) to prevent console spam, but ensure critical errors are bubbled to the HUD console.
