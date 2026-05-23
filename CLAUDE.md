# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev Commands (Windows / PowerShell)

All scripts run from repo root. `npm run sync-env` is auto-invoked by `dev`/`start`/`backend` and copies the root `.env` to `frontend\.env` and `backend\.env` via PowerShell `cp`.

| Command | Effect |
|---|---|
| `npm install` | Installs frontend Node deps. Python deps install separately. |
| `npm run dev` | Starts backend + frontend concurrently (BACKEND cyan, FRONTEND magenta). |
| `npm run backend` | Runs `cd backend && .venv\Scripts\python.exe main.py` (FastAPI on `:8000`). |
| `npm start` | Frontend only (`react-scripts start` on `:3000`). |
| `npm run build` | React production build. |
| `npm test` | `react-scripts test` (interactive watcher). |

Python venv lives at `backend\.venv\` (NOT `venv_jarvis`). Install Python deps via `backend\.venv\Scripts\pip.exe install -r backend\requirements.txt`.

There is **no lint script**. Run `python -m py_compile backend\main.py backend\core\processor.py` for backend syntax checks.

Single React test: `npm test --prefix frontend -- --testPathPattern=ComponentName`.

## Boot-Time Guards (do not bypass)

Defined in [backend/main.py](backend/main.py):

- `GROQ_API_KEY` is read at startup. If missing or equal to placeholder `gsk_your_key...`, the server **refuses to start** with `RuntimeError`. Always populate root `.env` before launching.
- `ALLOWED_ORIGINS` (comma-separated) controls CORS. Default is `http://localhost:3000` — no wildcard. Add LAN origins explicitly when testing from another device.
- Inbound text is clamped to `_MAX_INBOUND_CHARS = 4000`; audio uploads capped at 25 MiB.
- All WebSocket sends are serialized through an `asyncio.Lock` so JSON telemetry never interleaves with binary MP3 frames.

## WebSocket Protocol (`/ws`)

**Inbound JSON** (client → server):
- `{"type": "chat", "text": "..."}` — user turn
- `{"type": "clear_history"}` — wipe session memory
- `{"type": "ping", "timestamp": <num>}` — heartbeat

**Outbound JSON** (server → client):
`status` · `token` · `response_end` · `audio_start` · `telemetry` · `pong` · `error`

**Outbound binary**: raw MP3 frames for TTS playback. Never mix binary and JSON in the same logical frame — they're separate `send_bytes` / `send_text` calls behind the lock.

Telemetry frames emit every 5 s (`cpu`, `ram`, `status`); idle pong every 20 s defeats proxy timeouts.

## Architecture Map (one-liners)

- [backend/main.py](backend/main.py) — FastAPI app, `/ws` endpoint, telemetry/keepalive loops, lifespan-managed singleton `JarvisProcessor`.
- [backend/core/processor.py](backend/core/processor.py) — orchestrator: memory lookup → Groq LLM stream → tool routing → TTS dispatch.
- [backend/core/memory.py](backend/core/memory.py) — ChromaDB RAG layer with timestamped recall; persistent store at `backend/memory_db/`.
- [backend/core/tool_registry.py](backend/core/tool_registry.py) — lazy-loaded tool manifest; new tools subclass `Tool` and self-register.
- [backend/core/security.py](backend/core/security.py) — `redact()` for log scrubbing + destructive-command blocklist.
- [backend/core/vision.py](backend/core/vision.py) — screenshot capture and visual context.
- [backend/stt_service.py](backend/stt_service.py) — Whisper (cloud) → Vosk (local) failover.
- [backend/tts_service.py](backend/tts_service.py) — Edge TTS chunked streaming with frame-loss recovery.
- [frontend/src/hooks/useBrain.js](frontend/src/hooks/useBrain.js) — WebSocket lifecycle, exponential-backoff reconnect, dynamic URL resolution (`REACT_APP_API_URL` override, else `${protocol}//${hostname}:8000`).
- [frontend/src/hooks/useSpeech.js](frontend/src/hooks/useSpeech.js) — mic capture, secure-context guard, getUserMedia safety.
- [frontend/src/services/TTSService.js](frontend/src/services/TTSService.js) — audio queue + playback monitor (poll `isPlaying()` / `audioQueue.length` every 100 ms to suppress mic during self-speech).
- Frontend components live in [frontend/src/component/](frontend/src/component/) (singular — not `components/`).

## Conventions

- All backend I/O is `async`; offload heavy CPU work (PDF/Word generation) to thread pools, never block the event loop.
- New tools: subclass `Tool` in `tool_registry.py`, implement `execute()`, declare manifest params — registration is automatic.
- Memory writes are non-blocking; ChromaDB auto-chunks long conversations.
- Mic must stay muted while TTS plays — the `TTSService` polling pattern prevents self-talk feedback loops; do not remove it.
- Pong logs (`type: "pong"`) are intentionally silenced on the client to avoid console spam.

## Verification Before Shipping

1. `python -m py_compile backend\main.py backend\core\processor.py backend\core\memory.py`
2. `npm run build --prefix frontend`
3. `npm run dev`, then open `http://localhost:3000`, click **INITIALIZE**, verify mic + TTS round-trip.

See [AGENTS.md](AGENTS.md) for module-by-module deep dives and common agent tasks.
