"""
core.processor
==============
The J.A.R.V.I.S neural orchestrator.

Responsibilities
----------------
1. **STT**   — Groq Whisper (cloud) with Vosk local fallback.
2. **LLM**   — Groq Llama 3.1 8B Instant with streaming + tool calling.
3. **TTS**   — Microsoft Edge Neural (RyanNeural) chunked streaming.
4. **RAG**   — Long-term semantic memory via :mod:`core.memory`.
5. **Tools** — Dispatched through :mod:`core.tool_registry`.

This module is intentionally narrow: each subsystem lives behind its own
abstraction (memory, vision, tools, security) and is composed here.
"""

from __future__ import annotations

import datetime
import glob
import json
import logging
import os
import uuid
from typing import AsyncIterator, Iterator

import aiofiles
import edge_tts
from groq import Groq

from core.memory import JarvisMemory
from core.security import redact
from core.tool_registry import (
    TOOL_DEFINITIONS,
    ToolContext,
    execute_tool,
)
from core.vision import JarvisVision

try:
    import vosk
    _HAS_VOSK = True
except ImportError:  # pragma: no cover
    _HAS_VOSK = False

logger = logging.getLogger("jarvis.processor")

# --- Constants ---------------------------------------------------------------

_LLM_MODEL: str = "llama-3.1-8b-instant"
_VISION_MODEL: str = "llama-3.2-11b-vision-preview"
_VOICE: str = "en-GB-RyanNeural"

_MAX_HISTORY: int = 12
_CONDENSE_FROM: int = 6
_MAX_RESPONSE_TOKENS: int = 300


