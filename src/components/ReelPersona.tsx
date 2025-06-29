import React, { useState, useEffect, useRef } from 'react';
import { WakeWordService } from '../lib/wake-word.service';
import { BedrockService } from '../lib/bedrock.service';
import ElevenLabsService from '../lib/elevenlabs.service';
import styles from './ReelPersona.module.css';

interface ReelPersonaProps {
  candidateId: string;
}

export const ReelPersona: React.FC<ReelPersonaProps> = ({ candidateId }) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState({ retryCount: 0, maxRetries: 3, isRetrying: false });
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');

  const wakeWordServiceRef = useRef<WakeWordService | null>(null);
  const bedrockServiceRef = useRef<BedrockService | null>(null);
  const elevenLabsServiceRef = useRef<ElevenLabsService | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    initializeServices();
    return () => {
      cleanup();
    };
  }, [candidateId]);

  const initializeServices = () => {
    try {
      setConnectionStatus('connecting');
      
      // Initialize services
      bedrockServiceRef.current = new BedrockService();
      elevenLabsServiceRef.current = new ElevenLabsService();

      // Initialize wake word service
      wakeWordServiceRef.current = new WakeWordService({
        wakeWord: 'Hey Sensa',
        onWakeWordDetected: handleWakeWordDetected,
        onError: handleWakeWordError,
        onListeningStateChange: handleListeningStateChange
      });

      setConnectionStatus('connected');
      setError(null);
    } catch (err) {
      console.error('Failed to initialize services:', err);
      setError('Failed to initialize speech services. Please refresh the page.');
      setConnectionStatus('error');
    }
  };

  const handleWakeWordDetected = () => {
    console.log('Wake word detected!');
    setError(null);
    startListening();
  };

  const handleWakeWordError = (errorMessage: string) => {
    console.error('Wake word error:', errorMessage);
    setError(errorMessage);
    setConnectionStatus('error');
    
    // Update retry info
    if (wakeWordServiceRef.current) {
      setRetryInfo(wakeWordServiceRef.current.getRetryInfo());
    }
  };

  const handleListeningStateChange = (listening: boolean) => {
    setIsListening(listening);
    if (listening) {
      setConnectionStatus('connected');
      setError(null);
    }
    
    // Update retry info
    if (wakeWordServiceRef.current) {
      setRetryInfo(wakeWordServiceRef.current.getRetryInfo());
    }
  };

  const startWakeWordDetection = () => {
    if (!wakeWordServiceRef.current) {
      setError('Wake word service not initialized. Please refresh the page.');
      return;
    }

    setConnectionStatus('connecting');
    const success = wakeWordServiceRef.current.start();
    if (!success) {
      setConnectionStatus('error');
    }
  };

  const stopWakeWordDetection = () => {
    if (wakeWordServiceRef.current) {
      wakeWordServiceRef.current.stop();
    }
    setConnectionStatus('disconnected');
    setError(null);
    setRetryInfo({ retryCount: 0, maxRetries: 3, isRetrying: false });
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsProcessing(true);
        setTranscript('');
        setError(null);
      };

      recognitionRef.current.onresult = (event) => {
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

        setTranscript(finalTranscript || interimTranscript);

        if (finalTranscript) {
          processUserInput(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsProcessing(false);
        
        let errorMessage = 'Speech recognition failed';
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error during speech recognition. Please check your connection.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try speaking again.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        setError(errorMessage);
      };

      recognitionRef.current.onend = () => {
        setIsProcessing(false);
      };

      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Failed to start speech recognition. Please try again.');
      setIsProcessing(false);
    }
  };

  const processUserInput = async (input: string) => {
    if (!bedrockServiceRef.current || !elevenLabsServiceRef.current) {
      setError('Services not initialized. Please refresh the page.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Generate response using Bedrock
      const aiResponse = await bedrockServiceRef.current.generateResponse(input, candidateId);
      setResponse(aiResponse);

      // Convert to speech using ElevenLabs
      const audioBlob = await elevenLabsServiceRef.current.textToSpeech(aiResponse);
      
      // Play the audio
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(audioUrl);
      
      audioRef.current.onplay = () => setIsPlaying(true);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = () => {
        setError('Failed to play audio response');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audioRef.current.play();
    } catch (err) {
      console.error('Error processing user input:', err);
      setError('Failed to process your request. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanup = () => {
    if (wakeWordServiceRef.current) {
      wakeWordServiceRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    if (retryInfo.isRetrying) {
      return `Reconnecting... (${retryInfo.retryCount}/${retryInfo.maxRetries})`;
    }
    
    switch (connectionStatus) {
      case 'connected': return isListening ? 'Listening for "Hey Sensa"' : 'Ready';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Reel Persona</h2>
        <div className={styles.status}>
          <div 
            className={styles.statusIndicator} 
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className={styles.statusText}>{getStatusText()}</span>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          onClick={startWakeWordDetection}
          disabled={isListening || connectionStatus === 'connecting'}
          className={`${styles.button} ${styles.primaryButton}`}
        >
          {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Listening'}
        </button>
        
        <button
          onClick={stopWakeWordDetection}
          disabled={!isListening && connectionStatus === 'disconnected'}
          className={`${styles.button} ${styles.secondaryButton}`}
        >
          Stop Listening
        </button>

        <button
          onClick={startListening}
          disabled={isProcessing || isPlaying}
          className={`${styles.button} ${styles.primaryButton}`}
        >
          Manual Input
        </button>
      </div>

      {error && (
        <div className={styles.errorContainer}>
          <div className={styles.error}>
            <strong>Error:</strong> {error}
            {error.includes('Network') && (
              <div className={styles.errorHelp}>
                <p>Try these solutions:</p>
                <ul>
                  <li>Check your internet connection</li>
                  <li>Refresh the page</li>
                  <li>Try a different browser (Chrome or Edge recommended)</li>
                  <li>Disable VPN/proxy if enabled</li>
                </ul>
              </div>
            )}
            {error.includes('Microphone') && (
              <div className={styles.errorHelp}>
                <p>To fix microphone issues:</p>
                <ul>
                  <li>Click the microphone icon in your browser's address bar</li>
                  <li>Select "Allow" for microphone access</li>
                  <li>Refresh the page after granting permission</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {retryInfo.isRetrying && (
        <div className={styles.retryInfo}>
          <div className={styles.retryIndicator}>
            <div className={styles.spinner}></div>
            <span>Attempting to reconnect... ({retryInfo.retryCount}/{retryInfo.maxRetries})</span>
          </div>
        </div>
      )}

      <div className={styles.content}>
        {isProcessing && (
          <div className={styles.processing}>
            <div className={styles.spinner}></div>
            <span>Processing...</span>
          </div>
        )}

        {isPlaying && (
          <div className={styles.playing}>
            <div className={styles.audioWave}></div>
            <span>Playing response...</span>
          </div>
        )}

        {transcript && (
          <div className={styles.transcript}>
            <h3>You said:</h3>
            <p>"{transcript}"</p>
          </div>
        )}

        {response && (
          <div className={styles.response}>
            <h3>Sensa responds:</h3>
            <p>{response}</p>
          </div>
        )}
      </div>
    </div>
  );
};