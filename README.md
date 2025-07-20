# Chatbot

This project is a real-time conversational chatbot with a web interface to interact with users using Cohere for responses and ElevenLabs for TTS.

<img width="1659" height="1303" alt="image" src="https://github.com/user-attachments/assets/9ab34162-3b3e-4084-a75f-1670008f4864" />

## Key Features

- Real-time speech-to-text conversion
- Natural language processing for understanding user queries
- Audio response generation
- WebSocket-based real-time communication

## How it works

This chatbot application provides an interactive voice-enabled chat interface with the following components:

1. **Frontend Interface**:
   - A modern, responsive web interface built with HTML, CSS, and JavaScript
   - Real-time text display and message history
   - Voice input with visual feedback

2. **Backend Services**:
   - `Chatbot.py`: Handles chat logic, processes user input, and generates responses
   - `RealtimeSTT_Server.py`: Processes audio streams and converts speech to text in real-time

## Requirements

Before setting up the project, ensure you have the following:

- **Python (3.9 - 3.12)**
- **API Keys**:
  - ElevenLabs API key (for text-to-speech functionality)
  - Cohere API key (for the `command-r7b-arabic-02-2025` model used for Arabic language processing)
- **Dependencies**:
  - All required Python packages are listed in `requirements.txt`
  - Install using: `pip install -r requirements.txt`

## Setup
1- Clone the repository
  
2- Run the real-time speech-to-text server: `python RealtimeSTT_Server.py`
  
3- Run the chatbot backend: `python Chatbot.py` 

## Showcase

https://github.com/user-attachments/assets/dcbd466c-79c9-4209-8db7-b0704ef6f665
