import os
import base64
import pyautogui
from PIL import Image
from io import BytesIO
from groq import Groq
import uuid

class JarvisVision:
    """
    JarvisVision
    The optical processing unit for J.A.R.V.I.S.
    Handles screen capture and analysis using multi-modal LLMs.
    """
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def capture_screen(self):
        """Captures the primary monitor and returns a base64 encoded string with token optimization."""
        try:
            screenshot = pyautogui.screenshot()
            
            # PROACTIVE REPAIR: Token Saver — Resize image for Vision model efficiency
            # Llama 3.2 Vision uses tiles; smaller images = fewer tiles = fewer tokens
            max_size = (1280, 720)
            screenshot.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            buffered = BytesIO()
            # Compress to save bandwidth/tokens
            screenshot.save(buffered, format="JPEG", quality=65)
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
            print(f"[Vision] Optimized screen captured ({screenshot.width}x{screenshot.height}).")
            return img_str
        except Exception as e:
            print(f"[Vision] Capture Error: {e}")
            return None

    def analyze_screen(self, user_query: str):
        """Captures the screen and asks the vision model for analysis."""
        base64_image = self.capture_screen()
        if not base64_image:
            return "I'm sorry, sir. My visual sensors are currently offline."

        try:
            # Prepare the request for Llama 3.2 Vision
            completion = self.client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"You are J.A.R.V.I.S. Analyze this screen capture for the user. User question: {user_query}"},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                max_tokens=512,
            )
            
            response = completion.choices[0].message.content
            return response
        except Exception as e:
            print(f"[Vision] Analysis Error: {e}")
            return "I encountered an error while processing the visual data, sir."
