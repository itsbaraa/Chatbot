import cohere
from elevenlabs import ElevenLabs, play
from RealtimeSTT import AudioToTextRecorder
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import base64
import io
import os

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

class VoiceChatbot:
    def __init__(self):
        self.cohere = cohere.Client("nhh1rhpwchYSx0t8aZGHCEZlYWlSkpLFPk8oHp3W")  # Replace with your actual Cohere API key
        self.elevenlabs = ElevenLabs(api_key="sk_fbfeac9c967e1cd58908f9e8bb402bd3f31ebe44ca060cb2")  # Replace with your actual ElevenLabs API key

    def speak(self, text):
        try:
            audio = self.elevenlabs.text_to_speech.convert(voice_id="rPNcQ53R703tTmtue1AT",text=text,model_id="eleven_turbo_v2_5")
            play(b"".join(audio))
        except Exception as e:
            print(f"Speech error: {e}")
    
    def generate_audio(self, text):
        try:
            audio = self.elevenlabs.text_to_speech.convert(voice_id="rPNcQ53R703tTmtue1AT",text=text,model_id="eleven_turbo_v2_5")
            audio_bytes = b"".join(audio)
            return base64.b64encode(audio_bytes).decode('utf-8')
        except Exception as e:
            print(f"Audio generation error: {e}")
            return None

    def think(self, text):
        response = self.cohere.chat(model="command-r7b-arabic-02-2025",message=text,temperature=0.7,max_tokens=200, preamble="جاوب بلهجة سعودية فقط، جاوب بشكل مختصر، اسمك هو المساعد الذكي وقد صممك براء الجعوري")
        return response.text

    def listen(self):
        try:
            with AudioToTextRecorder(language="ar", sample_rate=16000) as recorder:
                while True:
                    text = recorder.text()
                    if text:
                        print(f"You: {text}")
                        response = self.think(text)
                        print(f"Bot: {response}")
                        self.speak(response)
        except KeyboardInterrupt:
            print("\nExiting chatbot...")
        except Exception as e:
            print(f"Error: {e}")

# Initialize chatbot instance
chatbot = VoiceChatbot()

# ---------------- RealtimeSTT Integration ----------------
import asyncio, threading, json, numpy as np
from scipy.signal import resample

recorder_ready = threading.Event()
is_running = True

# callback from recorder when partial text stabilises
async def _emit_realtime(text):
    emit('realtime', {'text': text})

def on_realtime(text):
    # schedule emit in SocketIO thread
    socketio.start_background_task(_emit_realtime_sync, text)

def _emit_realtime_sync(text):
    socketio.emit('realtime', {'text': text})

def create_recorder():
    config = {
        'spinner': False,
        'use_microphone': False,
        'model': 'base',
        'language': 'ar',
        'silero_sensitivity': 0.4,
        'webrtc_sensitivity': 2,
        'post_speech_silence_duration': 0.7,
        'min_length_of_recording': 0,
        'min_gap_between_recordings': 0,
        'enable_realtime_transcription': True,
        'realtime_processing_pause': 0.8,

        'realtime_model_type': 'base',
        'on_realtime_transcription_stabilized': on_realtime,
    }
    return AudioToTextRecorder(**config)

recorder = None

def recorder_loop():
    global recorder, is_running
    recorder = create_recorder()
    recorder_ready.set()
    while is_running:
        try:
            sentence = recorder.text()
            if sentence:
                socketio.emit('fullSentence', {'text': sentence})
        except Exception as e:
            print('Recorder error', e)

@socketio.on('connect')
def handle_connect():
    print('Web client connected')

@socketio.on('audio_chunk')
def handle_audio(data):
    # data: binary bytes (metadataLen + metadata + pcm16)
    if not recorder_ready.is_set():
        return
    try:
        metadata_length = int.from_bytes(data[:4], 'little')
        metadata_json = data[4:4+metadata_length].decode('utf-8')
        meta = json.loads(metadata_json)
        sample_rate = meta['sampleRate']
        chunk = data[4+metadata_length:]
        # resample to 16000
        audio_np = np.frombuffer(chunk, dtype=np.int16)
        target_samples = int(len(audio_np)*16000/sample_rate)
        resampled = resample(audio_np, target_samples).astype(np.int16).tobytes()
        recorder.feed_audio(resampled)
    except Exception as e:
        print('audio_chunk error', e)


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/test', methods=['GET'])
def test():
    return jsonify({'status': 'Backend is working!', 'message': 'الخادم يعمل بشكل صحيح'})

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        print(f"Received message: {user_message}")  # Debug log
        
        if not user_message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Generate response using Cohere
        response_text = chatbot.think(user_message)
        print(f"Generated response: {response_text}")  # Debug log
        
        # Generate audio using ElevenLabs
        audio_base64 = chatbot.generate_audio(response_text)
        
        return jsonify({
            'text': response_text,
            'audio': audio_base64
        })
        
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

if __name__ == "__main__":
    # start recorder in background thread
    socketio.start_background_task(recorder_loop)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)