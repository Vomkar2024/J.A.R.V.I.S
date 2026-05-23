# J.A.R.V.I.S — Backend Neural Core (v3.2)

FastAPI WebSocket server orchestrating LLM streaming, STT/TTS, RAG memory, sandboxed shell execution, and a zero-knowledge encrypted file vault.

---

## Module Map

| File | Role |
|---|---|
| [main.py](main.py) | FastAPI app, `/ws` WebSocket, REST fallbacks, lifespan singleton, CORS + boot guards. |
| [nexus_routes.py](nexus_routes.py) | `/api/nexus/*` router — NexusVault HTTP surface. |
| [core/processor.py](core/processor.py) | Orchestrator — `JarvisProcessor` singleton. Yields typed `{kind, ...}` events from `stream_llm`. |
| [core/memory.py](core/memory.py) | ChromaDB RAG wrapper (`JarvisMemory`). |
| [core/tool_registry.py](core/tool_registry.py) | Tool dataclass + 12 registered handlers. |
| [core/sandbox.py](core/sandbox.py) | Execution isolation: Docker / Job Object / hardened-subprocess. |
| [core/security.py](core/security.py) | Allow-list, path-traversal guard, secret redactor. |
| [core/secure_storage.py](core/secure_storage.py) | `NexusSecureStorage` — AES-256-GCM zero-knowledge vault. |
| [core/vision.py](core/vision.py) | Screenshot + multimodal call. |
| [stt_service.py](stt_service.py) | Whisper cloud + Vosk fallback. |
| [tts_service.py](tts_service.py) | Edge Neural TTS streaming. |

---

## Boot-Time Guards

Defined in [main.py](main.py):

- **`GROQ_API_KEY`** — missing or placeholder value → `RuntimeError` at import time. Server cannot start.
- **`ALLOWED_ORIGINS`** — CSV; default `http://localhost:3000`. No wildcard.
- **Inbound text** — clamped to `_MAX_INBOUND_CHARS = 4000`.
- **Audio uploads** — capped at 25 MiB.
- **NexusVault uploads** — capped at 100 MiB.
- **WebSocket writes** — serialised through `asyncio.Lock`.

---

## WebSocket Protocol (`/ws`)

### Inbound (JSON)
- `{"type": "chat", "text": "..."}`
- `{"type": "clear_history"}`
- `{"type": "ping", "timestamp": <num>}`

### Outbound (JSON)
- `status` (`idle` / `thinking` / `speaking` / `history_cleared`)
- `token` — streamed text chunk
- `response_end` — final concatenated text
- `audio_start` — next binary frames are MP3
- `telemetry` — `{cpu, ram, status}`
- `pong` — heartbeat ack
- `error` — server-side failure with sanitised detail
- **`tool_lifecycle`** — `{state: "start"|"end", name: "<UPPER>"}`
- **`memory`** — `{state: "active"}`
- **`vision`** — `{state: "start"|"end"}`

### Outbound (binary)
Raw MP3 frames for TTS playback. Never mixed with JSON in a single logical frame — separate `send_bytes` / `send_text` calls behind the lock.

### Background loops
- Telemetry — CPU/RAM sample every 5 s; sustained spike injects an in-stream alert.
- Keepalive — empty pong every 20 s defeats proxy idle timeouts.

---

## REST Endpoints (legacy / fallback)

| Method | Path | Purpose |
|---|---|---|
| POST | `/stt` | Multipart audio → transcript JSON. |
| POST | `/ask` | Non-streaming LLM. |
| POST | `/translate` | Hinglish/Hindi → English. |
| POST | `/tts` | Text → downloadable MP3. |
| POST | `/process-audio` | Bundled STT → LLM → TTS cycle. |
| GET | `/health` | Liveness probe — `{"status": "ok", "engine": "..."}`. |

### NexusVault routes (`/api/nexus/*`)

| Method | Path | Body |
|---|---|---|
| GET | `/status` | – |
| POST | `/initialize` | `{password}` |
| POST | `/files` | `{password}` — also acts as unlock check |
| POST | `/upload` | multipart `file` + form `password` |
| POST | `/download` | `{password, uuid}` |
| POST | `/delete` | `{password, uuid}` |

Wrong password → HTTP 401. Missing file → 404. Vault already initialised → 409.

---

## Tool Registry — registered tools