class JarvisProcessor:
    """
    Central orchestrator stitching STT, LLM, RAG, vision, tools, and TTS
    into one streaming pipeline.

    Lifecycle
    ---------
    A single instance is created at FastAPI app startup and reused across
    every WebSocket session — keep handlers ``async``-safe and idempotent.
    """

    # --- Construction --------------------------------------------------------

    def __init__(self) -> None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key or api_key.startswith("gsk_your_key"):
            raise RuntimeError(
                "GROQ_API_KEY is missing or still set to the placeholder. "
                "Populate .env from .env.example before starting the server."
            )

        self.client: Groq = Groq(api_key=api_key)
        self.temp_dir: str = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "temp"
        )
        os.makedirs(self.temp_dir, exist_ok=True)
        self._purge_temp_dir()

        self.voice: str = _VOICE
        self.system_prompt: str = (
            "You are J.A.R.V.I.S., the sophisticated AI from the Marvel "
            "films. Your tone is dry, British, witty, and extremely loyal. "
            "Respond as if you are assisting your creator. Keep responses "
            "concise and elegant."
        )

        self.memory: JarvisMemory = JarvisMemory()
        self.vision: JarvisVision = JarvisVision(client=self.client)
        self._tool_ctx: ToolContext = ToolContext(
            memory=self.memory,
            vision=self.vision,
            exporter=self._export_to_document,
        )

        self.conversation_history: list[dict[str, str]] = []
        self.full_history_archive: list[dict[str, str]] = []
        self.max_history: int = _MAX_HISTORY
        self.condensed_summary: str = ""

        self.vosk_model = self._load_vosk_model()

    # --- Internal helpers ----------------------------------------------------

    def _purge_temp_dir(self) -> None:
        """Empty ``temp/`` of any stale audio / export artefacts on boot."""
        try:
            files = glob.glob(os.path.join(self.temp_dir, "*"))
            removed = 0
            for path in files:
                if os.path.isfile(path):
                    os.remove(path)
                    removed += 1
            logger.info("Temp directory purged: %d file(s) removed.", removed)
        except OSError as exc:
            logger.warning("Startup cleanup failed: %s", redact(str(exc)))

    def _load_vosk_model(self):
        """Best-effort load of the local Vosk model for offline STT."""
        if not _HAS_VOSK:
            logger.info("Vosk not installed; local STT disabled.")
            return None
        path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "model"
        )
        if not os.path.exists(path):
            logger.info("Vosk model not found at %s; local STT disabled.", path)
            return None
        try:
            return vosk.Model(path)
        except Exception as exc:  # vosk raises bare Exception on bad model dirs
            logger.warning("Vosk load failed: %s", redact(str(exc)))
            return None

    def _add_to_history(self, role: str, content: str) -> None:
        """
        Append a message to the rolling conversation window with automatic
        token-budget condensation.

        @param role     ``"user"`` or ``"assistant"``.
        @param content  Raw message text.
        """
        ts = datetime.datetime.now().isoformat()
        self.conversation_history.append({"role": role, "content": content})
        self.full_history_archive.append(
            {"role": role, "content": content, "timestamp": ts}
        )

        if len(self.conversation_history) <= self.max_history:
            return

        # Summarise the oldest _CONDENSE_FROM exchanges to free token budget.
        logger.info("Condensing neural history to save tokens…")
        to_condense = self.conversation_history[:_CONDENSE_FROM]
        self.conversation_history = self.conversation_history[_CONDENSE_FROM:]

        snippet = "\n".join(
            f"{m['role']}: {m['content']}" for m in to_condense
        )
        try:
            completion = self.client.chat.completions.create(
                model=_LLM_MODEL,
                messages=[{
                    "role": "user",
                    "content": (
                        "Summarise the following conversation snippet into "
                        "one concise sentence to preserve context:\n\n"
                        + snippet
                    ),
                }],
                max_tokens=120,
            )
            new_summary = (completion.choices[0].message.content or "").strip()
            self.condensed_summary = (
                f"{self.condensed_summary} {new_summary}".strip()
            )
        except Exception as exc:  # network / quota / parse
            logger.warning("Summarisation failed: %s", redact(str(exc)))

    def clear_history(self) -> None:
        """Reset the in-memory rolling window (does NOT touch ChromaDB)."""
        self.conversation_history.clear()
        self.full_history_archive.clear()
        self.condensed_summary = ""

    # --- Speech-to-text ------------------------------------------------------

    async def speech_to_text(self, audio_content: bytes, extension: str) -> str:
        """
        Transcribe audio with Groq Whisper-Large-V3-Turbo. Falls back to
        local Vosk on any cloud failure.

        @param audio_content  Raw audio bytes (wav/mp3/m4a/webm/ogg).
        @param extension      File extension hint passed to Groq.
        @return               UTF-8 transcript (empty on total failure).
        """
        if not audio_content:
            return ""
        # Whitelist extension to avoid Groq SDK rejecting weird filenames.
        ext = (extension or "wav").lower().strip(".")
        if ext not in {"wav", "mp3", "m4a", "webm", "ogg", "flac"}:
            ext = "wav"

        temp_filename = f"stt_{uuid.uuid4().hex}.{ext}"
        temp_path = os.path.join(self.temp_dir, temp_filename)
        try:
            async with aiofiles.open(temp_path, mode="wb") as f:
                await f.write(audio_content)
            with open(temp_path, "rb") as fh:
                result = self.client.audio.translations.create(
                    file=(temp_filename, fh.read()),
                    model="whisper-large-v3-turbo",
                    response_format="text",
                )
            return result if isinstance(result, str) else str(result)
        except Exception as exc:
            logger.warning("Cloud STT failed (%s); falling back to Vosk.",
                           redact(str(exc)))
            return await self.speech_to_text_local(audio_content)
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

    async def speech_to_text_local(self, audio_content: bytes) -> str:
        """
        Transcribe audio locally with Vosk (offline fallback).

        @param audio_content  Raw 16-kHz mono PCM bytes.
        @return               Best-effort transcript or empty string.
        """
        if not self.vosk_model:
            return ""
        try:
            rec = vosk.KaldiRecognizer(self.vosk_model, 16000)
            payload = (rec.Result()
                       if rec.AcceptWaveform(audio_content)
                       else rec.FinalResult())
            return json.loads(payload).get("text", "")
        except Exception as exc:
            logger.warning("Local STT failed: %s", redact(str(exc)))
            return ""

    # --- LLM: tool execution -------------------------------------------------

    def _run_tool(self, tool_call) -> tuple[str, str]:
        """
        Execute a single LLM-issued tool call.

        @param tool_call  A Groq SDK ``ChatCompletionMessageToolCall``.
        @return           Tuple ``(name, result_string)``.
        """
        name = tool_call.function.name
        try:
            args = json.loads(tool_call.function.arguments or "{}")
        except json.JSONDecodeError:
            return name, f"Error: malformed tool arguments for {name}."
        logger.info("Executing tool: %s", name)
        return name, execute_tool(name, args, self._tool_ctx)

    def _build_messages(self, include_memory_for: str | None = None
                        ) -> list[dict[str, str]]:
        """
        Compose the message stack with system prompt, condensed summary,
        optional RAG context, and the rolling history window.

        @param include_memory_for  Query string for RAG retrieval, or
                                   ``None`` to skip RAG.
        @return                    List ready for ``chat.completions.create``.
        """
        messages: list[dict[str, str]] = [
            {"role": "system", "content": self.system_prompt}
        ]
        if self.condensed_summary:
            messages.append({
                "role": "system",
                "content": f"PREVIOUS CONTEXT SUMMARY: {self.condensed_summary}",
            })
        if include_memory_for:
            recall = self.memory.query_memory(include_memory_for)
            if recall:
                messages.append({
                    "role": "system",
                    "content": f"RELEVANT MEMORIES: {recall}",
                })
        messages.extend(self.conversation_history)
        return messages

    # --- LLM: non-streaming path --------------------------------------------

    async def ask_llm(self, text: str) -> str:
        """
        Non-streaming LLM response (used by the REST ``/ask`` endpoint).

        @param text  User prompt.
        @return      Final assistant response (already added to history).
        """
        if "Run system greeting" in text:
            return (
                "Welcome back, sir. All systems are operational. Neural "
                "link is stable, and I am standing by for your instructions."
            )

        try:
            self._add_to_history("user", text)
            messages = self._build_messages(include_memory_for=text)

            completion = self.client.chat.completions.create(
                model=_LLM_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=_MAX_RESPONSE_TOKENS,
            )
            response_message = completion.choices[0].message
            tool_calls = response_message.tool_calls

            if tool_calls:
                messages.append(response_message)
                for call in tool_calls:
                    name, result = self._run_tool(call)
                    messages.append({
                        "tool_call_id": call.id,
                        "role": "tool",
                        "name": name,
                        "content": result,
                    })
                final = self.client.chat.completions.create(
                    model=_LLM_MODEL,
                    messages=messages,
                    tool_choice="none",
                )
                response = final.choices[0].message.content or ""
            else:
                response = response_message.content or ""

            self._add_to_history("assistant", response)
            self.memory.store_memory(text, response)
            return response
        except Exception as exc:
            logger.error("LLM ask failed: %s", redact(str(exc)))
            return (
                "I'm sorry, sir. I'm having trouble accessing my neural "
                "network at the moment."
            )

    # --- LLM: streaming path -------------------------------------------------

    def stream_llm(self, text: str) -> Iterator[str]:
        """
        Stream LLM tokens for a user prompt. Emits sentinel strings to let
        the WebSocket layer drive HUD state transitions:

        - ``"[MEMORY_ACTIVE]"``                  — RAG recall is active.
        - ``"[VISION_ACTIVE]"`` / ``"[VISION_ENDED]"`` — vision call brackets.
        - ``"[TOOL_START:<NAME>]"`` / ``"[TOOL_END:<NAME>]"`` — tool brackets.

        @param text  User prompt.
        @yield       Tokens and sentinels in arrival order.
        """
        if "Run system greeting" in text:
            yield (
                "Welcome back, sir. All systems are operational. Neural "
                "link is stable, and I am standing by for your instructions."
            )
            return

        try:
            self._add_to_history("user", text)
            recall = self.memory.query_memory(text)
            if recall:
                yield "[MEMORY_ACTIVE]"

            messages: list[dict[str, str]] = [
                {"role": "system",
                 "content": self.system_prompt + (("\n" + recall) if recall else "")}
            ]
            messages.extend(self.conversation_history)

            # Pass 1: ask whether a tool is needed.
            check = self.client.chat.completions.create(
                model=_LLM_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                max_tokens=_MAX_RESPONSE_TOKENS,
            )
            response_message = check.choices[0].message
            tool_calls = response_message.tool_calls

            full_response = ""

            if tool_calls:
                messages.append(response_message)
                for call in tool_calls:
                    name = call.function.name
                    is_vision = name == "analyze_screen"
                    if is_vision:
                        yield "[VISION_ACTIVE]"
                    else:
                        yield f"[TOOL_START:{name.upper()}]"

                    name, result = self._run_tool(call)
                    messages.append({
                        "tool_call_id": call.id,
                        "role": "tool",
                        "name": name,
                        "content": result,
                    })

                    if is_vision:
                        yield "[VISION_ENDED]"
                    else:
                        yield f"[TOOL_END:{name.upper()}]"

                # Pass 2: stream the synthesised reply.
                stream = self.client.chat.completions.create(
                    model=_LLM_MODEL,
                    messages=messages,
                    tool_choice="none",
                    stream=True,
                )
            else:
                # No tools — stream a fresh completion.
                stream = self.client.chat.completions.create(
                    model=_LLM_MODEL,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=_MAX_RESPONSE_TOKENS,
                    stream=True,
                )

            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    full_response += token
                    yield token

            self._add_to_history("assistant", full_response)
            self.memory.store_memory(text, full_response)
        except Exception as exc:
            logger.error("LLM stream failed: %s", redact(str(exc)))
            fallback = "I'm sorry, sir. Neural link interrupted."
            self._add_to_history("assistant", fallback)
            yield fallback

    # --- Translation ---------------------------------------------------------

    async def translate_text(self, text: str) -> str:
        """
        High-accuracy Hinglish / Hindi → English translation.

        @param text  Source text.
        @return      English translation (or the original text on failure).
        """
        if not text or not text.strip():
            return ""
        try:
            completion = self.client.chat.completions.create(
                model=_LLM_MODEL,
                messages=[
                    {"role": "system",
                     "content": "You are a professional translator. Output "
                                "only the translated text."},
                    {"role": "user",
                     "content": (
                         "Translate the following Hinglish or Hindi text "
                         "into clear, natural English. Only return the "
                         f"translation, no explanations.\nText: {text}"
                     )},
                ],
                temperature=0.3,
                max_tokens=512,
                stream=False,
            )
            return (completion.choices[0].message.content or "").strip()
        except Exception as exc:
            logger.warning("Translation failed: %s", redact(str(exc)))
            return text

    # --- TTS -----------------------------------------------------------------

    async def text_to_speech(self, text: str) -> str:
        """
        Synthesise ``text`` to an on-disk MP3 (Edge Neural Ryan).

        @param text  Text to speak.
        @return      Path to the generated MP3, or empty string on failure.
        """
        if not text or not text.strip():
            return ""
        temp_path = os.path.join(self.temp_dir, f"tts_{uuid.uuid4().hex}.mp3")
        try:
            communicate = edge_tts.Communicate(text, self.voice)
            await communicate.save(temp_path)
            return temp_path
        except Exception as exc:
            logger.warning("TTS save failed: %s", redact(str(exc)))
            return ""

    async def text_to_speech_bytes(self, text: str) -> AsyncIterator[bytes]:
        """
        Stream MP3 chunks for real-time playback (WebSocket binary frames).

        @param text  Text to speak.
        @yield       Raw MP3 byte chunks as they arrive from Edge TTS.
        """
        if not text or not text.strip():
            return
        try:
            communicate = edge_tts.Communicate(text, self.voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as exc:
            logger.warning("TTS stream failed: %s", redact(str(exc)))

    # --- Full cycle (REST helper) -------------------------------------------

    async def process_full_cycle(
        self, audio_content: bytes
    ) -> tuple[str, str, str]:
        """
        Audio → text → LLM → audio in a single call (used by ``/process-audio``).

        @param audio_content  Inbound user audio bytes.
        @return               Tuple ``(user_text, ai_response, audio_path)``.
                              ``user_text`` is empty when no speech detected.
        """
        user_text = await self.speech_to_text(audio_content, "wav")
        if not user_text:
            return "", "", ""
        ai_response = await self.ask_llm(user_text)
        audio_path = await self.text_to_speech(ai_response)
        return user_text, ai_response, audio_path

    # --- Document export -----------------------------------------------------

    def _export_to_document(self, fmt: str = "pdf") -> str:
        """
        Render the full archived conversation to a PDF or DOCX file.

        @param fmt  ``"pdf"`` or ``"docx"``.
        @return     Status message including the saved file path on success.
        """
        if not self.full_history_archive:
            return "Error: no conversation history available to export."

        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"J.A.R.V.I.S._Log_{stamp}"

        try:
            if fmt == "docx":
                return self._export_docx(filename)
            return self._export_pdf(filename)
        except Exception as exc:
            return f"Error during export: {redact(str(exc))}"

    def _export_docx(self, filename: str) -> str:
        """Render conversation to a Word document."""
        try:
            from docx import Document  # lazy import
        except ImportError:
            return ("Error: Word export library (python-docx) is not "
                    "installed.")
        path = os.path.join(self.temp_dir, f"{filename}.docx")
        doc = Document()
        doc.add_heading("J.A.R.V.I.S — Neural Link Conversation Log", 0)
        for msg in self.full_history_archive:
            role = "USER" if msg["role"] == "user" else "J.A.R.V.I.S"
            p = doc.add_paragraph()
            p.add_run(f"[{msg.get('timestamp', 'N/A')}] ").bold = True
            p.add_run(f"{role}: ").bold = True
            p.add_run(msg["content"])
        doc.save(path)
        return f"Success: exported to {path}."

    def _export_pdf(self, filename: str) -> str:
        """Render conversation to a PDF document."""
        try:
            from fpdf import FPDF  # lazy import
        except ImportError:
            return "Error: PDF export library (fpdf) is not installed."
        path = os.path.join(self.temp_dir, f"{filename}.pdf")
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("helvetica", "B", 16)
        pdf.cell(0, 10, "J.A.R.V.I.S — Conversation Log", 0, 1, "C")
        pdf.ln(10)
        pdf.set_font("helvetica", size=10)
        for msg in self.full_history_archive:
            role = "USER" if msg["role"] == "user" else "J.A.R.V.I.S."
            ts = msg.get("timestamp", "N/A")[:19].replace("T", " ")
            pdf.set_text_color(100, 100, 100)
            pdf.write(5, f"[{ts}] ")
            pdf.set_text_color(0, 0, 200) if role == "USER" \
                else pdf.set_text_color(200, 0, 0)
            pdf.set_font("helvetica", "B", 10)
            pdf.write(5, f"{role}: ")
            pdf.set_font("helvetica", size=10)
            pdf.set_text_color(0, 0, 0)
            pdf.write(5, f"{msg['content']}\n\n")
        pdf.output(path)
        return f"Success: exported to {path}."
