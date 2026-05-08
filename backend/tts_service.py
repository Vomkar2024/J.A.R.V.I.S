import sys
import os
import asyncio
import edge_tts
import base64

VOICE = "en-GB-RyanNeural"

async def generate_tts_streaming(text):
    communicate = edge_tts.Communicate(text,VOICE)

    #Stream audio chunks
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_base64 = base64.b64encode(chunk["data"])
            print(f"AUDIO_CHUNK:{audio_base64}")
            sys.stdout.flush()

async def generate_tts_file(text):
    output_file = "output.mp3"
    communicate = edge_tts.Communicate(text,VOICE)
    await communicate.save(output_file)
    print(f"TTS_Saved: {os.path.abspath(output_file)}")
    sys.stdout.flush()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        text = sys.argv[1]
        mode = sys.argv[2] if len(sys.argv) > 2 else "stream"

        if mode == "stream":
            asyncio.run(generate_tts_streaming(text))
        elif mode == "file":
            asyncio.run(generate_tts_file(text))
    else:
        print("ERROR : No text provided" , file=sys.stderr)
        sys.exit(1)