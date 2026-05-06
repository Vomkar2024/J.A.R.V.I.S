# J.A.R.V.I.S.

**Just A Rather Very Intelligent System**

J.A.R.V.I.S is a premium, full-stack AI assistant inspired by futuristic sci-fi interfaces. It combines a high-end React frontend with a powerful Python backend to create an immersive, voice-controlled experience.

---

## 🏗️ Project Architecture

This project is divided into two main repositories:

### 1. [Frontend (React)](./frontend)
The "Neural Interface" that provides the visual and interactive experience.
- **Visuals**: Three.js powered AI "Blob" visualizer.
- **Interaction**: Voice-reactive UI, cinematic splash screens, and real-time terminals.
- **Tech**: React, Three.js, Web Speech API, CSS Variables (Glassmorphism).

### 2. [Backend (FastAPI)](./backend)
The "Processing Brain" that handles the intelligence and voice synthesis.
- **Transcription**: Groq Whisper (Whisper-Large-V3).
- **Intelligence**: Groq Llama 3.3 (70B Versatile).
- **Synthesis**: Edge TTS (High-quality neural voices).
- **Tech**: FastAPI, Groq SDK, edge-tts.

---

## 🚀 Key Features

- **Full Voice Cycle**: Speak to J.A.R.V.I.S, see your words transcribed, hear the AI response, and watch the visual core pulse in rhythm.
- **Futuristic Aesthetics**: A glass-style design with dark modes, vibrant pulses, and smooth animations.
- **Real-Time Processing**: Ultra-fast response times thanks to Groq's LPU infrastructure.
- **Customization**: Adjust the AI's "personality" (color, scale, sensitivity) through the built-in settings menu.

---

## 📂 Repository Map

```
J.A.R.V.I.S/
├── backend/             # Python logic, AI clients, and API endpoints
├── frontend/            # React UI, 3D graphics, and user hooks
├── package.json         # Root scripts to run both apps
└── README.md            # This file
```

---

## 🚦 Quick Start

To run the entire project simultaneously:

1. **Install Root Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Set up `backend/.env` with your `GROQ_API_KEY`.
   - Set up `frontend/.env` with your `REACT_APP_API_URL`.

3. **Launch the System**:
   ```bash
   npm start
   ```

---

*“I am J.A.R.V.I.S. I am here to help you.”*