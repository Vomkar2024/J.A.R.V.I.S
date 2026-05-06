import os
from fastapi import FastAPI, UploadFile, File, HTTPException
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

@app.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribes audio using Groq Whisper."""
    try:
        content = await file.read()
        ext = file.filename.split(".")[-1]
        text = await processor.speech_to_text(content, ext)
        return {"text": text}
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
    return {"status": "ok", "engine": "J.A.R.V.I.S Core v2"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
