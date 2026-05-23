# J.A.R.V.I.S — Project Report

**Jointly Advanced & Real-time Visionary Intelligence System**
Version 3.2 · Author: Shubham · Date: 2026-05-23

This document is the text companion to the original [Project Report.pdf](./Project%20Report.pdf) (May 2026 baseline). The PDF captures the initial submission; this Markdown captures everything that has shipped since.

---

## 1. Abstract

J.A.R.V.I.S is a voice-first AI desktop assistant that combines:
- a low-latency persistent WebSocket between a React+Three.js HUD and a Python+FastAPI core;
- streaming LLM completions (Groq Llama 3.1 8B) with parallel TTS playback;
- hybrid cloud/local speech-to-text failover;
- vector-RAG long-term memory (ChromaDB) with timestamped recall;
- sandboxed shell-tool execution (Docker / Windows Job Object / hardened-subprocess);
- a zero-knowledge AES-256-GCM encrypted file vault (NexusVault).

The v3.2 release hardens execution isolation, refactors the WebSocket control plane out of the text stream, and wires the previously-orphaned NexusVault implementation to the HUD.

---

## 2. Architecture

```
+----------------+   WS+MP3   +-------------------+
|   React HUD    |<---------->|   FastAPI Core    |
|  (port 3000)   |   /ws      |   (port 8000)     |
+-------+--------+            +---------+---------+
        |                               |
        | localStorage / FormData       | Groq + ChromaDB + EdgeTTS +
        |                               | pywin32 + cryptography
        v                               v
+----------------+            +---------+---------+
| NexusVault UI  |  /api/nexus|  NexusSecureStorage|
|                |<---------->|  (AES-256-GCM)    |
+----------------+            +-------------------+
```

### Backend module graph

```
main.py ─ lifespan ─ JarvisProcessor (singleton)
   │                    │
   │                    ├── core/memory.py      (ChromaDB)
   │                    ├── core/tool_registry  (12 tools)
   │                    │     └── core/sandbox  (Docker / Job Object / hardened)
   │                    ├── core/vision.py
   │                    ├── stt_service.py      (Whisper + Vosk)
   │                    └── tts_service.py      (Edge TTS)
   │
   ├── /ws              (structured frames + binary MP3)
   ├── /stt /ask /translate /tts /process-audio /health
   └── nexus_routes.router ── core/secure_storage.NexusSecureStorage
```

---

## 3. Key Engineering Achievements

### 3.1 v3.1 Resilience Pillars (carried forward)

1. **Self-talk-free audio loop** — Microphone re-arms only when both `TTSService.isPlaying() === false` and `audioQueue.length === 0`. Prevents J.A.R.V.I.S transcribing his own voice (which the prior naive implementation did).
2. **Dynamic WebSocket URL resolution** — Honours `REACT_APP_API_URL` override, otherwise derives `${protocol}//${hostname}:8000`. Supports LAN/mobile testing.
3. **Resilient reconnect** — Exponential backoff (500 ms → 10 s, ×1.5 decay, ±30 % jitter) + 15 s heartbeat with 5 s pong timeout + visibility/online event triggers + 30 s HTTP health-check fallback.
4. **Secure-context + getUserMedia guard** — Pre-flight `isSecureContext` check; getUserMedia rejection throws a user-readable error rather than crashing React render.
5. **Boot-time guards** — `GROQ_API_KEY` placeholder detection → `RuntimeError`; `ALLOWED_ORIGINS` non-wildcard CORS; 4 KB inbound text clamp; 25 MiB audio clamp; `asyncio.Lock`-serialised WebSocket writes.

### 3.2 v3.2 Hardening

| Track | Change | Impact |
|---|---|---|
| **Execution isolation** | `core/sandbox.py` (new). Three backends (Docker, Windows Job Object, hardened subprocess) with runtime auto-selection. Allow-list re-validated inside. | Untrusted shell commands no longer touch the host OS environment. Process-tree termination, memory caps, network isolation (docker backend), env-scrubbing. |
| **Wire-protocol refactor** | `stream_llm` yields typed `{kind, ...}` dicts. New WS frames `tool_lifecycle`, `memory`, `vision`. Sentinel strings `[TOOL_START:…]` removed. | HUD no longer parses control state out of the text stream. Future protocol changes don't risk colliding with user text. |
| **NexusVault wiring** | `nexus_routes.py` (new). 6 endpoints mounted at `/api/nexus/*`. Pydantic schemas, RFC-5987 filename headers, structured HTTP status (401/404/409/413). | The HUD's vault panel now actually works against the existing `NexusSecureStorage` class. |
| **Footprint lockdown** | Recreated broken `.venv` trampoline. `pip freeze > requirements.lock.txt` (113 pinned deps). Added `cryptography` + `pywin32` to requirements. 13 dead files deleted. | Reproducible builds. No more uv-trampoline failures. No more stale Maven-Nexus artefacts confusing grep. |

---

