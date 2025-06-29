export interface WakeWordConfig {
  wakeWord: string;
  onWakeWordDetected: () => void;
  onError: (error: string) => void;
  onListeningStateChange: (isListening: boolean) => void;
}

export class WakeWordService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private config: WakeWordConfig;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(config: WakeWordConfig) {
    this.config = config;
  }

  start(): boolean {
    if (!this.isSupported()) {
      this.config.onError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.setupRecognition();
      this.recognition?.start();
      return true;
    } catch (error) {
      this.handleError('Failed to start speech recognition', error);
      return false;
    }
  }

  stop(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
    this.retryCount = 0;
    this.config.onListeningStateChange(false);
  }

  private isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  private setupRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.retryCount = 0; // Reset retry count on successful start
      this.config.onListeningStateChange(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.config.onListeningStateChange(false);
      
      // Only restart if we haven't been explicitly stopped
      if (this.retryCount < this.maxRetries) {
        this.scheduleRetry();
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      this.config.onListeningStateChange(false);

      let errorMessage = 'Speech recognition error occurred';
      let shouldRetry = false;

      switch (event.error) {
        case 'network':
          errorMessage = 'Network error occurred. Please check your internet connection and try again.';
          shouldRetry = true;
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access and refresh the page.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. The service will continue listening.';
          shouldRetry = true;
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed. Please check your microphone and try again.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech recognition service not allowed. Please check your browser settings.';
          break;
        case 'bad-grammar':
          errorMessage = 'Speech recognition grammar error.';
          shouldRetry = true;
          break;
        case 'language-not-supported':
          errorMessage = 'Language not supported by speech recognition service.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
          shouldRetry = true;
          break;
      }

      this.handleError(errorMessage, event.error, shouldRetry);
    };

    this.recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        
        // Check for wake word variations
        const wakeWordVariations = [
          this.config.wakeWord.toLowerCase(),
          'hey sensa',
          'hey sensor',
          'hey sense',
          'a sensa',
          'hey santa'
        ];

        if (wakeWordVariations.some(variation => transcript.includes(variation))) {
          this.config.onWakeWordDetected();
        }
      }
    };
  }

  private handleError(message: string, error?: any, shouldRetry: boolean = false): void {
    console.error('Wake word service error:', message, error);
    
    if (shouldRetry && this.retryCount < this.maxRetries) {
      this.scheduleRetry();
    } else {
      this.config.onError(message);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.retryCount++;
    const delay = this.retryDelay * this.retryCount; // Exponential backoff

    this.retryTimeout = setTimeout(() => {
      if (this.retryCount <= this.maxRetries) {
        console.log(`Retrying speech recognition (attempt ${this.retryCount}/${this.maxRetries})`);
        this.start();
      }
    }, delay);
  }

  getRetryInfo(): { retryCount: number; maxRetries: number; isRetrying: boolean } {
    return {
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      isRetrying: this.retryTimeout !== null
    };
  }
}