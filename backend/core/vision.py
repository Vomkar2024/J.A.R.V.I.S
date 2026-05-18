"""
core.vision
===========
Visual-cortex module for J.A.R.V.I.S.

Captures the primary screen, optimises the image for token efficiency,
and routes it to a multimodal LLM (Llama 3.2 Vision via Groq) for
natural-language analysis.
"""

from __future__ import annotations

import base64
import logging
import os
from io import BytesIO
from typing import Optional

from PIL import Image

from core.security import redact

try:
    import pyautogui
    _HAS_PYAUTOGUI = True
except Exception:  # pyautogui can raise on headless boxes
    _HAS_PYAUTOGUI = False

logger = logging.getLogger("jarvis.vision")

_VISION_MODEL: str = "llama-3.2-11b-vision-preview"
_MAX_SIZE: tuple[int, int] = (1280, 720)
_JPEG_QUALITY: int = 65


class JarvisVision:
    """Multimodal screen-analysis facade backed by a shared Groq client."""

    def __init__(self, client=None) -> None:
        """
        @param client  An already-constructed ``groq.Groq`` instance. When
                       ``None``, a new client is created from the
                       ``GROQ_API_KEY`` environment variable — kept for
                       backward compatibility with isolated usage.
        """
        if client is None:
            from groq import Groq  # lazy to keep import surface small
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "GROQ_API_KEY is required to construct JarvisVision."
                )
            client = Groq(api_key=api_key)
        self.client = client

    def capture_screen(self) -> Optional[str]:
        """
        Capture the primary monitor and return a base64-encoded JPEG.

        Resizes to ``_MAX_SIZE`` and compresses at ``_JPEG_QUALITY`` to
        minimise vision-tile counts (and therefore token cost).

        @return  Base64 JPEG string, or ``None`` on capture failure.
        """
        if not _HAS_PYAUTOGUI:
            logger.warning("pyautogui unavailable — vision disabled.")
            return None
        try:
            screenshot = pyautogui.screenshot()
            screenshot.thumbnail(_MAX_SIZE, Image.Resampling.LANCZOS)
            buf = BytesIO()
            screenshot.save(buf, format="JPEG", quality=_JPEG_QUALITY)
            logger.info("Screen captured (%dx%d).",
                        screenshot.width, screenshot.height)
            return base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception as exc:
            logger.warning("Capture failed: %s", redact(str(exc)))
            return None

    def analyze_screen(self, user_query: str) -> str:
        """
        Capture the screen and ask the multimodal model to answer
        ``user_query`` about its content.

        @param user_query  Natural-language question about the screen.
        @return            Model response, or a user-friendly error.
        """
        if not user_query or not user_query.strip():
            user_query = "Describe what is currently on the screen."

        image_b64 = self.capture_screen()
        if not image_b64:
            return "I'm sorry, sir. My visual sensors are currently offline."

        try:
            completion = self.client.chat.completions.create(
                model=_VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text",
                         "text": ("You are J.A.R.V.I.S. Analyse this screen "
                                  f"capture for the user. Question: "
                                  f"{user_query}")},
                        {"type": "image_url",
                         "image_url": {
                             "url": f"data:image/jpeg;base64,{image_b64}"}},
                    ],
                }],
                max_tokens=512,
            )
            return completion.choices[0].message.content or ""
        except Exception as exc:
            logger.warning("Vision analysis failed: %s", redact(str(exc)))
            return "I encountered an error while processing the visual data, sir."
