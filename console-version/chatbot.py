import cohere
from elevenlabs.client import ElevenLabs
from elevenlabs import play
from RealtimeSTT import AudioToTextRecorder

class VoiceChatbot:
    def __init__(self):
        self.cohere = cohere.Client("Cohere_API")
        self.elevenlabs = ElevenLabs(api_key="ElevenLabs_API")

    def speak(self, text):
        try:
            audio = self.elevenlabs.text_to_speech.convert(voice_id="VwC51uc4PUblWEJSPzeo",text=text,model_id="eleven_multilingual_v2")
            play(b"".join(audio))
        except Exception as e:
            print(f"Speech error: {e}")

    def think(self, text):
        response = self.cohere.chat(model="command-r7b-arabic-02-2025",message=text,temperature=0.7,max_tokens=500)
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

if __name__ == "__main__":
    VoiceChatbot().listen()
