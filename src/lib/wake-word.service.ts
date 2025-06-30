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
  private restartTimer: NodeJS.Timeout | null = null;

  constructor(config: WakeWordConfig, callbacks: WakeWordCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      this.callbacks.onError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Enhanced configuration for better recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = 3; // Get more alternatives for better matching
    this.recognition.grammars = null; // Don't restrict grammar

    this.recognition.onstart = () => {
      console.log('🎤 SPEECH: Recognition started');
      this.isListening = true;
      this.callbacks.onListening(true);
    };

    this.recognition.onend = () => {
      console.log('🎤 SPEECH: Recognition ended');
      this.isListening = false;
      this.callbacks.onListening(false);
      
      // Clear any existing restart timer
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
      }
      
      // Auto-restart for continuous wake word detection with a small delay
      if (this.isWakeWordMode) {
        this.restartTimer = setTimeout(() => {
          console.log('🔄 SPEECH: Auto-restarting recognition');
          this.startListening();
        }, 500); // Increased delay to prevent rapid restarts
      }
    };

    this.recognition.onerror = (event: any) => {
      console.log('🎤 SPEECH: Error event:', event.error);
      
      // Handle specific errors gracefully
      if (event.error === 'no-speech') {
        // Normal - just restart, log as debug info instead of error
        console.debug('🎤 SPEECH: No speech detected (normal during continuous listening)');
        return;
      }
      
      if (event.error === 'not-allowed') {
        this.callbacks.onError('🎤 Microphone access denied. Please allow microphone access and refresh the page.');
        return;
      }

      if (event.error === 'network') {
        console.warn('🎤 SPEECH: Network error, will retry...');
        return;
      }

      if (event.error === 'aborted') {
        console.debug('🎤 SPEECH: Recognition aborted (normal during restarts)');
        return;
      }
      
      // Log other errors as actual errors
      console.error('🎤 SPEECH: Recognition error:', event.error);
      this.callbacks.onError(`🎤 Speech recognition error: ${event.error}`);
    };

    this.recognition.onresult = (event: any) => {
      this.lastSpeechTime = Date.now();
      console.log('🎤 SPEECH: Result event received, results count:', event.results.length);
      
      let interimTranscript = '';
      let finalTranscript = '';

      // Process all results from the last result index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.toLowerCase().trim();
        
        console.log(`🎤 SPEECH: Result ${i} - isFinal: ${result.isFinal}, transcript: "${transcript}"`);
        
        if (result.isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript + ' ';
        }
      }

      const fullTranscript = (finalTranscript + interimTranscript).toLowerCase().trim();
      console.log('🎤 SPEECH: Full transcript:', `"${fullTranscript}"`);
      console.log('🎤 SPEECH: Wake word mode:', this.isWakeWordMode);

      if (this.isWakeWordMode) {
        // Check for wake word
        if (this.detectWakeWord(fullTranscript)) {
          console.log('✅ SPEECH: Wake word detected!');
          this.onWakeWordDetected();
        }
      } else {
        // In conversation mode - pass speech to callback
        const textToSend = finalTranscript.trim() || interimTranscript.trim();
        if (textToSend) {
          console.log('💬 SPEECH: Sending to callback:', `"${textToSend}"`);
          this.callbacks.onSpeechResult(textToSend, !!finalTranscript.trim());
        }
        
        // Auto-stop after silence if we have final results
        if (finalTranscript.trim()) {
          this.resetSilenceTimer();
        }
      }
    };
  }

  private detectWakeWord(transcript: string): boolean {
    const wakeWord = this.config.wakeWord.toLowerCase();
    console.log('🔍 WAKE WORD: Checking transcript:', `"${transcript}"`, 'for wake word:', `"${wakeWord}"`);
    
    // Remove extra spaces and normalize
    const normalizedTranscript = transcript.replace(/\s+/g, ' ').trim();
    const normalizedWakeWord = wakeWord.replace(/\s+/g, ' ').trim();
    
    // Check for exact phrase match
    if (normalizedTranscript.includes(normalizedWakeWord)) {
      console.log('✅ WAKE WORD: Exact match found');
      return true;
    }
    
    // Check for partial matches with more flexibility
    const transcriptWords = normalizedTranscript.split(' ');
    const wakeWords = normalizedWakeWord.split(' ');
    
    console.log('🔍 WAKE WORD: Transcript words:', transcriptWords);
    console.log('🔍 WAKE WORD: Wake words:', wakeWords);
    
    let matchCount = 0;
    let consecutiveMatches = 0;
    let maxConsecutiveMatches = 0;
    
    for (let i = 0; i < transcriptWords.length; i++) {
      const word = transcriptWords[i];
      let foundMatch = false;
      
      for (const wakeWordPart of wakeWords) {
        // Check for exact match or partial match (for "hey" vs "hay", "sensa" vs "sensor")
        if (word === wakeWordPart || 
            word.includes(wakeWordPart) || 
            wakeWordPart.includes(word) ||
            this.soundsLike(word, wakeWordPart)) {
          matchCount++;
          consecutiveMatches++;
          foundMatch = true;
          console.log(`✅ WAKE WORD: Match found - "${word}" matches "${wakeWordPart}"`);
          break;
        }
      }
      
      if (!foundMatch) {
        maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
        consecutiveMatches = 0;
      }
    }
    
    maxConsecutiveMatches = Math.max(maxConsecutiveMatches, consecutiveMatches);
    
    console.log('🔍 WAKE WORD: Match count:', matchCount, 'out of', wakeWords.length);
    console.log('🔍 WAKE WORD: Max consecutive matches:', maxConsecutiveMatches);
    console.log('🔍 WAKE WORD: Threshold:', this.config.threshold);
    
    // Require at least threshold percentage of words to match
    const matchPercentage = matchCount / wakeWords.length;
    const isMatch = matchPercentage >= this.config.threshold || maxConsecutiveMatches >= wakeWords.length;
    
    console.log('🔍 WAKE WORD: Match percentage:', matchPercentage, 'Is match:', isMatch);
    
    return isMatch;
  }

  private soundsLike(word1: string, word2: string): boolean {
    // Simple phonetic similarity check for common misrecognitions
    const phonetic = (word: string) => {
      return word
        .replace(/[aeiou]/g, '') // Remove vowels
        .replace(/[^a-z]/g, '') // Remove non-letters
        .substring(0, 3); // Take first 3 consonants
    };
    
    const p1 = phonetic(word1);
    const p2 = phonetic(word2);
    
    // Check if they start with the same sound or are very similar
    return p1.length > 0 && p2.length > 0 && (
      p1 === p2 || 
      p1.startsWith(p2) || 
      p2.startsWith(p1) ||
      (word1.startsWith('h') && word2.startsWith('h')) || // "hey" variations
      (word1.includes('sens') && word2.includes('sens')) // "sensa" variations
    );
  }

  private onWakeWordDetected() {
    console.log('🎉 WAKE WORD: Wake word detected - Hey Sensa!');
    this.isWakeWordMode = false;
    this.callbacks.onWakeWordDetected();
    
    // Continue listening for the actual command
    this.resetSilenceTimer();
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    
    // Return to wake word mode after 8 seconds of silence (increased from 5)
    this.silenceTimer = setTimeout(() => {
      if (!this.isWakeWordMode && Date.now() - this.lastSpeechTime > 6000) {
        console.log('⏰ SPEECH: Silence timeout, returning to wake word mode');
        this.returnToWakeWordMode();
      }
    }, 8000);
  }

  private returnToWakeWordMode() {
    console.log('🔄 SPEECH: Returning to wake word mode');
    this.isWakeWordMode = true;
    this.callbacks.onSpeechResult('', true); // Signal end of conversation
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.callbacks.onError('🎤 Speech recognition not available in this browser');
      return false;
    }

    if (this.isListening) {
      console.log('🎤 SPEECH: Already listening');
      return true;
    }

    try {
      console.log('🎤 SPEECH: Starting recognition...');
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('🎤 SPEECH: Failed to start recognition:', error);
      this.callbacks.onError('🎤 Failed to start voice recognition. Please check microphone permissions.');
      return false;
    }
  }

  public stopListening() {
    console.log('🎤 SPEECH: Stopping recognition...');
    
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public isInWakeWordMode(): boolean {
    return this.isWakeWordMode;
  }

  public forceWakeWordMode() {
    console.log('🔄 SPEECH: Forcing wake word mode');
    this.isWakeWordMode = true;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public destroy() {
    console.log('🎤 SPEECH: Destroying service...');
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