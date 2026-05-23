# J.A.R.V.I.S Agent Guide

**Jointly Advanced & Real-time Visionary Intelligence System v3.2**

A high-fidelity voice-first AI assistant with real-time streaming, RAG memory, sandboxed tool execution, and a zero-knowledge encrypted file vault.

---

## Project Overview

- **Type**: Fullstack desktop AI assistant (voice + chat + vision + secure storage).
- **Key features**: real-time bi-directional WebSocket, parallel text/audio streaming, structured control-plane frames, sandboxed shell execution, AES-256-GCM vault.
- **Setup**: single `npm run dev` boots Python backend + React frontend concurrently.

---

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 19 + Three.js | HUD, particle visualizer, real-time telemetry, vault UI |
| Backend | Python 3.10+ + FastAPI | WebSocket core + REST + lifespan-managed singleton |
| LLM | Groq Llama 3.1 (8B Instant) | Sub-second streaming completions |
| Vision | Groq Llama 3.2 11B Vision | Screenshot Q&A |
| STT | Whisper Large V3 Turbo (cloud) + Vosk (local) | Hybrid failover |
| TTS | Microsoft Edge Neural (RyanNeural) | Chunked MP3 streaming |
| Memory | ChromaDB | Persistent RAG vector store at `backend/memory_db/` |
| Crypto | `cryptography` (AES-256-GCM, PBKDF2-HMAC-SHA256) | NexusVault zero-knowledge storage |
| Isolation | Docker / Windows Job Object / hardened subprocess | Terminal-tool execution sandbox |

---

## Directory Map

```
J.A.R.V.I.S/
├── frontend/
│   ├── src/
│   │   ├── component/             # React UI (singular — not components/)
│   │   │   ├── BrainTerminal.js   # Streaming chat panel
│   │   │   ├── NexusVault.js      # Encrypted vault UI
│   │   │   ├── SystemStatus.js    # Live HUD bar
│   │   │   └── …
│   │   ├── hooks/
│   │   │   ├── useBrain.js        # WS lifecycle + structured-frame consumer
│   │   │   └── useSpeech.js       # Mic + secure-context guard
│   │   └── services/TTSService.js # Audio queue + playback monitor
│   ├── .eslintrc.js               # react-hooks/exhaustive-deps: warn
│   └── jsconfig.json
├── backend/
│   ├── main.py                    # FastAPI app, /ws, telemetry, lifespan
│   ├── nexus_routes.py            # /api/nexus/* — encrypted vault API
│   ├── core/
│   │   ├── processor.py           # Orchestrator; yields typed events
│   │   ├── memory.py              # ChromaDB RAG
│   │   ├── tool_registry.py       # Lazy tool dispatch
│   │   ├── sandbox.py             # Execution isolation (Docker/JobObject/hardened)
│   │   ├── security.py            # Allow-list + path-traversal + redact
│   │   ├── secure_storage.py      # NexusSecureStorage (AES-256-GCM)
│   │   └── vision.py              # Screenshot capture
│   ├── stt_service.py             # Whisper + Vosk
│   ├── tts_service.py             # Edge TTS
│   ├── requirements.txt           # Top-level deps
│   ├── requirements.lock.txt      # `pip freeze` — exact pins
│   └── .venv/                     # Python venv (gitignored)
├── voice_pack/                    # Vendored ZipVoice TTS (alt engine, not wired)
├── .env                           # GROQ_API_KEY, BACKEND_PORT, ALLOWED_ORIGINS
├── package.json                   # Root npm scripts (dev / build / sync-env)
└── Resilience_Report.txt          # Full inventory + bug/upgrade log
```

---

## Dev Commands

| Command | Effect |
|---|---|
| `npm install` | Frontend node deps. |
| `npm run dev` | Backend + frontend concurrent. |
| `npm run backend` | Backend only — `.venv\Scripts\python.exe main.py`. |
| `npm start` | Frontend only on `:3000`. |
| `npm run build` | React production build. |
| `npm run sync-env` | Copies root `.env` → frontend & backend (auto-invoked). |
| `npm test --prefix frontend -- --testPathPattern=Component` | Single React test. |

