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

Python venv lives at `backend\.venv\` (NOT `venv_jarvis`). Install Python deps via `backend\.venv\Scripts\pip.exe install -r backend\requirements.txt`. Exact-pinned versions are checked in at [backend/requirements.lock.txt](backend/requirements.lock.txt).

Lint / static checks (no `npm run lint` script — invoke directly):
- Backend: `backend\.venv\Scripts\python.exe -m ruff check backend --exclude backend/.venv --ignore E501`
- Backend compile: `backend\.venv\Scripts\python.exe -m py_compile backend\main.py backend\core\*.py backend\nexus_routes.py backend\stt_service.py backend\tts_service.py`
- Frontend: `npx eslint src --ext .js` (run from `frontend\`)

Single React test: `npm test --prefix frontend -- --testPathPattern=ComponentName`.

## Boot-Time Guards (do not bypass)

Defined in [backend/main.py](backend/main.py):

- `GROQ_API_KEY` is read at startup. If missing or equal to placeholder `gsk_your_key...`, the server **refuses to start** with `RuntimeError`. Always populate root `.env` before launching.
- `ALLOWED_ORIGINS` (comma-separated) controls CORS. Default is `http://localhost:3000` — no wildcard. Add LAN origins explicitly when testing from another device.
- Inbound text is clamped to `_MAX_INBOUND_CHARS = 4000`; audio uploads capped at 25 MiB; NexusVault uploads capped at 100 MiB.
- All WebSocket sends are serialized through an `asyncio.Lock` so JSON telemetry never interleaves with binary MP3 frames.

## WebSocket Protocol — v3.2 structured frames (`/ws`)

**Inbound JSON** (client → server):
- `{"type": "chat", "text": "..."}`
- `{"type": "clear_history"}`
- `{"type": "ping", "timestamp": <num>}`

**Outbound JSON** — `status` / `token` / `response_end` / `audio_start` / `telemetry` / `pong` / `error` / **`tool_lifecycle`** / **`memory`** / **`vision`**.

Control parameters are **no longer embedded inside the text stream** as `[TOOL_START:…]` sentinels. Each lifecycle transition is its own structured frame:

```jsonc
{"type": "tool_lifecycle", "state": "start" | "end", "name": "EXECUTE_TERMINAL_COMMAND"}
{"type": "memory",         "state": "active"}
{"type": "vision",         "state": "start" | "end"}
```

**Outbound binary**: raw MP3 frames for TTS playback. Never mix binary and JSON in the same logical frame — they're separate `send_bytes` / `send_text` calls behind the lock.

Telemetry frames emit every 5 s (`cpu`, `ram`, `status`); idle pong every 20 s defeats proxy timeouts.

## Architecture Map (one-liners)

- [backend/main.py](backend/main.py) — FastAPI app, `/ws` endpoint, telemetry/keepalive loops, lifespan-managed singleton `JarvisProcessor`.
- [backend/core/processor.py](backend/core/processor.py) — orchestrator: memory lookup → Groq LLM stream → tool routing → TTS dispatch. `stream_llm` yields typed `{"kind": "token" | "event", ...}` dicts.
- [backend/core/memory.py](backend/core/memory.py) — ChromaDB RAG layer with timestamped recall; persistent store at `backend/memory_db/`.
- [backend/core/tool_registry.py](backend/core/tool_registry.py) — lazy-loaded tool manifest; new tools subclass `Tool` and self-register.
- [backend/core/sandbox.py](backend/core/sandbox.py) — **execution isolation** for the terminal tool. Three backends (Docker / Windows Job Object / hardened-subprocess), selected via `JARVIS_SANDBOX_BACKEND` or runtime capability probe.
- [backend/core/security.py](backend/core/security.py) — allow-list filter, path-traversal guard, secret redaction. Subprocess execution itself lives in `sandbox.py`.
- [backend/core/secure_storage.py](backend/core/secure_storage.py) — zero-knowledge AES-256-GCM vault (`NexusSecureStorage`). PBKDF2-HMAC-SHA256 KDF, secure shred on delete.
- [backend/nexus_routes.py](backend/nexus_routes.py) — FastAPI router exposing the vault to the React HUD (`/api/nexus/*`).
- [backend/core/vision.py](backend/core/vision.py) — screenshot capture and visual context.
- [backend/stt_service.py](backend/stt_service.py) — Whisper (cloud) → Vosk (local) failover.
- [backend/tts_service.py](backend/tts_service.py) — Edge TTS chunked streaming with frame-loss recovery.
- [frontend/src/hooks/useBrain.js](frontend/src/hooks/useBrain.js) — WebSocket lifecycle, exponential-backoff reconnect, dynamic URL resolution (`REACT_APP_API_URL` override, else `${protocol}//${hostname}:8000`). Consumes the v3.2 structured frames.
- [frontend/src/hooks/useSpeech.js](frontend/src/hooks/useSpeech.js) — mic capture, secure-context guard, getUserMedia safety.
- [frontend/src/services/TTSService.js](frontend/src/services/TTSService.js) — audio queue + playback monitor (poll `isPlaying()` / `audioQueue.length` every 100 ms to suppress mic during self-speech).
- [frontend/src/component/NexusVault.js](frontend/src/component/NexusVault.js) — encrypted-vault panel (uploads / downloads / shred). All file bytes encrypted client-uploaded → server-encrypted before persistence.
- Frontend components live in [frontend/src/component/](frontend/src/component/) (singular — not `components/`).

## Conventions

- All backend I/O is `async`; offload heavy CPU work (PDF/Word generation) to thread pools, never block the event loop.
- New tools: subclass `Tool` in `tool_registry.py`, implement handler, declare manifest params — registration is automatic.
- Terminal-style tools must route through `core.sandbox.run_sandboxed`, never `subprocess.run` directly. The sandbox enforces the allow-list, env scrub, and process-tree termination.
- Memory writes are non-blocking; ChromaDB auto-chunks long conversations.
- Mic must stay muted while TTS plays — the `TTSService` polling pattern prevents self-talk feedback loops; do not remove it.
- Pong logs (`type: "pong"`) are intentionally silenced on the client to avoid console spam.
- `react-hooks/exhaustive-deps` is `'warn'` in [frontend/.eslintrc.js](frontend/.eslintrc.js) — leave it on. It was previously `'off'` and hid a real missing-dep bug in `App.js#handleInitialize`.

## Environment Variables

`GROQ_API_KEY` (required) · `ALLOWED_ORIGINS` (CSV, default `localhost:3000`) · `BACKEND_PORT` (default 8000) · `JARVIS_SANDBOX_ROOT` (default repo root) · `JARVIS_SANDBOX_BACKEND` (`docker` / `windows_jobobject` / `hardened` — auto-detected) · `JARVIS_SANDBOX_DOCKER_IMAGE` (default `alpine:3` / `mcr.microsoft.com/windows/nanoserver:ltsc2022`) · `REACT_APP_API_URL` (frontend WS/HTTP override).

## Verification Before Shipping

1. `backend\.venv\Scripts\python.exe -m ruff check backend --exclude backend/.venv --ignore E501`
2. `backend\.venv\Scripts\python.exe -m py_compile backend\main.py backend\core\*.py backend\nexus_routes.py backend\stt_service.py backend\tts_service.py`
3. `npx eslint src --ext .js --max-warnings 0` (from `frontend\`)
4. `npm run build --prefix frontend`
5. `npm run dev`, then open `http://localhost:3000`, click **INITIALIZE**, verify mic + TTS round-trip + NEXUS tab loads.

See [AGENTS.md](AGENTS.md) for module-by-module deep dives and common agent tasks.
