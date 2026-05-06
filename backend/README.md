# J.A.R.V.I.S - Backend Core

**Just A Rather Very Intelligent System - Neural Processing Layer**

The backend of J.A.R.V.I.S is a high-performance Python application built with **FastAPI**. It acts as the "Brain" of the system, handling speech recognition, natural language processing, and realistic voice synthesis.

---

## 🧠 Core Functions & Logic

The backend is organized into two main parts: the **API Layer** (`main.py`) and the **Processor Layer** (`core/processor.py`).

### 1. Speech-to-Text (STT)
- **Technology**: Groq Whisper (Whisper-Large-V3).
- **Function**: `speech_to_text()`
- **Logic**: Receives an audio blob, saves it temporarily, sends it to Groq for ultra-fast transcription, and returns the text.

### 2. Large Language Model (LLM)
- **Technology**: Groq Llama 3.3 (70B Versatile).
- **Function**: `ask_llm()`
- **Logic**: Takes user text and processes it through a highly optimized "J.A.R.V.I.S" system prompt to generate witty, intelligent, and professional responses.

### 3. Text-to-Speech (TTS)
- **Technology**: Edge TTS (Humanoid Neural Voices).
- **Function**: `text_to_speech()`
- **Logic**: Converts AI responses into high-quality audio files using Microsoft's neural voices (`en-GB-RyanNeural` by default).

### 4. Full Cycle Processing
- **Function**: `process_full_cycle()`
- **Logic**: Orchestrates the entire pipeline in one request:
    1. Transcribes incoming user audio.
    2. Sends transcription to the LLM.
    3. Converts LLM response to audio.
    4. Returns the audio response along with metadata (user text and AI text) in custom headers.

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/stt` | `POST` | Transcribes an uploaded audio file. |
| `/ask` | `POST` | Sends a text prompt to the LLM. |
| `/tts` | `POST` | Converts text to a playable MP3 blob. |
| `/process-audio` | `POST` | Full pipeline: Audio In -> Audio Out. |
| `/health` | `GET` | System status check. |

---

## 🛠️ Tech Stack
- **Framework**: FastAPI (Python)
- **AI Infrastructure**: Groq Cloud API
- **TTS Engine**: edge-tts
- **Env Management**: python-dotenv

---

## 📂 Project Structure
```
backend/
├── core/
│   ├── processor.py     # Main logic and AI client handling
│   └── __init__.py
├── temp/                # Auto-managed temporary audio files
├── .env                 # API Keys and Port configuration
├── main.py              # FastAPI server and endpoint definitions
└── requirements.txt     # Python dependencies
```

---

## 🚦 Getting Started
1. Install dependencies: `pip install -r requirements.txt`
2. Configure `.env` with your `GROQ_API_KEY`.
3. Run the server: `python main.py`
