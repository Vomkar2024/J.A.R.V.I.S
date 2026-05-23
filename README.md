# J.A.R.V.I.S v3.2 — Resilient Neural Assistant + NexusVault

**Jointly Advanced & Real-time Visionary Intelligence System**

A voice-first AI desktop assistant: real-time WebSocket streaming, hybrid STT failover, sandboxed shell execution, and a zero-knowledge encrypted file vault — all behind a cinematic Three.js HUD.

---

## Production Target

**Native Windows desktop app via Tauri v2.** Not a generic "runs on Windows" web app — the distribution target is a single MSI/NSIS installer (~30–50 MB idle, ~5× leaner than Electron) where:

- The **shell** is Rust + Tauri v2 ([src-tauri/](src-tauri/)), rendering through Microsoft Edge WebView2.
- The **React 19 + Three.js HUD** is bundled into the webview at build time.
- The **Python FastAPI core** is compiled with PyInstaller into a single-file `jarvis-core.exe` and registered as a **Tauri sidecar** — auto-spawned at app launch, killed on exit. No separate Python install required on the user's machine.

The shell is scaffolded ([src-tauri/](src-tauri/), [backend/jarvis_core.spec](backend/jarvis_core.spec), [backend/build-sidecar.ps1](backend/build-sidecar.ps1)). Daily dev still uses `npm run dev`; production packaging is `npm run tauri:build`.

### Building the MSI

```powershell
# One-time prerequisites
rustup default stable                    # Rust toolchain for the Tauri shell
npm install --prefix frontend            # React deps
backend\.venv\Scripts\pip.exe install -r backend\requirements.txt   # Python deps incl. pyinstaller
cargo tauri icon path\to\source-icon.png # Generates src-tauri\icons\*

# Build
npm run tauri:build
# Output: src-tauri\target\release\bundle\msi\J.A.R.V.I.S_3.2.0_x64.msi
#         src-tauri\target\release\bundle\nsis\J.A.R.V.I.S_3.2.0_x64-setup.exe
```

`npm run tauri:dev` opens the desktop window against the React dev server — assumes you've started the backend yourself with `npm run backend`. In release builds the Rust shell spawns the PyInstaller sidecar and waits on `/health` before revealing the window.

---

## What's New in v3.2

- **Sandboxed shell execution** — `execute_terminal_command` runs inside a Docker container, a Windows Job Object, or a hardened subprocess. Selection via `JARVIS_SANDBOX_BACKEND` or runtime capability probe.
- **Structured WebSocket control frames** — `tool_lifecycle`, `memory`, `vision` events are now their own JSON frames. Sentinels like `[TOOL_START:…]` are no longer embedded inside the token stream.
- **NexusVault** — AES-256-GCM zero-knowledge encrypted storage. PBKDF2-HMAC-SHA256 KDF (100 000 iterations), per-file random IV + salt, byte-overwrite secure-shred on delete. Exposed at `/api/nexus/*` to the React HUD.
- **Pinned dependencies** — `backend/requirements.lock.txt` (`pip freeze`) checked in for reproducible builds.

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| HUD | **React 19 + Three.js** | Glassmorphism dashboard + particle visualizer |
| Core | **Python 3.10+ + FastAPI** | WebSocket server, REST, lifecycle |
| Brain | **Groq Llama 3.1 8B** | Sub-second streaming completions |
| Vision | **Groq Llama 3.2 11B Vision** | Screenshot Q&A |
| Hearing | **Whisper Large V3 Turbo + Vosk** | Cloud STT with local failover |
| Voice | **Edge Neural TTS (RyanNeural)** | Chunked MP3 streaming |
| Memory | **ChromaDB** | Persistent RAG with timestamped recall |
| Storage | **AES-256-GCM** (`cryptography`) | NexusVault zero-knowledge vault |
| Isolation | **Docker / Job Object / hardened subprocess** | Shell-tool sandbox |

---

## Requirements

