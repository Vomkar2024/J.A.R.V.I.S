import os
import uuid
import asyncio
from groq import Groq
import edge_tts
from pathlib import Path
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

class JarvisProcessor:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        # Set temp_dir relative to the backend root (one level up from this file)
        self.backend_root = Path(__file__).parent.parent
        self.temp_dir = self.backend_root / "temp"
        self.temp_dir.mkdir(exist_ok=True)
        self.default_voice = "en-GB-RyanNeural"

    async def speech_to_text(self, audio_content, file_extension="webm"):
        """Transcribes audio using Groq Whisper."""
        temp_audio_path = os.path.join(self.temp_dir, f"{uuid.uuid4()}.{file_extension}")
        
        try:
            with open(temp_audio_path, "wb") as buffer:
                buffer.write(audio_content)

            with open(temp_audio_path, "rb") as audio_file:
                transcription = self.client.audio.transcriptions.create(
                    file=(temp_audio_path, audio_file.read()),
                    model="whisper-large-v3",
                    response_format="json",
                )
            return transcription.text
        finally:
            if os.path.exists(temp_audio_path):
                os.remove(temp_audio_path)

    async def ask_llm(self, text):
        """Gets response from Groq LLM."""
        completion = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are J.A.R.V.I.S., a highly intelligent, witty, and helpful AI assistant. You are polite, efficient, and slightly sarcastic but always professional. Your responses should be concise and optimized for voice-to-text communication. Use your unique personality in every response."
                },
                {"role": "user", "content": text}
            ],
            temperature=0.7,
            max_tokens=500,
        )
        return completion.choices[0].message.content

    async def text_to_speech(self, text, voice=None):
        """Converts text to speech using Edge TTS and returns path to temp file."""
        voice = voice or self.default_voice
        temp_mp3_path = os.path.join(self.temp_dir, f"{uuid.uuid4()}.mp3")
        
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(temp_mp3_path)
        return temp_mp3_path

    async def process_full_cycle(self, audio_content):
        """Full cycle: Audio -> Text -> LLM -> Audio."""
        user_text = await self.speech_to_text(audio_content)
        if not user_text:
            return None, None, None
            
        ai_response = await self.ask_llm(user_text)
        audio_path = await self.text_to_speech(ai_response)
        
        return user_text, ai_response, audio_path