| Name | Required Args | Purpose |
|---|---|---|
| `get_system_status` | – | CPU/RAM/disk via psutil. |
| `get_time_and_date` | – | Local datetime. |
| `get_platform_info` | – | OS / arch / Python version. |
| `purge_memory` | – | Wipe ChromaDB collection. |
| `analyze_screen` | `query` | Vision call with current screenshot. |
| `execute_terminal_command` | `command` | Allow-listed shell — **always sandboxed**. |
| `create_file` | `path, content` | Sandbox-scoped write. |
| `search_files` | `query [, root_dir]` | Sandbox-scoped glob. |
| `read_file` | `path` | Sandbox-scoped UTF-8 read (≤ 1 MiB). |
| `web_search` | `query` | DuckDuckGo. |
| `get_weather` | `location` | DuckDuckGo weather. |
| `export_conversation` | `[format=pdf\|docx]` | Lazy-imports fpdf / python-docx. |

---

## Sandbox Backends

`core.sandbox.run_sandboxed(command, timeout=8.0, max_output=2000)` selects:

1. **`docker`** — `--rm --network=none --read-only --cpus=0.5 --memory=256m --pids-limit=64`. Requires Docker daemon reachable. Errors descriptively if not.
2. **`windows_jobobject`** — Job Object with `KILL_ON_JOB_CLOSE | PROCESS_TIME | PROCESS_MEMORY | ACTIVE_PROCESS`. 256 MiB memory cap, 16 active-process cap, `PerProcessUserTimeLimit` ≈ wall-clock. Default on Windows when pywin32 is present.
3. **`hardened`** — stdlib only: stripped env (whitelist of `SYSTEMROOT`, `WINDIR`, `COMSPEC`, `PATHEXT`, `TEMP`, `TMP`, locales, `USERNAME`), restricted PATH (`C:\Windows\System32` / `/usr/bin` family), locked CWD at `.sandbox_run/`, `subprocess.CREATE_NEW_PROCESS_GROUP` or POSIX `start_new_session`.

Selection order:
- `JARVIS_SANDBOX_BACKEND` env var overrides everything.
- Else: `windows_jobobject` if pywin32 + Windows; otherwise `hardened`.

Validation: every command re-enters `core.security.is_command_allowed` inside the sandbox — the allow-list is the source of truth, not the caller.

---

## NexusSecureStorage — Cryptographic Details

- **Algorithm**: AES-256-GCM with 32-byte derived key.
- **KDF**: PBKDF2-HMAC-SHA256, 100 000 iterations, 16-byte random salt per encryption.
- **IV**: 12 bytes random per encryption.
- **On-disk layout** (per file and index): `SALT (16) || IV (12) || CIPHERTEXT`.
- **Authentication**: GCM tag is part of the ciphertext — tampering raises `ValueError` (mapped to HTTP 401 by `nexus_routes`).
- **Zero-knowledge**: master password is never persisted, only held in the request scope long enough to derive the key.
- **Secure shred**: `os.urandom`-overwrite of every byte → `fsync` → unlink. SSD wear-levelling caveats apply.
- **Storage layout**: `vault/index.enc` (encrypted file registry) + `vault/<uuid>.enc` per file.

---

## Verification Commands

```powershell
# Static checks
backend\.venv\Scripts\python.exe -m ruff check . --ignore E501
backend\.venv\Scripts\python.exe -m py_compile main.py core\*.py nexus_routes.py stt_service.py tts_service.py

# Smoke test sandbox
backend\.venv\Scripts\python.exe -c "from core.sandbox import current_backend, run_sandboxed; print(current_backend()); print(run_sandboxed('whoami'))"

# Smoke test NexusVault (server-side, no HTTP)
backend\.venv\Scripts\python.exe -c "from nexus_routes import router; print([(r.path, sorted(r.methods)) for r in router.routes])"
```

---

## Dependencies

Top-level deps in [requirements.txt](requirements.txt) (unpinned, source-of-truth list); exact versions in [requirements.lock.txt](requirements.lock.txt) (`pip freeze`). To reproduce:

```powershell
py -3 -m venv .venv
.venv\Scripts\pip.exe install -r requirements.lock.txt
```

Notable Windows-only optional: `pywin32` — required for the `windows_jobobject` sandbox backend. Falls back to `hardened` gracefully if absent.
