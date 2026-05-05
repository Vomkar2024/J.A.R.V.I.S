# J.A.R.V.I.S - Frontend

**Just A Rather Very Intelligent System**

A premium, interactive AI assistant interface built with React, designed to provide a cinematic and highly responsive user experience. This project focuses on high-end aesthetics (Glassmorphism, dynamic animations) and real-time interaction through voice and visual feedback.

---

## 🚀 Key Features

### 1. **Interactive AI Core (The Blob)**
- A dynamic, fluid visual representation of J.A.R.V.I.S.
- **Voice Reactive**: The blob's size and animation intensity respond in real-time to microphone input volume.
- **Customizable**: Users can adjust the color (e.g., Fire Orange, Arc Reactor Blue), size, and responsiveness.
- **Draggable**: Enable "Drag Mode" to reposition the AI core anywhere on the interface.

### 2. **Cinematic Splash Screen**
- High-quality GIF integration for a professional "startup" feel.
- **Text Reveal Effect**: Smooth "J.A.R.V.I.S" text animation during initialization.
- Automatic transition to the main dashboard after system "calibration."

### 3. **Real-time Voice Control**
- Integrated **Web Speech API** for instant speech-to-text transcription.
- Visual feedback via a dedicated Voice Control component that displays transcripts as you speak.
- Seamless start/stop functionality via the main navigation bar.

### 4. **Settings & Persistence**
- **Glassmorphism Navbar**: A modern, translucent control panel for all system settings.
- **Persistent Memory**: System configurations (colors, sensitivity, position) are saved to `localStorage`, ensuring your preferences remain even after a page reload.
- **Quick Reset**: One-click functionality to return J.A.R.V.I.S to its default "Fire Orange" state.

### 5. **Premium UI/UX**
- **Hero Section**: A sleek welcome message that greets users upon entry.
- **Dynamic Backgrounds**: High-resolution imagery with smooth transitions.
- **Responsive Design**: Optimized for various screen sizes with a focus on immersive desktop usage.

---

## 🛠️ Tech Stack

- **Framework**: [React.js](https://reactjs.org/)
- **Visuals**: Web Audio API (for voice analysis), CSS3 Animations, HTML5 Canvas (for blob dynamics).
- **Voice**: Web Speech API (SpeechRecognition).
- **Styling**: Vanilla CSS with modern techniques (CSS Variables, Flexbox, Grid, Glassmorphism).

---

## 📂 Project Structure

```
frontend/
├── public/              # Static assets
└── src/
    ├── component/       # Modular UI components
    │   ├── blob.js          # Core AI visual engine
    │   ├── Hero.js          # Welcome greeting section
    │   ├── Navbar.js        # Settings and navigation control
    │   ├── SplashScreen.js  # Cinematic intro component
    │   └── VoiceControl.js  # Speech transcription display
    ├── img/             # High-res assets (backgrounds, GIFs)
    ├── App.js           # Main application logic and state management
    └── index.js         # Entry point
```

---

## 🚦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- [NPM](https://www.npmjs.com/)

### Installation
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Recent Updates

- **Splash Screen V2**: Replaced static text with a high-fidelity GIF and added a smooth transition to the main UI.
- **Microphone Integration**: Optimized Web Audio analyser for better responsiveness to voice volume.
- **Draggable UI**: Implemented state-based dragging logic for the AI blob.
- **Settings Persistence**: Integrated local storage for user preferences.

---

*Developed with ❤️ as part of the J.A.R.V.I.S project.*
