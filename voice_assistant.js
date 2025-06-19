function initializeVoiceAssistant() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.onstart = function() {
        console.log('Voice assistant activated');
    };
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        handleVoiceCommand(transcript);
    };
    recognition.onerror = function(event) {
        console.error('Error occurred in recognition: ' + event.error);
    };
    recognition.onend = function() {
        console.log('Voice assistant deactivated');
        initializeVoiceAssistant();
    };
    recognition.start();
} 