No `npm run lint` — invoke ruff / eslint directly (see [CLAUDE.md](CLAUDE.md) for exact commands).

---

## Core Architecture Patterns

### 1. WebSocket Bi-Directional Streaming
`/ws` endpoint in [backend/main.py](backend/main.py). Client → server: JSON `chat` / `clear_history` / `ping`. Server → client: JSON event types + binary MP3 frames, all serialised through `asyncio.Lock`.

### 2. v3.2 Structured Control-Plane Frames
Tool lifecycle, memory recall, and vision events are dedicated JSON frames — **never** embedded sentinels inside the text stream:
```jsonc
{"type":"tool_lifecycle", "state":"start"|"end", "name":"EXECUTE_TERMINAL_COMMAND"}
{"type":"memory",         "state":"active"}
{"type":"vision",         "state":"start"|"end"}
```
`processor.stream_llm` yields `{"kind":"token"|"event", ...}` dicts; the `/ws` handler maps each to a wire frame.

### 3. Modular Tool Registry
Tools register themselves in [backend/core/tool_registry.py](backend/core/tool_registry.py). Each `Tool` couples a Groq function-calling schema with its handler. Adding a tool: append a `Tool(...)` entry to the `_TOOLS` tuple — auto-registered.

### 4. Sandboxed Shell Execution
`execute_terminal_command` flows through [backend/core/sandbox.py](backend/core/sandbox.py). Three backends:
- **`docker`** — full container isolation (`--network=none --read-only --cpus=0.5 --memory=256m --pids-limit=64`).
- **`windows_jobobject`** — pywin32 Job Object with `KILL_ON_JOB_CLOSE`, CPU time cap, memory cap, active-process cap. Default on Windows when pywin32 is present.
- **`hardened`** — stdlib fallback: stripped env, locked CWD (`.sandbox_run/`), restricted PATH, hard timeout, output cap.

Selection: `JARVIS_SANDBOX_BACKEND` env var (`docker`/`windows_jobobject`/`hardened`), else auto-detect.

### 5. ChromaDB RAG Memory
[backend/core/memory.py](backend/core/memory.py). Semantic recall with timestamped metadata; auto-rebuilds collection on corruption. Persistent at `backend/memory_db/`.

### 6. Hybrid STT Pipeline
[backend/stt_service.py](backend/stt_service.py). Whisper (cloud) → Vosk (local) on any cloud failure. Vosk auto-disables if model dir missing.

### 7. NexusVault — Zero-Knowledge Encrypted Storage
[backend/core/secure_storage.py](backend/core/secure_storage.py) + [backend/nexus_routes.py](backend/nexus_routes.py). Master password never persists server-side; AES-256-GCM per-file with random 16-byte salt + 12-byte IV; PBKDF2-HMAC-SHA256 KDF (100 000 iterations). Delete = byte-overwrite with `os.urandom` + `os.fsync` + unlink.

### 8. Self-Talk-Free Audio Loop
Microphone re-arms only when **both** `TTSService.isPlaying() === false` AND `TTSService.audioQueue.length === 0`. The server's "speaker done" status frame is upload completion, not playback completion — the conjunction prevents J.A.R.V.I.S transcribing his own voice.

---

## Module Responsibilities

### Frontend (`frontend/src/`)
- **HUD components** in `component/`: blob (Three.js), brain-terminal, voice-control, system-status, system-console, translation-terminal, system-alert, splash-screen, hero, navbar.
- **NexusVault** (`component/NexusVault.js`): 3 screens (uninitialized / locked / unlocked dashboard). Drag-drop upload, secure-shred delete.
- **Hooks**: `useBrain()` for WS state + structured-frame routing; `useSpeech()` for mic capture + secure-context guard.
- **`TTSService`** in `services/`: lazy WebAudio context, sequential MP3 playback, frequency-data feed to the blob.

