// Wake Word Detection Service for "Hey Sensa"
export interface WakeWordConfig {
  wakeWord: string;
  threshold: number;
  continuous: boolean;
  language: string;
}

export interface WakeWordCallbacks {
  onWakeWordDetected: () => void;
  onListening: (isListening: boolean) => void;
  onError: (error: string) => void;
  onSpeechResult: (transcript: string, isFinal: boolean) => void;
}

class WakeWordService {
  private recognition: any = null;
  private isListening = false;
  private isWakeWordMode = true;
  private config: WakeWordConfig;
  private callbacks: WakeWordCallbacks;
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastSpeechTime = 0;

  constructor(config: WakeWordConfig, callbacks: WakeWordCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.callbacks.onError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onListening(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks.onListening(false);
      
      // Auto-restart for continuous wake word detection
      if (this.isWakeWordMode) {
        setTimeout(() => this.startListening(), 100);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      // Handle specific errors gracefully
      if (event.error === 'no-speech') {
        // Normal - just restart
        return;
      }
      
      if (event.error === 'not-allowed') {
        this.callbacks.onError('Microphone access denied. Please allow microphone access for voice features.');
        return;
      }
      
      this.callbacks.onError(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onresult = (event: any) => {
      this.lastSpeechTime = Date.now();
      
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = (finalTranscript + interimTranscript).toLowerCase();

      if (this.isWakeWordMode) {
        // Check for wake word
        if (this.detectWakeWord(fullTranscript)) {
          this.onWakeWordDetected();
        }
      } else {
        // In conversation mode - pass speech to callback
        this.callbacks.onSpeechResult(finalTranscript || interimTranscript, !!finalTranscript);
        
        // Auto-stop after silence
        this.resetSilenceTimer();
      }
    };
  }

  private detectWakeWord(transcript: string): boolean {
    const wakeWord = this.config.wakeWord.toLowerCase();
    const words = transcript.split(' ');
    
    // Check for exact phrase
    if (transcript.includes(wakeWord)) {
      return true;
    }
    
    // Check for partial matches (more flexible)
    const wakeWords = wakeWord.split(' ');
    let matchCount = 0;
    
    for (const word of wakeWords) {
      if (words.some(w => w.includes(word) || word.includes(w))) {
        matchCount++;
      }
    }
    
    return matchCount >= wakeWords.length * this.config.threshold;
  }

  private onWakeWordDetected() {
    console.log('Wake word detected: Hey Sensa!');
    this.isWakeWordMode = false;
    this.callbacks.onWakeWordDetected();
    
    // Continue listening for the actual command
    this.resetSilenceTimer();
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    
    // Return to wake word mode after 5 seconds of silence
    this.silenceTimer = setTimeout(() => {
      if (!this.isWakeWordMode && Date.now() - this.lastSpeechTime > 4000) {
        this.returnToWakeWordMode();
      }
    }, 5000);
  }

  private returnToWakeWordMode() {
    console.log('Returning to wake word mode');
    this.isWakeWordMode = true;
    this.callbacks.onSpeechResult('', true); // Signal end of conversation
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.callbacks.onError('Speech recognition not available');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.callbacks.onError('Failed to start voice recognition');
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public isInWakeWordMode(): boolean {
    return this.isWakeWordMode;
  }

  public forceWakeWordMode() {
    this.isWakeWordMode = true;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public destroy() {
    this.stopListening();
    this.recognition = null;
  }
}

// Singleton instance
let wakeWordService: WakeWordService | null = null;

export const initializeWakeWordService = (
  config: WakeWordConfig,
  callbacks: WakeWordCallbacks
): WakeWordService => {
  if (wakeWordService) {
    wakeWordService.destroy();
  }
  
  wakeWordService = new WakeWordService(config, callbacks);
  return wakeWordService;
};

export const getWakeWordService = (): WakeWordService | null => {
  return wakeWordService;
};

export default WakeWordService;