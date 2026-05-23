"""
J.A.R.V.I.S — FastAPI Application Entrypoint
=============================================
Wires together the WebSocket streaming endpoint, the legacy REST fallback
endpoints, and the lifecycle hooks for the neural processor.

Security posture
----------------
* CORS origins are read from ``ALLOWED_ORIGINS`` (no wildcards by default).
* ``GROQ_API_KEY`` is validated at boot — the server refuses to start
  without a real key.
* Every WebSocket send is serialised via an :class:`asyncio.Lock` to
  eliminate interleaving between telemetry frames and response tokens.
* Inbound text is length-clamped to prevent prompt-flooding.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Final

from dotenv import find_dotenv, load_dotenv
from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.paths import IS_FROZEN, DATA_ROOT, ensure_data_root
from core.processor import JarvisProcessor
from core.security import redact
from nexus_routes import router as nexus_router

try:
    import psutil
    _HAS_PSUTIL = True
except ImportError:
    _HAS_PSUTIL = False

# --- Bootstrap ---------------------------------------------------------------

# Layered .env discovery so the same binary works in dev (repo .env),
# under a Tauri sidecar (next to the .exe), and from APPDATA (user config).
def _load_env() -> None:
    if IS_FROZEN:
        exe_dir = Path(sys.executable).resolve().parent
        for candidate in (exe_dir / ".env", DATA_ROOT / ".env"):
            if candidate.is_file():
                load_dotenv(candidate)
                return
    discovered = find_dotenv(usecwd=True)
    if discovered:
        load_dotenv(discovered)


_load_env()
ensure_data_root()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("jarvis.main")

_GROQ_API_KEY: Final[str | None] = os.getenv("GROQ_API_KEY")
if not _GROQ_API_KEY or _GROQ_API_KEY.startswith("gsk_your_key"):
    raise RuntimeError(
        "GROQ_API_KEY is missing or set to the placeholder. "
        "Populate .env (see .env.example) before starting the server."
    )

_ALLOWED_ORIGINS: Final[list[str]] = [
    o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000"
    ).split(",") if o.strip()
]
_MAX_INBOUND_CHARS: Final[int] = 4000
_MAX_AUDIO_BYTES: Final[int] = 25 * 1024 * 1024  # 25 MiB

# --- Lifespan ----------------------------------------------------------------

processor: JarvisProcessor


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Construct the singleton processor on startup."""
    global processor
    processor = JarvisProcessor()
    logger.info("Neural processor online.")
    try:
        yield
    finally:
        logger.info("Shutting down.")


