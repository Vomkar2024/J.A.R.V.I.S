import asyncio
import edge_tts

async def test():
    print("Testing Edge TTS...")
    try:
        c = edge_tts.Communicate("Hello, I am Jarvis. How may I assist you today?", "en-GB-RyanNeural")
        data = b""
        chunk_count = 0
        async for chunk in c.stream():
            if chunk["type"] == "audio":
                data += chunk["data"]
                chunk_count += 1
        print(f"SUCCESS: Got {len(data)} audio bytes in {chunk_count} chunks")
        
        # Also test saving to file
        c2 = edge_tts.Communicate("Test save.", "en-GB-RyanNeural")
        await c2.save("temp/test_output.mp3")
        import os
        size = os.path.getsize("temp/test_output.mp3")
        print(f"File save test: {size} bytes written to temp/test_output.mp3")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")

asyncio.run(test())
