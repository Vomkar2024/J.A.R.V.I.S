import os
import uuid
import asyncio
import aiofiles
import json
import base64
import vosk
from groq import Groq
import edge_tts
from duckduckgo_search import DDGS
from core.tool_registry import TOOL_DEFINITIONS, execute_tool
from core.memory import JarvisMemory
from core.vision import JarvisVision
import subprocess
import glob

class JarvisProcessor:
    """
    JarvisProcessor
    The neural engine of J.A.R.V.I.S.
    Handles STT (Groq Whisper), LLM (Groq Llama), and TTS (Edge TTS).
    Optimized for real-time streaming.
    """
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.temp_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp")
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # J.A.R.V.I.S Settings
        self.voice = "en-GB-RyanNeural"
        self.system_prompt = (
            "You are J.A.R.V.I.S., the sophisticated AI from the Marvel movies. "
            "You are currently using the movie-accurate voice profile from the integrated "
            "Voice Pack. Your tone is dry, British, witty, and extremely loyal. "
            "Respond as if you are actually JARVIS assisting YOU (the user), your creator. "
            "Keep responses concise and elegant."
        )
        
        # Initialize Long-Term Memory (ChromaDB)
        self.memory = JarvisMemory()
        
        # Initialize Vision Processing
        self.vision = JarvisVision()
        
        # Conversation memory (last N exchanges)
        self.conversation_history = []
        self.max_history = 10
        
        # Vosk STT Model
        self.vosk_model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model")
        self.vosk_model = None
        if os.path.exists(self.vosk_model_path):
            try:
                self.vosk_model = vosk.Model(self.vosk_model_path)
                print(f"[Processor] Vosk model loaded from {self.vosk_model_path}")
            except Exception as e:
                print(f"[Processor] Error loading Vosk model: {e}")
        else:
            print(f"[Processor] Vosk model not found at {self.vosk_model_path}. Local STT will be disabled.")

    def _add_to_history(self, role: str, content: str):
        """Add a message to conversation history."""
        self.conversation_history.append({"role": role, "content": content})
        # Trim to max history
        if len(self.conversation_history) > self.max_history * 2:
            self.conversation_history = self.conversation_history[-(self.max_history * 2):]

    async def speech_to_text(self, audio_content: bytes, extension: str) -> str:
        """Transcribes audio using Groq Whisper-Large-V3-Turbo (faster)."""
        temp_filename = f"stt_{uuid.uuid4()}.{extension}"
        temp_path = os.path.join(self.temp_dir, temp_filename)
        
        try:
            async with aiofiles.open(temp_path, mode='wb') as f:
                await f.write(audio_content)
            
            with open(temp_path, "rb") as file:
                transcription = self.client.audio.translations.create(
                    file=(temp_filename, file.read()),
                    model="whisper-large-v3-turbo",
                    response_format="text"
                )
            return transcription
        except Exception as e:
            print(f"STT Error: {e}")
            return ""
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    async def speech_to_text_local(self, audio_content: bytes) -> str:
        """Transcribes audio locally using Vosk."""
        if not self.vosk_model:
            return "Error: Vosk model not loaded."
        
        try:
            # Vosk expects 16kHz mono PCM audio
            # For simplicity, we assume the input is already in this format or we handle it
            # In a real scenario, we might need to convert it using ffmpeg
            rec = vosk.KaldiRecognizer(self.vosk_model, 16000)
            
            if rec.AcceptWaveform(audio_content):
                res = json.loads(rec.Result())
                return res.get("text", "")
            else:
                res = json.loads(rec.FinalResult())
                return res.get("text", "")
        except Exception as e:
            print(f"Local STT Error: {e}")
            return ""

    async def ask_llm(self, text: str) -> str:
        """Gets a response from Groq LLM (non-streaming fallback, handles tools & memory)."""
        try:
            self._add_to_history("user", text)
            
            # Retrieve relevant past memories (RAG)
            relevant_context = self.memory.query_memory(text)
            
            messages = [{"role": "system", "content": self.system_prompt + relevant_context}]
            messages.extend(self.conversation_history)
            
            # Initial LLM call with tools
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                temperature=0.7,
                max_tokens=300
            )
            
            response_message = completion.choices[0].message
            tool_calls = response_message.tool_calls
            
            # If the model wants to call tools
            if tool_calls:
                messages.append(response_message)
                
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    print(f"[Processor] Executing tool: {function_name}")
                    
                    function_response = execute_tool(function_name, function_args)
                    
                    if function_response == "MEMORY_PURGE_REQUESTED":
                        self.memory.clear_all_memories()
                        function_response = "Memory wiped successfully, sir."
                    elif function_response == "VISION_REQUESTED":
                        query = function_args.get("query", "What is on the screen?")
                        print(f"[Processor] Activating Vision: {query}")
                        # We could emit a signal here if we had the websocket context, 
                        # but in non-streaming fallback we just process it.
                        function_response = self.vision.analyze_screen(query)
                    elif function_response == "CREATE_FILE_REQUESTED":
                        path = function_args.get("path")
                        content = function_args.get("content")
                        try:
                            # Ensure parent directories exist
                            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
                            with open(path, "w", encoding="utf-8") as f:
                                f.write(content)
                            function_response = f"File created successfully at {path}."
                        except Exception as e:
                            function_response = f"Error creating file: {str(e)}"
                    elif function_response == "SEARCH_FILES_REQUESTED":
                        query = function_args.get("query")
                        root = function_args.get("root_dir", ".")
                        try:
                            matches = glob.glob(os.path.join(root, "**", query), recursive=True)
                            function_response = f"Found {len(matches)} files: {', '.join(matches[:10])}{'...' if len(matches) > 10 else ''}"
                        except Exception as e:
                            function_response = f"Error searching files: {str(e)}"
                    elif function_response == "TERMINAL_EXECUTION_REQUESTED":
                        command = function_args.get("command")
                        print(f"[Processor] Executing Terminal: {command}")
                        try:
                            # Running in a subprocess and capturing output
                            # Note: In a real Jarvis, you'd want more safety/confirmation
                            result = subprocess.check_output(command, shell=True, text=True, stderr=subprocess.STDOUT)
                            function_response = f"Command Output: {result[:500]}..."
                        except subprocess.CalledProcessError as e:
                            function_response = f"Command failed: {e.output[:500]}..."
                        except Exception as e:
                            function_response = f"Error: {str(e)}"
                    elif function_response == "READ_FILE_REQUESTED":
                        path = function_args.get("path")
                        try:
                            with open(path, "r", encoding="utf-8") as f:
                                content = f.read()
                            function_response = f"File Content of {path}:\n{content[:2000]}"
                        except Exception as e:
                            function_response = f"Error reading file: {str(e)}"
                    elif function_response == "WEB_SEARCH_REQUESTED":
                        query = function_args.get("query")
                        print(f"[Processor] Searching the web for: {query}")
                        try:
                            with DDGS() as ddgs:
                                results = [r for r in ddgs.text(query, max_results=5)]
                                function_response = json.dumps(results)
                        except Exception as e:
                            function_response = f"Search failed: {str(e)}"
                    
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": function_response,
                    })
                
                # Second LLM call with tool results
                second_completion = self.client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    tool_choice="none" # Ensure final response is text
                )
                response = second_completion.choices[0].message.content
            else:
                response = response_message.content
                
            self._add_to_history("assistant", response)
            
            # Store this exchange in long-term memory
            self.memory.store_memory(text, response)
            
            return response
        except Exception as e:
            print(f"LLM Error: {e}")
            return "I'm sorry, sir. I'm having trouble accessing my neural network at the moment."

    def load_initial_memory(self):
        """Loads the most recent memories into the starting conversation history."""
        try:
            # Query the last few memories
            results = self.memory.collection.get(
                limit=5,
                include=["documents", "metadatas"]
            )
            
            docs = results.get("documents", [])
            
            if not docs:
                return
                
            # Chroma get() might not return in order, but for now we'll take the 5 most recent
            for i in range(len(docs)-1, -1, -1):
                content = docs[i]
                # Try to parse "User: ... \nJarvis: ..."
                if "User:" in content and "Jarvis:" in content:
                    parts = content.split("Jarvis:")
                    user_text = parts[0].replace("User:", "").strip()
                    ai_text = parts[1].strip()
                    
                    self.conversation_history.append({"role": "user", "content": user_text})
                    self.conversation_history.append({"role": "assistant", "content": ai_text})
            
            print(f"[Processor] Recalled {len(docs)} recent conversation units.")
        except Exception as e:
            print(f"[Processor] Error recalling initial memory: {e}")

    def stream_llm(self, text: str):
        """
        Streams LLM response token by token (generator).
        Note: Tool calling is handled synchronously before streaming the final response.
        Memory retrieval (RAG) is performed before the first LLM call.
        """
        try:
            self._add_to_history("user", text)
            
            # Retrieve relevant past memories (RAG)
            relevant_context = self.memory.query_memory(text)
            
            if relevant_context:
                yield "[MEMORY_ACTIVE]"
                # Send the memory data as a hidden signal (or we could just use it)
                # yield f"[MEMORY_DATA:{relevant_context}]"
            
            messages = [{"role": "system", "content": self.system_prompt + relevant_context}]
            messages.extend(self.conversation_history)
            
            # 1. Check if tool calling is needed (non-streaming first)
            initial_check = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
                max_tokens=300
            )
            
            response_message = initial_check.choices[0].message
            tool_calls = response_message.tool_calls
            
            if tool_calls:
                messages.append(response_message)
                for tool_call in tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    print(f"[Processor] Executing tool: {function_name}")
                    
                    function_response = execute_tool(function_name, function_args)
                    
                    if function_response == "MEMORY_PURGE_REQUESTED":
                        self.memory.clear_all_memories()
                        function_response = "Memory wiped successfully, sir."
                    elif function_response == "VISION_REQUESTED":
                        query = function_args.get("query", "What is on the screen?")
                        print(f"[Processor] Activating Vision: {query}")
                        # Provide a visual hint to the generator that vision is active
                        yield "[VISION_ACTIVE]" 
                        function_response = self.vision.analyze_screen(query)
                        yield "[VISION_ENDED]"
                    else:
                        # Generic tool use signal
                        yield f"[TOOL_START:{function_name.upper()}]"
                        
                        if function_response == "CREATE_FILE_REQUESTED":
                            path = function_args.get("path")
                            content = function_args.get("content")
                            try:
                                os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
                                with open(path, "w", encoding="utf-8") as f:
                                    f.write(content)
                                function_response = f"File created successfully at {path}."
                            except Exception as e:
                                function_response = f"Error creating file: {str(e)}"
                        elif function_response == "READ_FILE_REQUESTED":
                            path = function_args.get("path")
                            try:
                                with open(path, "r", encoding="utf-8") as f:
                                    content = f.read()
                                function_response = f"File Content of {path}:\n{content[:2000]}"
                            except Exception as e:
                                function_response = f"Error reading file: {str(e)}"
                        elif function_response == "SEARCH_FILES_REQUESTED":
                            query = function_args.get("query")
                            root = function_args.get("root_dir", ".")
                            try:
                                matches = glob.glob(os.path.join(root, "**", query), recursive=True)
                                function_response = f"Found {len(matches)} files: {', '.join(matches[:10])}{'...' if len(matches) > 10 else ''}"
                            except Exception as e:
                                function_response = f"Error searching files: {str(e)}"
                        elif function_response == "WEB_SEARCH_REQUESTED":
                            query = function_args.get("query")
                            print(f"[Processor] Searching the web for: {query}")
                            try:
                                with DDGS() as ddgs:
                                    results = [r for r in ddgs.text(query, max_results=5)]
                                    function_response = json.dumps(results)
                            except Exception as e:
                                function_response = f"Search failed: {str(e)}"
                        elif function_response == "WEATHER_REQUESTED":
                            location = function_args.get("location")
                            print(f"[Processor] Fetching weather for: {location}")
                            try:
                                with DDGS() as ddgs:
                                    results = [r for r in ddgs.text(f"current weather in {location}", max_results=3)]
                                    function_response = json.dumps(results)
                            except Exception as e:
                                function_response = f"Could not fetch weather: {str(e)}"
                        elif function_response == "TERMINAL_EXECUTION_REQUESTED":
                            command = function_args.get("command")
                            print(f"[Processor] Executing Terminal: {command}")
                            try:
                                result = subprocess.check_output(command, shell=True, text=True, stderr=subprocess.STDOUT)
                                function_response = f"Command Output: {result[:500]}..."
                            except subprocess.CalledProcessError as e:
                                function_response = f"Command failed: {e.output[:500]}..."
                            except Exception as e:
                                function_response = f"Error: {str(e)}"
                        
                        yield f"[TOOL_END:{function_name.upper()}]"
                    
                    messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": function_response,
                    })
                
                # After tool execution, stream the final response
                # We use tool_choice="none" here because our streaming loop 
                # only handles text content, not further tool calls.
                stream = self.client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    tool_choice="none",
                    stream=True
                )
                
                full_response = ""
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        yield token
            else:
                # No tool calls, we can just yield the content from the first call
                # But to keep the "streaming" feel, we'll split it into tokens
                # OR we could call it again with stream=True. 
                # Calling again is safer to get the exact same behavior as the tool-calling path.
                stream = self.client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=300,
                    stream=True
                )
                
                full_response = ""
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        yield token
            
            self._add_to_history("assistant", full_response)
            
            # Store this exchange in long-term memory
            self.memory.store_memory(text, full_response)
            
        except Exception as e:
            print(f"LLM Stream Error: {e}")
            error_msg = "I'm sorry, sir. Neural link interrupted."
            self._add_to_history("assistant", error_msg)
            yield error_msg

    async def translate_text(self, text: str) -> str:
        """High-accuracy translation specifically tuned for Hinglish/Hindi to English."""
        try:
            prompt = (
                "You are a master translator. Translate the following Hinglish or Hindi text into clear, "
                "natural English. Only return the translation, no explanations or quotes. "
                f"Text: {text}"
            )
            completion = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a professional translator. Output only the translated text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=512,
                stream=False
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"Translation Error: {e}")
            return text

    async def text_to_speech(self, text: str) -> str:
        """Converts text to audio using Edge TTS (Microsoft Ryan Neural)."""
        temp_filename = f"tts_{uuid.uuid4()}.mp3"
        temp_path = os.path.join(self.temp_dir, temp_filename)
        
        try:
            # Using RyanNeural for that sophisticated British-adjacent tone
            communicate = edge_tts.Communicate(text, self.voice)
            await communicate.save(temp_path)
            return temp_path
        except Exception as e:
            print(f"TTS Error: {e}")
            return ""

    async def text_to_speech_bytes(self, text: str) -> bytes:
        """Converts text to audio bytes using Edge TTS. Returns raw MP3 bytes."""
        try:
            # Consistent with system voice
            communicate = edge_tts.Communicate(text, self.voice)
            audio_data = b""
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data += chunk["data"]
                    # If we wanted to mirror the printing in tts_service.py:
                    # audio_base64 = base64.b64encode(chunk["data"])
                    # print(f"AUDIO_CHUNK:{audio_base64}")
            return audio_data
        except Exception as e:
            print(f"TTS Bytes Error: {e}")
            return b""

    async def process_full_cycle(self, audio_content: bytes):
        """Orchestrates the full Audio -> Text -> LLM -> Audio pipeline."""
        # 1. STT
        user_text = await self.speech_to_text(audio_content, "webm")
        if not user_text or len(user_text.strip()) < 2:
            return None, None, None
            
        # 2. LLM
        ai_response = await self.ask_llm(user_text)
        
        # 3. TTS
        audio_path = await self.text_to_speech(ai_response)
        
        return user_text, ai_response, audio_path

    def clear_history(self):
        """Clears conversation history."""
        self.conversation_history = []