### Backend
- **`processor.JarvisProcessor`** singleton — boots ChromaDB + Vosk + Groq client + tool context; orchestrates every turn.
- **`tool_registry`** — 12 registered tools (system status, time/date, platform info, purge memory, analyze screen, execute terminal, create/search/read file, web search, weather, export conversation).
- **`sandbox`** — single entry point for shell execution. Allow-list re-validated inside.
- **`security`** — `is_command_allowed`, `resolve_within_sandbox`, `redact` (Groq/OpenAI/generic key patterns).
- **`secure_storage.NexusSecureStorage`** — vault primitives.
- **`nexus_routes.router`** — 6 endpoints (`/status` `/initialize` `/files` `/upload` `/download` `/delete`), mounted via `app.include_router`.

---

## Common Agent Tasks

### Add a new LLM tool
1. Write handler `_h_my_tool(args: dict, ctx: ToolContext) -> str` in `tool_registry.py`.
2. Append a `Tool("my_tool", "<description>", {<json-schema>}, _h_my_tool)` to `_TOOLS`.
3. No registration needed — `TOOL_DEFINITIONS` is regenerated automatically.

### Add a new WS event type
1. In `processor.stream_llm`, yield `{"kind": "event", "type": "<name>", ...}`.
2. In `main.py /ws`, add a branch under the `kind == "event"` dispatch.
3. In `useBrain.js`, add a `case '<name>':` in the message switch.

### Switch sandbox backend at runtime
Set `JARVIS_SANDBOX_BACKEND=docker` (or `windows_jobobject` / `hardened`) before launching the server. Docker requires the daemon to be reachable — otherwise the call returns an explicit error instead of falling back.

### Debug WebSocket issues
- Frontend: open browser console, look for `[WS]` lines.
- Backend: `logger.info("Client disconnected.")` etc.
- Health-check fallback: `GET /health` every 30 s from the client.
- Heartbeat: ping every 15 s, dead-connection threshold at 5 s pong timeout.

### Improve RAG recall
- Review chunking in `memory.py`.
- Check ChromaDB similarity threshold inside `query_memory`.
- `backend/memory_db/` is the persistent store — delete to reset.

### Debug STT failures
- Check Whisper API latency / errors in backend logs.
- Verify Vosk model present in `backend/model/` (auto-disables otherwise).
- Browser console for mic permission denials.

---

## Security & Safety

- **Sandbox isolation** — every shell command routed through `core.sandbox` (Docker / Job Object / hardened).
- **Allow-list** — `_ALLOWED_BINARIES` in `security.py`; shell metacharacters denied independently.
- **Path-traversal guard** — `resolve_within_sandbox` canonicalises before containment check.
- **Secret redaction** — `redact()` masks Groq/OpenAI/generic API keys in logs.
- **CORS** — env-driven `ALLOWED_ORIGINS`, no wildcard.
- **NexusVault** — zero-knowledge; master password never stored server-side.

---

## Conventions

1. All backend I/O is `async`; never block the event loop. Heavy CPU → thread pool.
2. New tools subclass `Tool`; never call `subprocess.run` directly — always through `core.sandbox`.
3. Memory writes are non-blocking; ChromaDB auto-chunks long conversations.
4. WS frames: JSON for control (text or structured), binary for audio — never mixed in one logical frame.
5. Mic mutes during TTS playback (load-bearing — see "Self-Talk-Free Audio Loop" above).
6. Dependencies pinned in `requirements.lock.txt`; do not bump without testing.

---

## Performance Notes

- **Sub-2s cold start** — heavy tool imports (PDF, Word) deferred via lazy import.
- **Gapless audio** — sequential MP3 buffer queue prevents pauses between chunks.
- **Resilient reconnect** — exponential backoff with ±30% jitter, max 10 s cap.
- **Telemetry** — CPU/RAM sampled every 5 s; sustained-spike alert injected into the token stream as a system message.

---

## Related Docs

- [README.md](README.md) — Project overview, architecture, feature highlights.
- [CLAUDE.md](CLAUDE.md) — Daily-driver commands + protocol cheat sheet.
- [Resilience_Report.txt](Resilience_Report.txt) — Full function/command/bug/upgrade inventory.
- [backend/README.md](backend/README.md) — Backend deep dive.
- `.env.example` — Required environment variables.
