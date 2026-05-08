import os
import uuid
import asyncio
import aiofiles
import json
import base64
import vosk
from groq import Groq
import edge_tts

class JarvisProcessor:
    """
    JarvisProcessor
    The neural engine of J.A.R.V.I.S.
    Handles STT (Groq Whisper), LLM (Groq Llama), and TTS (Edge TTS).
    Optimized for real-time streaming.
    """
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp")
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # System Prompt for J.A.R.V.I.S personality
        self.system_prompt = (
            "You are J.A.R.V.I.S., a highly intelligent, witty, and sophisticated AI assistant "
            "created by Tony Stark (but currently serving the user). Your tone is professional, "
            "slightly sarcastic but always helpful and loyal. Keep your responses concise and efficient. "
            "Respond in 2-3 sentences maximum for voice conversations."
        )
        
        # Conversation memory (last N exchanges)
        self.conversation_history = []
        self.max_history = 10
        
        # Vosk STT Model
        self.vosk_model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model")
        self.vosk_model = None
        if os.path.exists(self.vosk_model_path):
            try:
                self.vosk_model = vosk.Model(self.vosk_model_path)
                print(f"[Processor] Vosk model loaded from {self.vosk_model_path}")
            except Exception as e:
                print(f"[Processor] Error loading Vosk model: {e}")
        else:
            print(f"[Processor] Vosk model not found at {self.vosk_model_path}. Local STT will be disabled.")

    def _add_to_history(self, role: str, content: str):
        """Add a message to conversation history."""
        self.conversation_history.append({"role": role, "content": content})
        # Trim to max history
        if len(self.conversation_history) > self.max_history * 2:
            self.conversation_history = self.conversation_history[-(self.max_history * 2):]

    async def speech_to_text(self, audio_content: bytes, extension: str) -> str:
        """Transcribes audio using Groq Whisper-Large-V3-Turbo (faster)."""
        temp_filename = f"stt_{uuid.uuid4()}.{extension}"
        temp_path = os.path.join(self.temp_dir, temp_filename)
        
        try:
            async with aiofiles.open(temp_path, mode='wb') as f:
                await f.write(audio_content)
            
            with open(temp_path, "rb") as file:
                transcription = self.client.audio.translations.create(
                    file=(temp_filename, file.read()),
                    model="whisper-large-v3-turbo",
                    response_format="text"
                )
            return transcription
        except Exception as e:
            print(f"STT Error: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def speech_to_text_local(self, audio_content: bytes) -> str:
        """Transcribes audio locally using Vosk."""
        if not self.vosk_model:
            return "Error: Vosk model not loaded."
        
        try:
            # Vosk expects 16kHz mono PCM audio
            # For simplicity, we assume the input is already in this format or we handle it
            # In a real scenario, we might need to convert it using ffmpeg
            rec = vosk.KaldiRecognizer(self.vosk_model, 16000)
            
            if rec.AcceptWaveform(audio_content):
                res = json.loads(rec.Result())
                return res.get("text", "")
            else:
                res = json.loads(rec.FinalResult())
                return res.get("text", "")
        except Exception as e:
            print(f"Local STT Error: {e}")
            return ""

    async def ask_llm(self, text: str) -> str:
        """Gets a response from Groq LLM (non-streaming fallback)."""
        try:
            self._add_to_history("user", text)
            
            messages = [{"role": "system", "content": self.system_prompt}]
            messages.extend(self.conversation_history)
            
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.7,
                max_tokens=300,
                stream=False
            )
            response = completion.choices[0].message.content
            self._add_to_history("assistant", response)
            return response
        except Exception as e:
            print(f"LLM Error: {e}")
            return "I'm sorry, sir. I'm having trouble accessing my neural network at the moment."

    def stream_llm(self, text: str):
        """
        Streams LLM response token by token (generator).
        Returns an iterator of text chunks for real-time display.
        """
        try:
            self._add_to_history("user", text)
            
            messages = [{"role": "system", "content": self.system_prompt}]
            messages.extend(self.conversation_history)
            
            stream = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.7,
                max_tokens=300,
                stream=True
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full_response += token
                    yield token
            
            # Save full response to history after streaming completes
            self._add_to_history("assistant", full_response)
            
        except Exception as e:
            print(f"LLM Stream Error: {e}")
            error_msg = "I'm sorry, sir. Neural link interrupted."
            self._add_to_history("assistant", error_msg)
            yield error_msg

    async def translate_text(self, text: str) -> str:
        """High-accuracy translation specifically tuned for Hinglish/Hindi to English."""
        try:
            prompt = (
                "You are a master translator. Translate the following Hinglish or Hindi text into clear, "
                "natural English. Only return the translation, no explanations or quotes. "
                f"Text: {text}"
            )
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a professional translator. Output only the translated text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=512,
                stream=False
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Translation Error: {e}")
            return text

    async def text_to_speech(self, text: str) -> str:
        """Converts text to audio using Edge TTS (Microsoft Ryan Neural)."""
        temp_filename = f"tts_{uuid.uuid4()}.mp3"
        temp_path = os.path.join(self.temp_dir, temp_filename)
        
        try:
            # Using RyanNeural for that sophisticated British-adjacent tone
            communicate = edge_tts.Communicate(text, "en-GB-RyanNeural")
            await communicate.save(temp_path)
            return temp_path
        except Exception as e:
            print(f"TTS Error: {e}")
            return ""

    async def text_to_speech_bytes(self, text: str) -> bytes:
        """Converts text to audio bytes using Edge TTS. Returns raw MP3 bytes."""
        try:
            # Consistent with tts_service.py VOICE variable
            communicate = edge_tts.Communicate(text, "en-GB-RyanNeural")
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
                    # If we wanted to mirror the printing in tts_service.py:
                    # audio_base64 = base64.b64encode(chunk["data"])
                    # print(f"AUDIO_CHUNK:{audio_base64}")
            return audio_data
        except Exception as e:
            print(f"TTS Bytes Error: {e}")
            return b""

    async def process_full_cycle(self, audio_content: bytes):
        """Orchestrates the full Audio -> Text -> LLM -> Audio pipeline."""
        # 1. STT
        user_text = await self.speech_to_text(audio_content, "webm")
        if not user_text or len(user_text.strip()) < 2:
            return None, None, None
            
        # 2. LLM
        ai_response = await self.ask_llm(user_text)
        
        # 3. TTS
        audio_path = await self.text_to_speech(ai_response)
        
        return user_text, ai_response, audio_path

    def clear_history(self):
        """Clears conversation history."""
        self.conversation_history = []