## 4. Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 19 | CRA-managed, eslint with `react-hooks/exhaustive-deps: warn` |
| 3D visualizer | Three.js 0.184 | FireAIBlob particle system; frequency-data feed from TTS analyser |
| Backend framework | FastAPI 0.136 | Lifespan-managed singleton, `asyncio.Lock`-protected WS writes |
| LLM provider | Groq (Llama 3.1 8B Instant) | Two-pass: tool_choice=auto → stream |
| Vision provider | Groq (Llama 3.2 11B Vision Preview) | Triggered by `analyze_screen` tool |
| STT cloud | Groq Whisper Large V3 Turbo | Primary path |
| STT local | Vosk | Auto-disables if model dir absent; failover target |
| TTS | Microsoft Edge Neural (RyanNeural) | Chunked MP3 streaming |
| RAG memory | ChromaDB 1.5 | Persistent at `backend/memory_db/` |
| Crypto | `cryptography` 48 (AES-256-GCM) | NexusVault zero-knowledge storage |
| Sandbox helper | `pywin32` 311 (Windows) | Job Object backend |

---

## 5. WebSocket Protocol (v3.2)

### Inbound JSON
- `chat` — user turn (≤ 4 000 chars)
- `clear_history` — wipe rolling window
- `ping` — heartbeat

### Outbound JSON
- `status` (`idle` | `thinking` | `speaking` | `history_cleared`)
- `token` — incremental LLM text
- `response_end` — final concatenated text
- `audio_start` — next binary frames are MP3
- `telemetry` — CPU/RAM + status
- `pong` — heartbeat ack
- `error` — sanitised failure
- **`tool_lifecycle`** — `{state: "start"|"end", name: "<UPPER>"}`
- **`memory`** — `{state: "active"}`
- **`vision`** — `{state: "start"|"end"}`

### Outbound binary
Raw MP3 frames. Serialised via `asyncio.Lock` so no binary frame interleaves with a JSON token frame.

---

## 6. Security Posture

1. **Allow-list shell execution** — `_ALLOWED_BINARIES` whitelist + shell-metachar regex (`;` `&` `|` `` ` `` `$` `>` `<` `\n` `&&` `||` `$( )`).
2. **Sandboxed process boundary** — Docker (network none, read-only, CPU/RAM/PID caps) or Windows Job Object (kill-on-close, time/memory/active-process caps) or hardened-subprocess (stripped env, restricted PATH, locked CWD).
3. **Path-traversal guard** — `resolve_within_sandbox()` canonicalises before containment check; rejects symlinks, drive-letter injection, `..` traversal.
4. **Secret redaction** — `redact()` masks Groq, OpenAI, and generic `api_key|token|secret` shapes in logs.
5. **CORS** — env-driven, no wildcard.
6. **NexusVault zero-knowledge** — master password never persisted; AES-256-GCM with random 16-byte salt + 12-byte IV per file; PBKDF2-HMAC-SHA256 (100 000 iterations) KDF; secure-shred on delete.

---

## 7. Performance Profile

| Metric | Target | Achieved |
|---|---|---|
| Cold start | < 2 s | ~1.5 s (warm pip cache; PDF/Word lazy-imported) |
| First token (Groq) | < 500 ms | ~300 ms typical |
| First audio frame | < 1.5 s | parallel with token stream — perceived latency near zero |
| Reconnect after blink | < 1 s | exponential backoff resets on visibility / online event |
| TTS frame loss tolerance | gapless | sequential MP3 buffer queue |

---

## 8. Verification

| Check | Result |
|---|---|
| `ruff check backend` (F,E,W,B,UP,SIM,C4,RET,ARG) | All checks passed |
| `py_compile` over 11 modules | OK |
| `eslint src --max-warnings 0` | Silent |
| `npm run build` | Compiled successfully (205 kB gzipped JS, 8.7 kB CSS) |
| Sandbox `run_sandboxed('whoami')` | `shubham\shubh` via `windows_jobobject` |
| Sandbox `run_sandboxed('curl http://evil.com')` | Blocked: not on allow-list |
| NexusVault router introspection | 6/6 endpoints registered |
| Vault on fresh checkout | `{"initialized": false}` |

---

## 9. Future Work

Short-term: server-side `stream_llm` timeout, client-side tool watchdog, `npm run lint` script, pytest suite, rate limiting (SlowAPI), CSRF on vault.

Mid-term: settings via Pydantic BaseSettings, versioned WS schema, extended secret redaction (Anthropic/Google/AWS), periodic temp GC, `mss` instead of `pyautogui` for RDP-safe screenshots.

Long-term: ZipVoice self-hosted TTS, true Windows AppContainer, GraphRAG, Qdrant migration, Tauri desktop wrapper, OpenTelemetry tracing, multi-user.

Full ledger: [Resilience_Report.txt §18](./Resilience_Report.txt).

---

## 10. References & Companion Docs

- [README.md](README.md) — project overview & quick start
- [CLAUDE.md](CLAUDE.md) — daily-driver commands + protocol cheat sheet
- [AGENTS.md](AGENTS.md) — module-by-module agent guide
- [Resilience_Report.txt](Resilience_Report.txt) — full inventory + bug/upgrade ledger
- [backend/README.md](backend/README.md) — backend internals
- [Project Report.pdf](Project%20Report.pdf) — original May 2026 submission (immutable)
