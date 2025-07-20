// RealtimeSTT client that captures microphone audio via Web Audio API
// and streams it to the local WebSocket server (port 8001).
// It updates the UI via the existing VoiceAI instance (window.voiceAI)
// and sends final transcriptions to the chat backend through voiceAI.processUserInput.

(() => {
    const WS_URL = "ws://localhost:8001";
    const RECONNECT_MS = 5000;

    let socket = null;
    let fullSentences = [];
    let serverAvailable = false;
    let micAvailable = false;

    const voiceAIReady = () => window.voiceAI && window.voiceAI.realtimeText;

    const displayRealtimeText = (realtimeText) => {
        if (!voiceAIReady()) return;
        const textEl = window.voiceAI.realtimeText;
        // Combine finalized sentences with the current realtime chunk
        textEl.textContent = [...fullSentences, realtimeText].join(' ');
    };

    const startMessage = () => {
        if (!voiceAIReady()) return;
        if (!micAvailable) {
            displayRealtimeText('يرجى منح إذن الميكروفون 🎤');
        } else if (!serverAvailable) {
            displayRealtimeText('الخادم غير متصل');
        } else {
            displayRealtimeText('استمع...');
        }
    };

    const connectToServer = () => {
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            serverAvailable = true;
            fullSentences = []; // Clear history on new connection
            startMessage();
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'realtime') {
                displayRealtimeText(data.text);
            } else if (data.type === 'fullSentence') {
                fullSentences.push(data.text);
                if (voiceAIReady() && !window.voiceAI.isProcessing) {
                    window.voiceAI.processUserInput(fullSentences.join(' '));
                }
                fullSentences = []; // Clear after processing
                displayRealtimeText('');
                fullSentences.push(data.text);
                displayRealtimeText('');
                if (voiceAIReady() && !window.voiceAI.isProcessing) {
                    window.voiceAI.processUserInput(data.text);
                }
            }
        };

        socket.onclose = () => {
            serverAvailable = false;
        };
    };

    // Attempt initial connection
    connectToServer();
    // Retry periodically if disconnected
    setInterval(() => {
        if (!serverAvailable || socket.readyState === WebSocket.CLOSED) {
            connectToServer();
        }
    }, RECONNECT_MS);

    const startRecordingLogic = () => {
        fullSentences = [];
        displayRealtimeText('');
    };

    // Listen for custom event from script.js
    document.addEventListener('start-recording', startRecordingLogic);

    // Request microphone access and stream PCM16 audio to WS
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        micAvailable = true;
        startMessage();

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(256, 1, 1);
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
            if (socket.readyState !== WebSocket.OPEN) return;
            if (!voiceAIReady() || !window.voiceAI.isRecording) return;
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }

            // metadata JSON describing sample rate
            const metadata = JSON.stringify({ sampleRate: audioContext.sampleRate });
            const metadataBytes = new TextEncoder().encode(metadata);
            const metadataLenBuffer = new ArrayBuffer(4);
            new DataView(metadataLenBuffer).setInt32(0, metadataBytes.byteLength, true);

            const blob = new Blob([metadataLenBuffer, metadataBytes, pcm16.buffer]);
            socket.send(blob);
        };
    }).catch((err) => {
        console.error('Microphone permission denied', err);
        micAvailable = false;
        startMessage();
    });
})();
