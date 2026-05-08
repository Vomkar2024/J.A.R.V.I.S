import sys
import json
import vosk
import os
import requests

vosk.set_log_level(-1)

JARVIS_URL = "http://localhost:8000/ws" # Or REST /ask
API_URL = "http://localhost:8000/ask"

if not os.path.exists("model"):
    print("Please download a vosk model and unpack as 'model' in the current folder.")
    sys.exit(1)

model = vosk.Model("model")
rec = vosk.KaldiRecognizer(model,16000)

print("--- JARVIS Local Listener Active ---")
while True:
    data=sys.stdin.buffer.read(4000) # Read in chunks
    if len(data)==0:
        break
    if rec.AcceptWaveform(data):
        res = json.loads(rec.Result())
        text = res.get('text', "")
        if text:
            print(f"You: {text}")
            try:
                # Send to JARVIS backend
                response = requests.post(API_URL, json={"text": text})
                if response.status_code == 200:
                    ai_res = response.json().get("response", "")
                    print(f"JARVIS: {ai_res}")
                else:
                    print(f"Error: {response.status_code}")
            except Exception as e:
                print(f"Could not connect to JARVIS backend: {e}")
            sys.stdout.flush()