app = FastAPI(
    title="J.A.R.V.I.S Neural Core",
    version="3.2.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(nexus_router)


class ChatRequest(BaseModel):
    """Request body for `/ask` and `/translate` endpoints."""
    text: str = Field(..., min_length=1, max_length=_MAX_INBOUND_CHARS)


# ============================================================
# WebSocket: real-time bidirectional streaming
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """
    Primary WebSocket endpoint.

    Client → Server (JSON):
        ``{"type": "chat", "text": "..."}``
        ``{"type": "clear_history"}``
        ``{"type": "ping", "timestamp": <num>}``

    Server → Client (JSON):
        ``status`` · ``token`` · ``response_end`` · ``audio_start`` ·
        ``telemetry`` · ``pong`` · ``error``

    Server → Client (Binary):
        Raw MP3 frames for TTS playback.
    """
    await ws.accept()
    ws_lock: asyncio.Lock = asyncio.Lock()

    async def send_json(payload: dict) -> None:
        """Serialised JSON write to avoid interleaving with binary frames."""
        async with ws_lock:
            await ws.send_text(json.dumps(payload))

    async def send_bytes(payload: bytes) -> None:
        """Serialised binary write (audio frames)."""
        async with ws_lock:
            await ws.send_bytes(payload)

    async def telemetry_loop() -> None:
        """Sample host CPU/RAM every 5s and emit a telemetry frame."""
        if not _HAS_PSUTIL:
            logger.info("Telemetry disabled: psutil not installed.")
            return
        cpu_history: list[float] = []
        try:
            while True:
                cpu = psutil.cpu_percent()
                ram = psutil.virtual_memory().percent
                cpu_history.append(cpu)
                if len(cpu_history) > 6:
                    cpu_history.pop(0)
                avg_cpu = sum(cpu_history) / len(cpu_history)
                critical = avg_cpu > 90 and len(cpu_history) == 6
                status = ("critical" if critical
                          else ("warning" if cpu > 80 else "nominal"))
                await send_json({
                    "type": "telemetry",
                    "data": {"cpu": cpu, "ram": ram, "status": status},
                })
                if critical:
                    await send_json({
                        "type": "token",
                        "data": ("\n[SYSTEM ALERT]: Sustained CPU spike over "
                                 "the last 30 seconds, sir.\n"),
                    })
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("Telemetry loop error: %s", redact(str(exc)))

    async def keepalive_loop() -> None:
        """Emit an idle pong every 20s to defeat proxy timeouts."""
        try:
            while True:
                await asyncio.sleep(20)
                await send_json({"type": "pong", "timestamp": 0})
        except (asyncio.CancelledError, Exception):
            pass

    telemetry_task = asyncio.create_task(telemetry_loop())
    keepalive_task = asyncio.create_task(keepalive_loop())

    await send_json({"type": "status", "data": "idle"})

    try:
        while True:
            data = await ws.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await send_json({"type": "error", "data": "Malformed JSON."})
                continue

            msg_type = message.get("type", "")

            if msg_type == "ping":
                await send_json({
                    "type": "pong",
                    "timestamp": message.get("timestamp", 0),
                })
                continue

            if msg_type == "chat":
                user_text = (message.get("text") or "").strip()
                if len(user_text) < 2:
                    continue
                if len(user_text) > _MAX_INBOUND_CHARS:
                    user_text = user_text[:_MAX_INBOUND_CHARS]

                logger.info("User: %s", user_text[:120])
                await send_json({"type": "status", "data": "thinking"})

                full_response = ""
                try:
                    for event in processor.stream_llm(user_text):
                        kind = event.get("kind")
                        if kind == "token":
                            data = event.get("data", "")
                            full_response += data
                            await send_json({"type": "token", "data": data})
                            await asyncio.sleep(0)
                            continue

                        if kind != "event":
                            continue

                        ev_type = event.get("type")
                        if ev_type == "memory":
                            await send_json({
                                "type": "memory",
                                "state": event.get("state", "active"),
                            })
                        elif ev_type == "vision":
                            await send_json({
                                "type": "vision",
                                "state": event.get("state"),
                            })
                        elif ev_type == "tool_lifecycle":
                            await send_json({
                                "type": "tool_lifecycle",
                                "state": event.get("state"),
                                "name": event.get("name"),
                            })
                except Exception as exc:
                    logger.error("LLM stream error: %s", redact(str(exc)))
                    full_response = "I'm sorry, sir. Neural link interrupted."
                    await send_json({"type": "token", "data": full_response})

                await send_json({"type": "response_end", "data": full_response})
                await send_json({"type": "status", "data": "speaking"})
                await send_json({"type": "audio_start"})

                try:
                    async for chunk in processor.text_to_speech_bytes(full_response):
                        await send_bytes(chunk)
                except Exception as exc:
                    logger.error("TTS stream error: %s", redact(str(exc)))

                await send_json({"type": "status", "data": "idle"})

            elif msg_type == "clear_history":
                processor.clear_history()
                await send_json({"type": "status", "data": "history_cleared"})

    except WebSocketDisconnect:
        logger.info("Client disconnected.")
    except Exception as exc:
        logger.error("WebSocket unexpected error: %s", redact(str(exc)))
    finally:
        telemetry_task.cancel()
        keepalive_task.cancel()
        for task in (telemetry_task, keepalive_task):
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        logger.info("Connection cleanup complete.")


# ============================================================
# REST endpoints — fallback / direct API access
# ============================================================

@app.post("/stt")
async def speech_to_text(
    file: Annotated[UploadFile, File(...)],
    mode: str = "cloud",
) -> dict:
    """
    Transcribe an uploaded audio clip.

    @param file  Multipart audio upload (wav/mp3/m4a/webm/ogg/flac).
    @param mode  ``"cloud"`` (Groq Whisper) or ``"local"`` (Vosk).
    @return      ``{"text": "...", "mode": "..."}``.
    """
    if mode not in {"cloud", "local"}:
        raise HTTPException(400, "mode must be 'cloud' or 'local'")
    try:
        content = await file.read()
        if len(content) > _MAX_AUDIO_BYTES:
            raise HTTPException(413, "audio payload too large")
        if mode == "local":
            text = await processor.speech_to_text_local(content)
        else:
            ext = (file.filename or "").rsplit(".", 1)[-1] if file.filename else "wav"
            text = await processor.speech_to_text(content, ext)
        return {"text": text, "mode": mode}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("STT error: %s", redact(str(exc)))
        raise HTTPException(500, "STT failed") from exc


@app.post("/ask")
async def ask_llm(request: ChatRequest) -> dict:
    """Non-streaming LLM call."""
    try:
        return {"response": await processor.ask_llm(request.text)}
    except Exception as exc:
        logger.error("Ask error: %s", redact(str(exc)))
        raise HTTPException(500, "ask failed") from exc


@app.post("/translate")
async def translate_text(request: ChatRequest) -> dict:
    """High-accuracy Hinglish / Hindi → English translation."""
    try:
        return {"translation": await processor.translate_text(request.text)}
    except Exception as exc:
        logger.error("Translate error: %s", redact(str(exc)))
        raise HTTPException(500, "translation failed") from exc


@app.post("/tts")
async def text_to_speech(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
):
    """Synthesise text to MP3, returned as a downloadable file."""
    try:
        audio_path = await processor.text_to_speech(request.text)
        if not audio_path or not os.path.exists(audio_path):
            raise HTTPException(500, "TTS generated no audio")
        background_tasks.add_task(os.remove, audio_path)
        return FileResponse(
            audio_path, media_type="audio/mpeg", filename="response.mp3"
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("TTS error: %s", redact(str(exc)))
        raise HTTPException(500, "TTS failed") from exc


@app.post("/process-audio")
async def process_audio(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(...)],
):
    """End-to-end audio → audio cycle."""
    try:
        content = await file.read()
        if len(content) > _MAX_AUDIO_BYTES:
            raise HTTPException(413, "audio payload too large")
        user_text, ai_response, audio_path = \
            await processor.process_full_cycle(content)
        if not user_text:
            return {"error": "No speech detected"}
        if audio_path and os.path.exists(audio_path):
            background_tasks.add_task(os.remove, audio_path)
        return FileResponse(
            audio_path,
            media_type="audio/mpeg",
            filename="response.mp3",
            headers={
                "X-User-Text": user_text.encode("utf-8").decode("latin-1", "replace"),
                "X-AI-Response": ai_response.encode("utf-8").decode("latin-1", "replace"),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Process-audio error: %s", redact(str(exc)))
        raise HTTPException(500, "processing failed") from exc


@app.get("/health")
async def health() -> dict:
    """Cheap liveness probe."""
    return {"status": "ok", "engine": "J.A.R.V.I.S Core v3.2 — Real-Time"}


if __name__ == "__main__":
    # PyInstaller + Windows multiprocessing safety. Without this, any
    # subprocess that re-imports the bundled main can re-exec the
    # entire FastAPI server in an infinite spawn loop.
    if IS_FROZEN:
        import multiprocessing
        multiprocessing.freeze_support()

    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    # Bind to loopback only when running as a Tauri sidecar — there's no
    # legitimate reason for the HUD's webview to need LAN access to its
    # own embedded backend. The dev workflow keeps 0.0.0.0 for mobile testing.
    host = "127.0.0.1" if IS_FROZEN else "0.0.0.0"
    logger.info("J.A.R.V.I.S Neural Engine starting on %s:%d (frozen=%s)",
                host, port, IS_FROZEN)
    uvicorn.run(app, host=host, port=port)