### Development (this repo)
- Node.js 18+
- Python 3.10+
- Groq API key — [console.groq.com](https://console.groq.com/)
- Microphone + speakers
- (Optional) Docker Desktop — for the strongest sandbox backend

### Production build (when scaffolded)
- Rust toolchain (`rustup`) for the Tauri shell
- WebView2 runtime (preinstalled on Windows 11; auto-installed by Tauri on Windows 10)
- PyInstaller (in the backend venv) for the sidecar binary
- See [Resilience_Report §18 U-15](Resilience_Report.txt) for the full Tauri scaffold steps

### End-user (post-MSI install)
- Windows 10 / 11 x64
- Microphone + speakers
- Internet (Groq + Edge TTS) — Vosk fallback handles offline STT

---

## Quick Start

```powershell
# 1. Install dependencies
npm install
backend\.venv\Scripts\pip.exe install -r backend\requirements.txt
#    Or for exact reproducibility:
backend\.venv\Scripts\pip.exe install -r backend\requirements.lock.txt

# 2. Configure environment
copy .env.example .env
#    Edit .env — set GROQ_API_KEY

# 3. Launch (concurrent backend + frontend)
npm run dev
#    Open http://localhost:3000  →  click INITIALIZE
```

---

## Configuration (`.env`)

| Variable | Default | Effect |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Server refuses to boot without it. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CSV. No wildcard — add LAN origins explicitly. |
| `BACKEND_PORT` | `8000` | FastAPI bind port. |
| `JARVIS_SANDBOX_ROOT` | repo root | Sandbox containment root. |
| `JARVIS_SANDBOX_BACKEND` | auto | `docker` / `windows_jobobject` / `hardened`. |
| `JARVIS_SANDBOX_DOCKER_IMAGE` | `alpine:3` / `nanoserver:ltsc2022` | Image used by the docker backend. |
| `REACT_APP_API_URL` | `${protocol}//${hostname}:8000` | Override frontend WS/HTTP URL. |

---

## Architecture Highlights

### Real-time Neural Link
A single persistent WebSocket carries:
- **Token stream** — incremental LLM output rendered as J.A.R.V.I.S speaks.
- **Binary MP3 frames** — TTS audio, interleave-safe (`asyncio.Lock`).
- **Structured control frames** — `tool_lifecycle`, `memory`, `vision`, `status`, `telemetry`.
- **Heartbeat** — 15 s ping / 5 s pong timeout / exponential-backoff reconnect.

### Resilient Self-Talk-Free Audio
The mic re-arms only when `TTSService.isPlaying() === false` **and** `audioQueue.length === 0`. The server's status frame is *upload completion*, not playback completion — the conjunction is what prevents the feedback loop.

### Layered Execution Sandbox
Every `execute_terminal_command` call goes through `core.sandbox.run_sandboxed`, never `subprocess.run` directly. Three backends auto-select:
1. **Docker** — `--network=none --read-only --cpus=0.5 --memory=256m --pids-limit=64`.
2. **Windows Job Object** — `KILL_ON_JOB_CLOSE` + CPU/memory/active-process caps.
3. **Hardened subprocess** — stripped env, locked CWD, restricted PATH, hard timeout.

### NexusVault — Zero-Knowledge Storage
- Master password never persists server-side.
- Per-file: 16-byte random salt + 12-byte random IV + AES-256-GCM ciphertext.
- KDF: PBKDF2-HMAC-SHA256, 100 000 iterations.
- Delete = `os.urandom`-overwrite + `os.fsync` + unlink (best-effort cryptographic shred).
- Encrypted index registry tracks file metadata; corrupt/wrong-password decryption raises `ValueError` → HTTP 401.

### Integrated Tool Suite
12 registered tools: system status, time/date, platform info, purge memory, analyze screen, execute terminal (sandboxed), file create/search/read, web search, weather, export conversation (PDF/DOCX).

---

## Troubleshooting

**No voice?** Click **INITIALIZE** to unlock the browser audio engine. If `[WS] Received binary audio data` appears in the console, your system volume is the issue.

**`venv\Scripts\python.exe` errors with "uv trampoline failed"?** The venv was broken by uv. Recreate:
```powershell
Remove-Item -Recurse -Force backend\.venv
py -3 -m venv backend\.venv
backend\.venv\Scripts\pip.exe install -r backend\requirements.lock.txt
```

**NexusVault tab can't connect?** Confirm backend is running and `cryptography` installed. Routes live at `/api/nexus/*` — `curl http://localhost:8000/api/nexus/status` should return `{"initialized": false}`.

**J.A.R.V.I.S talking to himself?** Don't remove the polling guard in `useBrain.js`'s `isSpeaking` effect — it's the load-bearing mic-mute.

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — Daily-driver commands + WebSocket protocol cheat sheet.
- [AGENTS.md](AGENTS.md) — Module-by-module architecture for AI coding agents.
- [Resilience_Report.txt](Resilience_Report.txt) — Complete function/command/endpoint inventory + bug & upgrade ledger.
- [backend/README.md](backend/README.md) — Backend internals deep dive.

---

*"I am J.A.R.V.I.S. Neural link stable. Sandbox engaged. Standing by."*
