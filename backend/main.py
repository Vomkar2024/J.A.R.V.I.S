import os
import json
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from core.processor import JarvisProcessor
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

app = FastAPI()
processor = JarvisProcessor()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    text: str

# ============================================================
# WebSocket Endpoint — Real-Time Bidirectional Communication
# ============================================================
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Real-time WebSocket endpoint for J.A.R.V.I.S.
    
    Protocol:
    Client -> Server (JSON):
        {"type": "chat", "text": "Hello Jarvis"}
        {"type": "clear_history"}
    
    Server -> Client (JSON):
        {"type": "status", "data": "thinking"}
        {"type": "token", "data": "Hello"}
        {"type": "response_end", "data": "full response text"}
        {"type": "audio_start"}
        {"type": "error", "data": "error message"}
    
    Server -> Client (Binary):
        Raw MP3 audio bytes for TTS playback
    """
    await ws.accept()
    print("[WS] Client connected")
    
    try:
        while True:
            # Receive message from client
            data = await ws.receive_text()
            message = json.loads(data)
            msg_type = message.get("type", "")
            
            if msg_type == "chat":
                user_text = message.get("text", "").strip()
                if not user_text or len(user_text) < 2:
                    continue
                
                print(f"[WS] User: {user_text}")
                
                # 1. Send "thinking" status
                await ws.send_text(json.dumps({"type": "status", "data": "thinking"}))
                
                # 2. Stream LLM tokens
                full_response = ""
                try:
                    for token in processor.stream_llm(user_text):
                        full_response += token
                        await ws.send_text(json.dumps({"type": "token", "data": token}))
                        # Small yield to prevent blocking the event loop
                        await asyncio.sleep(0)
                except Exception as e:
                    print(f"[WS] LLM Stream Error: {e}")
                    full_response = "I'm sorry, sir. Neural link interrupted."
                    await ws.send_text(json.dumps({"type": "token", "data": full_response}))
                
                # 3. Send response complete signal
                await ws.send_text(json.dumps({"type": "response_end", "data": full_response}))
                
                # 4. Generate and send TTS audio
                await ws.send_text(json.dumps({"type": "status", "data": "speaking"}))
                
                try:
                    print(f"[WS] Generating TTS for: {full_response[:50]}...")
                    audio_bytes = await processor.text_to_speech_bytes(full_response)
                    if audio_bytes:
                        print(f"[WS] Sending {len(audio_bytes)} audio bytes")
                        await ws.send_text(json.dumps({"type": "audio_start"}))
                        # Send audio as binary
                        await ws.send_bytes(audio_bytes)
                    else:
                        print("[WS] TTS generation returned no bytes")
                except Exception as e:
                    print(f"[WS] TTS Error: {e}")
                
                # 5. Back to idle
                await ws.send_text(json.dumps({"type": "status", "data": "idle"}))
                
            elif msg_type == "clear_history":
                processor.clear_history()
                await ws.send_text(json.dumps({"type": "status", "data": "history_cleared"}))
                
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await ws.send_text(json.dumps({"type": "error", "data": str(e)}))
        except:
            pass

# ============================================================
# REST Endpoints — Fallback / Direct API Access
# ============================================================
@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...), mode: str = "cloud"):
    """Transcribes audio using Groq Whisper (cloud) or Vosk (local)."""
    try:
        content = await file.read()
        if mode == "local":
            text = await processor.speech_to_text_local(content)
        else:
            ext = file.filename.split(".")[-1]
            text = await processor.speech_to_text(content, ext)
        return {"text": text, "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_llm(request: ChatRequest):
    """Gets response from Groq LLM."""
    try:
        response = await processor.ask_llm(request.text)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/translate")
async def translate_text(request: ChatRequest):
    """Translates text using Groq LLM (High Accuracy)."""
    try:
        translation = await processor.translate_text(request.text)
        return {"translation": translation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")
async def text_to_speech(request: ChatRequest):
    """Converts text to speech using Edge TTS."""
    try:
        audio_path = await processor.text_to_speech(request.text)
        return FileResponse(audio_path, media_type="audio/mpeg", filename="response.mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """Full cycle: Audio -> Text -> LLM -> Audio."""
    try:
        content = await file.read()
        user_text, ai_response, audio_path = await processor.process_full_cycle(content)
        
        if not user_text:
            return {"error": "No speech detected"}
        
        return FileResponse(
            audio_path, 
            media_type="audio/mpeg", 
            filename="response.mp3",
            headers={
                "X-User-Text": user_text.encode("utf-8").decode("latin-1"),
                "X-AI-Response": ai_response.encode("utf-8").decode("latin-1")
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "J.A.R.V.I.S Core v3 — Real-Time"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", 8000))
    print(f"\n>> J.A.R.V.I.S Neural Engine starting on port {port}...")
    print(f"   WebSocket: ws://localhost:{port}/ws")
    print(f"   REST API:  http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
