class VoiceAI {
    constructor() {
        this.isRecording = false;
        this.isProcessing = false;
        this.recognition = null;
        this.initElements();
        // Disabled Google SpeechRecognition — using RealtimeSTT WebSocket instead
        // this.initSpeechRecognition();
        this.initAnimations();
        // Expose globally for realtime.js
        window.voiceAI = this;
    }

    initElements() {
        this.micButton = document.getElementById('mic-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.realtimeSpeech = document.getElementById('realtime-speech');
        this.realtimeText = document.getElementById('realtime-text');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.textInput = document.getElementById('text-input');
        this.sendButton = document.getElementById('send-button');
        
        this.micButton.addEventListener('click', () => this.toggleRecording());
        this.sendButton.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendTextMessage();
            }
        });
    }

    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
            this.recognition.maxAlternatives = 1;
            
            // Optional: add custom grammars here if needed
            // const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
            // this.recognition.grammars = new SpeechGrammarList();
            // Leave serviceURI default

            this.recognition.onstart = () => this.onRecordingStart();
            this.recognition.onresult = (event) => this.onSpeechResult(event);
            this.recognition.onend = () => this.onRecordingEnd();
            this.recognition.onerror = (event) => this.onSpeechError(event);
            
            // Test if microphone permission is available
            this.testMicrophoneAccess();
        } else {
            this.showError('متصفحك لا يدعم التعرف على الصوت. يرجى استخدام Chrome أو Edge');
        }
    }

    async testMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            console.log('Microphone access granted');
        } catch (error) {
            console.error('Microphone access denied:', error);
            this.showError('يرجى السماح بالوصول للميكروفون');
        }
    }

    initAnimations() {
        // Animate welcome message
        anime({
            targets: '.welcome-message',
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 1000,
            easing: 'easeOutCubic',
            delay: 500
        });

        // Animate header elements
        anime({
            targets: '.logo',
            opacity: [0, 1],
            translateX: [-50, 0],
            duration: 800,
            easing: 'easeOutCubic'
        });

        anime({
            targets: '.status-indicator',
            opacity: [0, 1],
            translateX: [50, 0],
            duration: 800,
            easing: 'easeOutCubic',
            delay: 200
        });

        // Animate mic button
        anime({
            targets: '.mic-button',
            opacity: [0, 1],
            scale: [0.8, 1],
            duration: 1000,
            easing: 'easeOutElastic(1, .8)',
            delay: 800
        });
    }

    toggleRecording() {
        if (this.isProcessing) return;

        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        // Dispatch event for realtime.js to clear previous text
        document.dispatchEvent(new CustomEvent('start-recording'));

        // No built-in SpeechRecognition; proceed with RealtimeSTT
        this.isRecording = true;
        this.micButton.classList.add('recording');
        this.realtimeSpeech.classList.add('active');
        this.realtimeText.textContent = 'استمع...';
        
        this.updateStatus('recording', 'جاري التسجيل...');
        
        // Animate mic button
        anime({
            targets: this.micButton,
            scale: [1, 1.1, 1],
            duration: 300,
            easing: 'easeInOutQuad'
        });

    }

    stopRecording() {
        this.isRecording = false;
        this.micButton.classList.remove('recording');
        this.realtimeSpeech.classList.remove('active');
        
        this.updateStatus('ready', 'جاهز للمحادثة');
        
        if (this.recognition) {
            this.recognition.stop();
        }
    }

    onRecordingStart() {
        console.log('بدء التسجيل');
    }

    onSpeechResult(event) {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Update real-time display
        const displayText = finalTranscript || interimTranscript || 'استمع...';
        this.realtimeText.textContent = displayText;

        // If we have a final result, process it
        if (finalTranscript.trim()) {
            this.processUserInput(finalTranscript.trim());
        }
    }

    onRecordingEnd() {
        console.log('انتهاء التسجيل');
        // If recording ended but we're still in recording state, restart
        if (this.isRecording && !this.isProcessing) {
            setTimeout(() => {
                if (this.isRecording) {
                    this.recognition.start();
                }
            }, 100);
        }
    }

    onSpeechError(event) {
        console.error('خطأ في التعرف على الصوت:', event.error);
        this.stopRecording();
        
        let errorMessage = 'حدث خطأ في التعرف على الصوت';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'لم يتم اكتشاف صوت. حاول مرة أخرى';
                // Auto-restart recording after no-speech error
                setTimeout(() => {
                    if (!this.isRecording && !this.isProcessing) {
                        this.startRecording();
                    }
                }, 1000);
                break;
            case 'audio-capture':
                errorMessage = 'لا يمكن الوصول للميكروفون. تأكد من توصيل الميكروفون';
                break;
            case 'not-allowed':
                errorMessage = 'الإذن مرفوض للوصول للميكروفون. يرجى السماح بالوصول';
                break;
            case 'network':
                errorMessage = 'خطأ في الشبكة. تحقق من الاتصال بالإنترنت';
                break;
            case 'language-not-supported':
                errorMessage = 'اللغة العربية غير مدعومة. جاري التبديل للإنجليزية';
                this.recognition.lang = 'en-US';
                break;
            case 'service-not-allowed':
                errorMessage = 'خدمة التعرف على الصوت غير متاحة';
                break;
        }
        
        this.showError(errorMessage);
    }

    async processUserInput(userText) {
        this.stopRecording();
        this.showLoading(true);
        this.isProcessing = true;

        // Add user message to chat
        this.addMessage(userText, 'user');

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userText })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Add AI response to chat
            this.addMessage(data.text, 'ai');
            
            // Play audio response if available
            if (data.audio) {
                this.playAudioResponse(data.audio);
            }

        } catch (error) {
            console.error('خطأ في الاتصال:', error);
            this.addMessage('عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.', 'ai');
        } finally {
            this.showLoading(false);
            this.isProcessing = false;
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatar = document.createElement('div');
        avatar.className = `${sender}-avatar`;
        avatar.innerHTML = sender === 'user' ? '<i class="bi bi-person"></i>' : '<i class="bi bi-robot"></i>';

        const content = document.createElement('div');
        content.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        content.appendChild(paragraph);

        if (sender === 'user') {
            messageDiv.appendChild(content);
            messageDiv.appendChild(avatar);
        } else {
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
        }

        this.chatMessages.appendChild(messageDiv);

        // Animate message appearance
        anime({
            targets: messageDiv,
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 500,
            easing: 'easeOutCubic'
        });

        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    playAudioResponse(audioBase64) {
        try {
            const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
            
            audio.onloadstart = () => {
                this.updateStatus('speaking', 'جاري التحدث...');
            };
            
            audio.onended = () => {
                this.updateStatus('ready', 'جاهز للمحادثة');
            };
            
            audio.onerror = () => {
                console.error('خطأ في تشغيل الصوت');
                this.updateStatus('ready', 'جاهز للمحادثة');
            };
            
            audio.play();
        } catch (error) {
            console.error('خطأ في تشغيل الصوت:', error);
            this.updateStatus('ready', 'جاهز للمحادثة');
        }
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.add('active');
            this.updateStatus('processing', 'جاري المعالجة...');
        } else {
            this.loadingOverlay.classList.remove('active');
            this.updateStatus('ready', 'جاهز للمحادثة');
        }
    }

    updateStatus(type, text) {
        this.statusText.textContent = text;
        
        // Update status dot color
        this.statusDot.style.background = {
            'ready': '#00ff88',
            'recording': '#ff4757',
            'processing': '#ffa500',
            'speaking': '#00d4ff'
        }[type] || '#00ff88';
    }

    sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text || this.isProcessing) return;
        
        this.textInput.value = '';
        this.processUserInput(text);
    }

    showError(message) {
        this.addMessage(message, 'ai');
        this.updateStatus('ready', 'جاهز للمحادثة');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new VoiceAI();
    
    // Test backend connection
    fetch('/test')
        .then(response => response.json())
        .then(data => {
            console.log('Backend connection test:', data);
            app.updateStatus('ready', 'جاهز للمحادثة');
        })
        .catch(error => {
            console.error('Backend connection failed:', error);
            app.updateStatus('error', 'خطأ في الاتصال بالخادم');
        });
});

// Add some visual effects
document.addEventListener('mousemove', (e) => {
    const cursor = document.querySelector('.cursor');
    if (!cursor) {
        const newCursor = document.createElement('div');
        newCursor.className = 'cursor';
        newCursor.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, rgba(0,212,255,0.3) 0%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            transition: transform 0.1s ease;
        `;
        document.body.appendChild(newCursor);
    }
    
});