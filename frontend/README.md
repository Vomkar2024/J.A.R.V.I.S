# J.A.R.V.I.S — Neural HUD Interface
**Jointly Advanced & Real-time Visionary Intelligence System — Neural Link**

The frontend is a premium React application designed to act as a futuristic HUD (Heads-Up Display). It combines real-time data streaming with cinematic animations and a highly reactive design system.

---

## 💎 The Design Philosophy

J.A.R.V.I.S uses **Advanced Glassmorphism**:
- **Transparency**: Every element feels like it is projected onto a glass surface.
- **Micro-Animations**: Subtle glows and pulses that make the interface feel alive.
- **Dynamic HUD**: Terminals and status bars that slide and expand based on system activity.
- **Neural Core (The Blob)**: A Three.js particle visualizer that synchronizes with the AI's "voice box" using frequency data.

---

## 📡 Neural Hooks & Services

### 1. `useBrain` (The Backbone)
The primary hook managing the WebSocket connection. It features:
- **Mixed Stream Parsing**: Intelligently separates JSON metadata from raw binary audio bytes.
- **Telemetry HUD Support**: Listens for `telemetry` frames to update the system health gauges in real-time.
- **Signal Processing**: Recognizes visual signals like `[VISION_ACTIVE]` and `[TOOL_START]` to trigger HUD transitions.

### 2. `useSpeech` (The Listening Ear)
Wraps the Browser Web Speech API for high-speed local transcription. Features include:
- **Recognition Watchdog**: A persistent monitor that detects and restarts silently-dead recognition processes.
- **Circular Resilience**: An advanced hook architecture that allows for full neural resets without memory leaks.
- **Silence Detection**: Automatically submits input after 1.5s of silence.

### 3. `TTSService` (The Voice Box)
Uses the **Web Audio API** and an **Intelligent Audio Queue** for gapless playback. Features:
- **Resilient Decoding**: If a binary frame is corrupted or the service flickers, the service auto-repairs and continues the sequence without crashing the HUD.
- **Neural Buffering**: Queues incoming chunks to maintain zero-latency speech even during high network jitter.

---

## 📂 HUD Component Map

- **`BrainTerminal`**: The conversation log featuring character-by-character token streaming.
- **`TelemetryPanel`**: A HUD widget showing live CPU/RAM metrics and predictive warnings.
- **`VoiceSubtitles`**: A bottom-aligned overlay showing your transcribed voice input with a live wave visualizer.
- **`ControlCenter`**: Settings for core color (Fire, Plasma, Void), particle scale, and manual neural link initialization.

---

## 🚦 Interaction Guide

1. **Neural Link**: Click **INITIALIZE** at the top right to start the system. This unlocks the browser's audio context and microphone.
2. **Conversation**: Speak clearly. Your voice will appear at the bottom.
3. **Observation**: If you ask J.A.R.V.I.S to "see" something, the HUD will pulse blue as the Vision Engine activates.
4. **Customization**: Use the **SETTINGS** menu to change the interface's color palette or visual density.

---

*“Everything is under control, sir. J.A.R.V.I.S is operating at 100% capacity.”*
