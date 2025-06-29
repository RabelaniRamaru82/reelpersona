import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  MessageCircle, 
  Mic, 
  Send, 
  Shield, 
  Users, 
  Clock, 
  CheckCircle, 
  Lock,
  User,
  Briefcase,
  Target,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Award,
  ExternalLink,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Sparkles,
  Settings,
  AlertTriangle,
  Loader,
  MicIcon
} from 'lucide-react';
import { 
  generateAIResponse, 
  generatePersonalityAnalysis, 
  type ConversationContext, 
  type CandidatePersonaProfile,
  type AIResponse 
} from '../lib/bedrock.service';
import { 
  initializeElevenLabs, 
  getElevenLabsService, 
  type ElevenLabsVoice,
  type VoiceSettings as ElevenLabsVoiceSettings
} from '../lib/elevenlabs.service';
import {
  initializeWakeWordService,
  getWakeWordService,
  type WakeWordConfig,
  type WakeWordCallbacks
} from '../lib/wake-word.service';
import { type ConflictStyle } from '../lib/simulation';
import styles from './ReelPersona.module.css';

// Types
interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
  options?: string[];
  expectsInput?: 'text' | 'choice';
  metadata?: any;
  simulationData?: {
    openingScene: string;
    prompt: string;
    choices: { text: string; style: ConflictStyle }[];
  };
}

interface UserProfile {
  firstName: string;
  lastName: string;
  currentRole: string;
  company: string;
  industry: string;
  whyStatement?: string;
  howValues?: string[];
  answers: Record<string, any>;
}

interface VoiceSettings {
  enabled: boolean;
  autoPlay: boolean;
  voiceId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  wakeWordEnabled: boolean;
}

const ReelPersona: React.FC = () => {
  // State management
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false);
  const [currentStep, setCurrentStep] = useState<'welcome' | 'chat' | 'results'>('welcome');
  const [userProfile, setUserProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    currentRole: '',
    company: '',
    industry: '',
    answers: {}
  });
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    stage: 'intro',
    userProfile: {
      answers: {}
    },
    conversationHistory: []
  });
  const [results, setResults] = useState<CandidatePersonaProfile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [justCause, setJustCause] = useState("To empower individuals and organizations to discover and live their purpose");
  
  // ElevenLabs voice state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoPlay: true,
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni - deep, calming voice
    stability: 0.75,
    similarityBoost: 0.75,
    style: 0.5,
    useSpeakerBoost: true,
    wakeWordEnabled: true
  });
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [elevenLabsInitialized, setElevenLabsInitialized] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [wakeWordStatus, setWakeWordStatus] = useState<string>('');
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const pendingSpeechRef = useRef<string>('');

  // Initialize ElevenLabs
  useEffect(() => {
    const initVoiceService = async () => {
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      
      if (!apiKey) {
        setVoiceError('ElevenLabs API key not found. Please add VITE_ELEVENLABS_API_KEY to your .env file.');
        return;
      }

      try {
        const service = initializeElevenLabs(apiKey);
        const voices = await service.getVoices();
        setAvailableVoices(voices);
        setElevenLabsInitialized(true);
        setVoiceError(null);
      } catch (error) {
        console.error('Failed to initialize ElevenLabs:', error);
        setVoiceError('Failed to connect to ElevenLabs. Please check your API key.');
      }
    };

    initVoiceService();
  }, []);

  // Initialize wake word detection
  useEffect(() => {
    if (!voiceSettings.wakeWordEnabled) return;

    const wakeWordConfig: WakeWordConfig = {
      wakeWord: 'hey sensa',
      threshold: 0.7,
      continuous: true,
      language: 'en-US'
    };

    const callbacks: WakeWordCallbacks = {
      onWakeWordDetected: () => {
        console.log('Hey Sensa detected!');
        setIsInConversation(true);
        setWakeWordStatus('Listening... Say your message');
        
        // Provide audio feedback
        if (elevenLabsInitialized && voiceSettings.enabled) {
          speakText("Yes, I'm listening. How can I help you?");
        }
      },
      
      onListening: (listening) => {
        setIsListening(listening);
        if (listening && !isInConversation) {
          setWakeWordStatus('Listening for "Hey Sensa"...');
        }
      },
      
      onError: (error) => {
        console.error('Wake word error:', error);
        setVoiceError(error);
        setWakeWordStatus('Voice recognition error');
      },
      
      onSpeechResult: (transcript, isFinal) => {
        if (isInConversation && transcript.trim()) {
          if (isFinal) {
            // Process the speech input
            if (transcript.trim()) {
              setChatInput(transcript);
              processUserInput(transcript.trim());
              setIsInConversation(false);
              setWakeWordStatus('');
            }
          } else {
            // Show interim results
            pendingSpeechRef.current = transcript;
            setChatInput(transcript);
          }
        } else if (isFinal && isInConversation) {
          // Return to wake word mode
          setIsInConversation(false);
          setWakeWordStatus('');
        }
      }
    };

    const service = initializeWakeWordService(wakeWordConfig, callbacks);
    
    return () => {
      service?.destroy();
    };
  }, [voiceSettings.wakeWordEnabled, elevenLabsInitialized, voiceSettings.enabled]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Initialize conversation when starting chat
  useEffect(() => {
    if (currentStep === 'chat' && chatMessages.length === 0) {
      startConversation();
    }
  }, [currentStep]);

  // Start wake word detection when chat starts
  useEffect(() => {
    if (currentStep === 'chat' && voiceSettings.wakeWordEnabled) {
      const service = getWakeWordService();
      if (service) {
        service.startListening();
        setWakeWordStatus('Say "Hey Sensa" to start talking');
      }
    }
  }, [currentStep, voiceSettings.wakeWordEnabled]);

  // ElevenLabs voice functions
  const speakText = async (text: string, messageId?: string) => {
    if (!voiceSettings.enabled || !elevenLabsInitialized) return;

    try {
      setIsVoiceLoading(true);
      setIsSpeaking(true);
      
      if (messageId) {
        setChatMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isPlaying: true } : { ...msg, isPlaying: false }
        ));
      }

      const service = getElevenLabsService();
      
      const elevenLabsSettings: ElevenLabsVoiceSettings = {
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarityBoost,
        style: voiceSettings.style,
        use_speaker_boost: voiceSettings.useSpeakerBoost
      };

      const audioBuffer = await service.generateSpeech(text, voiceSettings.voiceId, elevenLabsSettings);
      setIsVoiceLoading(false);
      
      await service.playAudio(audioBuffer);
      
      setIsSpeaking(false);
      setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      
    } catch (error) {
      console.error('Error speaking text:', error);
      setIsVoiceLoading(false);
      setIsSpeaking(false);
      setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      setVoiceError('Failed to generate speech. Please try again.');
    }
  };

  const stopSpeech = () => {
    if (elevenLabsInitialized) {
      const service = getElevenLabsService();
      service.stopAudio();
    }
    setIsSpeaking(false);
    setIsVoiceLoading(false);
    setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
  };

  const toggleVoice = () => {
    setVoiceSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    if (isSpeaking) {
      stopSpeech();
    }
  };

  const toggleAutoPlay = () => {
    setVoiceSettings(prev => ({ ...prev, autoPlay: !prev.autoPlay }));
  };

  const toggleWakeWord = () => {
    setVoiceSettings(prev => ({ ...prev, wakeWordEnabled: !prev.wakeWordEnabled }));
    
    const service = getWakeWordService();
    if (service) {
      if (!voiceSettings.wakeWordEnabled) {
        service.startListening();
        setWakeWordStatus('Say "Hey Sensa" to start talking');
      } else {
        service.stopListening();
        setWakeWordStatus('');
        setIsInConversation(false);
      }
    }
  };

  const updateVoiceSettings = (updates: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...updates }));
  };

  const testVoice = async (voiceId: string) => {
    if (!elevenLabsInitialized) return;
    
    try {
      setIsVoiceLoading(true);
      const service = getElevenLabsService();
      
      const elevenLabsSettings: ElevenLabsVoiceSettings = {
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarityBoost,
        style: voiceSettings.style,
        use_speaker_boost: voiceSettings.useSpeakerBoost
      };
      
      await service.testVoice(voiceId, elevenLabsSettings);
      setIsVoiceLoading(false);
    } catch (error) {
      console.error('Error testing voice:', error);
      setIsVoiceLoading(false);
      setVoiceError('Failed to test voice. Please try again.');
    }
  };

  // Get recommended voices for Sensa
  const getRecommendedVoices = () => {
    if (!elevenLabsInitialized) return [];
    
    const service = getElevenLabsService();
    const recommended = service.getRecommendedVoicesForSensa();
    
    return recommended.filter(rec => 
      availableVoices.some(voice => voice.voice_id === rec.voice_id)
    );
  };

  // Conversation management
  const addMessage = (content: string, type: 'user' | 'ai' | 'system', options?: string[], expectsInput?: any, metadata?: any, simulationData?: any) => {
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date(),
      options,
      expectsInput,
      metadata,
      simulationData
    };

    setChatMessages(prev => [...prev, message]);

    // Auto-speak AI messages with Sensa's ElevenLabs voice
    if (type === 'ai' && voiceSettings.enabled && voiceSettings.autoPlay && elevenLabsInitialized) {
      setTimeout(() => speakText(content, message.id), 300);
    }

    return message;
  };

  const startConversation = () => {
    addMessage(
      "Hello. I'm Sensa, your AI personality analyst. I specialize in helping professionals discover their deeper motivations using the proven Golden Circle framework. Through our conversation, I'll uncover your WHY, your HOW, and your WHAT, creating a comprehensive understanding of your professional persona. We may also explore how you handle workplace challenges through realistic scenarios. You can type your responses or simply say 'Hey Sensa' followed by your message to talk naturally with me. Take a moment to get comfortable, and when you're ready, shall we begin this journey of discovery?",
      'ai',
      ['Yes, I\'m ready to begin', 'Tell me more about the process first']
    );
    
    setConversationContext(prev => ({
      ...prev,
      stage: 'intro'
    }));
  };

  const processUserInput = async (input: string, isChoice: boolean = false, choiceIndex?: number, conflictStyle?: ConflictStyle) => {
    // Clear any pending speech
    pendingSpeechRef.current = '';
    setChatInput('');
    
    // Add user message
    addMessage(input, 'user');

    // Update conversation history
    const newHistory = [
      ...conversationContext.conversationHistory,
      { role: 'user' as const, content: input }
    ];

    setIsTyping(true);

    try {
      // For simulation choices, pass the conflict style
      const inputToProcess = conflictStyle || input;
      
      // Generate AI response using Bedrock
      const aiResponse = await generateAIResponse(inputToProcess, {
        ...conversationContext,
        conversationHistory: newHistory
      }, justCause);

      setIsTyping(false);

      // Handle simulation response
      if (aiResponse.simulationData) {
        addMessage(
          aiResponse.content,
          'ai',
          undefined,
          'choice',
          undefined,
          aiResponse.simulationData
        );
      } else {
        // Add regular AI response
        addMessage(
          aiResponse.content,
          'ai',
          aiResponse.options,
          aiResponse.expectsInput
        );
      }

      // Update conversation context
      const updatedHistory = [
        ...newHistory,
        { role: 'assistant' as const, content: aiResponse.content }
      ];

      // Update user profile based on stage
      let updatedProfile = { ...conversationContext.userProfile };
      
      if (conversationContext.stage === 'name') {
        updatedProfile.firstName = input;
        setUserProfile(prev => ({ ...prev, firstName: input }));
      }

      setConversationContext({
        stage: aiResponse.stage || conversationContext.stage,
        userProfile: updatedProfile,
        conversationHistory: updatedHistory,
        simulation: conversationContext.simulation
      });

      // Check if analysis is complete
      if (aiResponse.stage === 'analysis_complete' || updatedHistory.length >= 20) {
        setTimeout(() => {
          generateAnalysis();
        }, 2000);
      }

    } catch (error) {
      setIsTyping(false);
      console.error('Error processing input:', error);
      addMessage(
        "I apologize for the technical difficulty. Let me continue our conversation. Could you tell me more about what drives you in your professional life?",
        'ai',
        undefined,
        'text'
      );
    }
  };

  const generateAnalysis = async () => {
    setIsAnalyzing(true);
    
    addMessage(
      "Thank you for this wonderful conversation. I'm now analyzing everything we've discussed to generate your comprehensive Candidate Persona Profile using the Golden Circle framework. This analysis will take just a moment...",
      'system'
    );

    try {
      const analysis = await generatePersonalityAnalysis(conversationContext, justCause);
      setResults(analysis);
      setCurrentStep('results');

      // Auto-speak results with Sensa's ElevenLabs voice
      if (voiceSettings.enabled && voiceSettings.autoPlay && elevenLabsInitialized) {
        setTimeout(() => {
          speakText(`Your personality analysis is complete, ${userProfile.firstName}. ${analysis.alignmentSummary}`);
        }, 1000);
      }
    } catch (error) {
      console.error('Error generating analysis:', error);
      addMessage(
        "I encountered an issue generating your full analysis, but I can provide some initial insights based on our conversation. Let me prepare a summary for you.",
        'ai'
      );
      
      // Fallback analysis
      const fallbackAnalysis: CandidatePersonaProfile = {
        statedWhy: "Dedicated to making meaningful contributions through collaborative work",
        observedHow: ["Collaboration", "Integrity", "Continuous Learning"],
        coherenceScore: "Medium",
        trustIndex: "Medium-Trust",
        dominantConflictStyle: "Collaborate",
        eqSnapshot: {
          selfAwareness: "Demonstrates good self-reflection and awareness of personal motivations",
          selfManagement: "Shows ability to regulate emotions and adapt to changing circumstances",
          socialAwareness: "Displays empathy and understanding of others' perspectives",
          relationshipManagement: "Exhibits collaborative approach to working with others"
        },
        keyQuotationsAndBehavioralFlags: {
          greenFlags: ["Engaged thoughtfully throughout the assessment", "Showed genuine interest in self-discovery"],
          redFlags: ["Limited data due to technical issues"]
        },
        alignmentSummary: `${userProfile.firstName} demonstrates strong collaborative instincts and genuine engagement in professional development conversations. Shows good potential for team-based roles with proper development support.`
      };
      
      setResults(fallbackAnalysis);
      setCurrentStep('results');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    processUserInput(chatInput.trim());
  };

  const handleOptionClick = (option: string, index: number) => {
    processUserInput(option, true, index);
  };

  const handleSimulationChoice = (choice: { text: string; style: ConflictStyle }, index: number) => {
    processUserInput(choice.text, true, index, choice.style);
  };

  const renderVoiceControls = () => (
    <div className={styles.voiceControls}>
      <button
        className={`${styles.voiceToggle} ${voiceSettings.enabled ? styles.enabled : styles.disabled}`}
        onClick={toggleVoice}
        title={voiceSettings.enabled ? 'Disable Sensa\'s voice' : 'Enable Sensa\'s voice'}
        disabled={!elevenLabsInitialized}
      >
        {voiceSettings.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      
      {voiceSettings.enabled && elevenLabsInitialized && (
        <>
          <button
            className={`${styles.autoPlayToggle} ${voiceSettings.autoPlay ? styles.enabled : styles.disabled}`}
            onClick={toggleAutoPlay}
            title={voiceSettings.autoPlay ? 'Disable auto-play' : 'Enable auto-play'}
          >
            {voiceSettings.autoPlay ? 'Auto' : 'Manual'}
          </button>

          <button
            className={`${styles.wakeWordToggle} ${voiceSettings.wakeWordEnabled ? styles.enabled : styles.disabled}`}
            onClick={toggleWakeWord}
            title={voiceSettings.wakeWordEnabled ? 'Disable "Hey Sensa"' : 'Enable "Hey Sensa"'}
          >
            {voiceSettings.wakeWordEnabled ? 'Hey' : 'Off'}
          </button>
          
          <button
            className={styles.voiceSettingsButton}
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            title="Voice settings"
          >
            <Settings size={16} />
          </button>
        </>
      )}
      
      {voiceError && (
        <div className={styles.voiceError} title={voiceError}>
          <AlertTriangle size={16} />
        </div>
      )}
      
      {showVoiceSettings && voiceSettings.enabled && elevenLabsInitialized && (
        <div className={styles.voiceSettingsPanel}>
          <div className={styles.voiceSettingsHeader}>
            <h4>Sensa's Voice & Wake Word</h4>
            <button 
              className={styles.closeSettings}
              onClick={() => setShowVoiceSettings(false)}
            >
              ×
            </button>
          </div>
          
          <div className={styles.voiceOption}>
            <label>
              <input
                type="checkbox"
                checked={voiceSettings.wakeWordEnabled}
                onChange={toggleWakeWord}
              />
              Enable "Hey Sensa" wake word
            </label>
            <p className={styles.wakeWordHelp}>
              Say "Hey Sensa" followed by your message to talk naturally
            </p>
          </div>
          
          <div className={styles.voiceOption}>
            <label>Voice Selection:</label>
            <select
              className={styles.voiceSelect}
              value={voiceSettings.voiceId}
              onChange={(e) => updateVoiceSettings({ voiceId: e.target.value })}
            >
              <optgroup label="🎯 Recommended for Sensa">
                {getRecommendedVoices().map(voice => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} - {voice.description}
                  </option>
                ))}
              </optgroup>
              <optgroup label="📱 All Available Voices">
                {availableVoices.map(voice => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} ({voice.category})
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              className={styles.testVoiceButton}
              onClick={() => testVoice(voiceSettings.voiceId)}
              disabled={isVoiceLoading || isSpeaking}
            >
              {isVoiceLoading ? <Loader size={12} className="animate-spin" /> : 'Test Voice'}
            </button>
          </div>
          
          <div className={styles.voiceOption}>
            <label>Stability: {voiceSettings.stability.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceSettings.stability}
              onChange={(e) => updateVoiceSettings({ stability: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceOption}>
            <label>Similarity Boost: {voiceSettings.similarityBoost.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceSettings.similarityBoost}
              onChange={(e) => updateVoiceSettings({ similarityBoost: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceOption}>
            <label>Style: {voiceSettings.style.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={voiceSettings.style}
              onChange={(e) => updateVoiceSettings({ style: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceOption}>
            <label>
              <input
                type="checkbox"
                checked={voiceSettings.useSpeakerBoost}
                onChange={(e) => updateVoiceSettings({ useSpeakerBoost: e.target.checked })}
              />
              Speaker Boost (Enhanced clarity)
            </label>
          </div>
          
          <div className={styles.voiceQualityInfo}>
            <p><strong>🎙️ Hey Sensa Features:</strong></p>
            <ul>
              <li>🗣️ Say "Hey Sensa" to start talking</li>
              <li>🎯 Natural conversation flow</li>
              <li>🔊 Ultra-realistic AI voice</li>
              <li>⚡ Real-time speech recognition</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );

  const renderWelcome = () => (
    <div className={styles.welcome}>
      <div className={styles.welcomeHeader}>
        <div className={styles.welcomeIcon}>
          <Sparkles size={48} />
        </div>
        <h1>Welcome to ReelPersona</h1>
        <p className={styles.welcomeSubtitle}>Professional AI Personality Assessment with Sensa</p>
      </div>

      <div className={styles.welcomeContent}>
        <div className={styles.welcomeMessage}>
          <h2>Meet Sensa - Your AI Personality Analyst</h2>
          <p>
            Experience the future of personality assessment with Sensa, powered by ElevenLabs' 
            ultra-realistic voice technology. Simply say <strong>"Hey Sensa"</strong> followed by your message 
            to have natural voice conversations, just like talking to Siri or Alexa.
          </p>
          <p>
            🎯 <strong>Purpose-Driven:</strong> Discover your professional WHY<br/>
            🤝 <strong>Trust-Focused:</strong> Assess collaboration and leadership potential<br/>
            🧠 <strong>Science-Based:</strong> Built on proven psychological frameworks<br/>
            🗣️ <strong>"Hey Sensa":</strong> Natural voice conversations like Siri
          </p>
        </div>

        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}>
            <Brain size={24} />
            <div>
              <h3>Golden Circle Framework</h3>
              <p>Uncover your WHY, HOW, and WHAT through structured inquiry</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Users size={24} />
            <div>
              <h3>Trust Assessment</h3>
              <p>Evaluate collaboration, accountability, and emotional intelligence</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <AlertTriangle size={24} />
            <div>
              <h3>Conflict Simulation</h3>
              <p>Test decision-making through realistic workplace scenarios</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <MicIcon size={24} />
            <div>
              <h3>"Hey Sensa" Voice Control</h3>
              <p>Natural voice conversations with wake word detection</p>
            </div>
          </div>
        </div>

        {voiceError && (
          <div className={styles.voiceErrorMessage}>
            <AlertTriangle size={20} />
            <p>{voiceError}</p>
          </div>
        )}

        <button 
          className={styles.primaryButton}
          onClick={() => setCurrentStep('chat')}
        >
          <MessageCircle size={20} />
          Begin Assessment with Sensa
        </button>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className={styles.chat}>
      <div className={styles.chatContent}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderContent}>
            <div className={styles.chatHeaderInfo}>
              <h2><Brain size={24} />Sensa - AI Personality Analyst</h2>
              <p>Say "Hey Sensa" to start talking naturally</p>
              {wakeWordStatus && (
                <div className={styles.wakeWordStatus}>
                  <MicIcon size={16} className={isListening ? styles.listening : ''} />
                  <span>{wakeWordStatus}</span>
                </div>
              )}
            </div>
            {renderVoiceControls()}
          </div>
        </div>

        <div className={styles.chatMessages} ref={chatMessagesRef}>
          {chatMessages.map((message) => (
            <div key={message.id} className={`${styles.chatMessage} ${styles[message.type + 'Message']}`}>
              <div className={styles.messageContent}>
                <div className={styles.messageText}>
                  <p>{message.content}</p>
                  <div className={styles.messageTime}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {message.type === 'ai' && voiceSettings.enabled && elevenLabsInitialized && (
                  <div className={styles.messageActions}>
                    {message.isPlaying ? (
                      <button
                        className={styles.speechButton}
                        onClick={stopSpeech}
                        title="Stop Sensa's voice"
                      >
                        <Pause size={14} />
                      </button>
                    ) : isVoiceLoading ? (
                      <button
                        className={styles.speechButton}
                        disabled
                        title="Loading voice..."
                      >
                        <Loader size={14} className="animate-spin" />
                      </button>
                    ) : (
                      <button
                        className={styles.speechButton}
                        onClick={() => speakText(message.content, message.id)}
                        title="Hear Sensa speak this message"
                        disabled={isSpeaking}
                      >
                        <Play size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Regular options */}
              {message.options && !message.simulationData && (
                <div className={styles.messageOptions}>
                  {message.options.map((option, index) => (
                    <button
                      key={index}
                      className={styles.optionButton}
                      onClick={() => handleOptionClick(option, index)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {/* Simulation scenario */}
              {message.simulationData && (
                <div className={styles.simulationContainer}>
                  <div className={styles.simulationHeader}>
                    <AlertTriangle size={20} />
                    <h4>Workplace Scenario</h4>
                  </div>
                  <div className={styles.simulationScene}>
                    <p><strong>Situation:</strong> {message.simulationData.openingScene}</p>
                    <p><strong>{message.simulationData.prompt}</strong></p>
                  </div>
                  <div className={styles.simulationChoices}>
                    {message.simulationData.choices.map((choice, index) => (
                      <button
                        key={index}
                        className={styles.simulationChoice}
                        onClick={() => handleSimulationChoice(choice, index)}
                      >
                        <span className={styles.choiceText}>{choice.text}</span>
                        <span className={styles.choiceStyle}>({choice.style})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {(isTyping || isAnalyzing) && (
            <div className={`${styles.chatMessage} ${styles.aiMessage}`}>
              <div className={`${styles.messageContent} ${styles.typingMessage}`}>
                <div className={styles.messageText}>
                  <p>{isAnalyzing ? 'Sensa is generating comprehensive analysis' : 'Sensa is thinking'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <form className={styles.chatForm} onSubmit={handleChatSubmit}>
          <div className={styles.inputContainer}>
            <input
              type="text"
              className={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isInConversation ? "Listening... speak your message" : 'Type here or say "Hey Sensa" to talk...'}
              disabled={isTyping || isAnalyzing || isInConversation}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!chatInput.trim() || isTyping || isAnalyzing || isInConversation}
            >
              {isTyping || isAnalyzing ? (
                <div className={styles.spinner} />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          
          {voiceSettings.wakeWordEnabled && (
            <div className={styles.voiceHint}>
              <MicIcon size={16} className={isListening ? styles.listening : ''} />
              <span>Say "Hey Sensa" to start voice conversation</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className={styles.results}>
        <div className={styles.resultsContent}>
          <div className={styles.resultsHeader}>
            <h2>Candidate Persona Profile</h2>
            {voiceSettings.enabled && elevenLabsInitialized && (
              <button
                className={styles.speakResultsButton}
                onClick={() => speakText(`Here's your comprehensive personality analysis. ${results.alignmentSummary}`)}
                disabled={isSpeaking || isVoiceLoading}
                title="Listen to Sensa's results summary"
              >
                {isSpeaking || isVoiceLoading ? <Loader size={20} className="animate-spin" /> : <Volume2 size={20} />}
                {isSpeaking || isVoiceLoading ? 'Loading...' : 'Listen to Sensa'}
              </button>
            )}
          </div>

          <div className={styles.saveStatus}>
            <CheckCircle className={styles.saveStatusIcon} size={20} />
            <div className={styles.saveStatusText}>
              <strong>Analysis Complete!</strong>
              <br />Professional personality assessment by Sensa with voice interaction.
            </div>
          </div>

          <div className={styles.summarySection}>
            <h3>Core Purpose & Values</h3>
            <p><strong>Stated WHY:</strong> {results.statedWhy}</p>
            <p><strong>Observed HOW:</strong> {results.observedHow.join(', ')}</p>
            <p><strong>Coherence Score:</strong> {results.coherenceScore}</p>
            <p><strong>Trust Index:</strong> {results.trustIndex}</p>
            <p><strong>Dominant Conflict Style:</strong> {results.dominantConflictStyle}</p>
          </div>

          <div className={styles.traitsSection}>
            <h3>Emotional Intelligence Assessment</h3>
            <div className={styles.traits}>
              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Self-Awareness</span>
                </div>
                <div className={styles.traitLabel}>{results.eqSnapshot.selfAwareness}</div>
              </div>
              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Self-Management</span>
                </div>
                <div className={styles.traitLabel}>{results.eqSnapshot.selfManagement}</div>
              </div>
              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Social Awareness</span>
                </div>
                <div className={styles.traitLabel}>{results.eqSnapshot.socialAwareness}</div>
              </div>
              <div className={styles.trait}>
                <div className={styles.traitHeader}>
                  <span className={styles.traitName}>Relationship Management</span>
                </div>
                <div className={styles.traitLabel}>{results.eqSnapshot.relationshipManagement}</div>
              </div>
            </div>
          </div>

          <div className={styles.insightsSection}>
            <div className={styles.strengths}>
              <h3><TrendingUp size={20} />Green Flags</h3>
              <ul>
                {results.keyQuotationsAndBehavioralFlags.greenFlags.map((flag, index) => (
                  <li key={index}>{flag}</li>
                ))}
              </ul>
            </div>

            {results.keyQuotationsAndBehavioralFlags.redFlags.length > 0 && (
              <div className={styles.growthAreas}>
                <h3><Target size={20} />Red Flags</h3>
                <ul>
                  {results.keyQuotationsAndBehavioralFlags.redFlags.map((flag, index) => (
                    <li key={index}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className={styles.integrationSection}>
            <h3><Award size={24} />Organizational Alignment</h3>
            <p>{results.alignmentSummary}</p>
            
            <div className={styles.actionButtons}>
              <button className={styles.primaryButton}>
                <ExternalLink size={20} />
                View Full Portfolio
              </button>
              <button className={styles.secondaryButton}>
                Download Report
              </button>
              <button className={styles.tertiaryButton}>
                Schedule Follow-up
              </button>
            </div>

            <div className={styles.integrationNote}>
              <p><strong>Assessment Framework:</strong> This analysis was conducted by Sensa using Simon Sinek's Golden Circle methodology with voice interaction capabilities.</p>
              <p><strong>Just Cause Alignment:</strong> Evaluated against the organization's purpose: "{justCause}"</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.reelPersona}>
      <div className="reelapps-card">
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.logo}>ReelPersona</div>
            {currentStep === 'chat' && (
              <div className={styles.progressIndicator}>
                <div 
                  className={styles.progressFill} 
                  style={{ 
                    width: `${Math.min(100, (conversationContext.conversationHistory.length / 20) * 100)}%`
                  }} 
                />
              </div>
            )}
          </div>
        </div>

        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'chat' && renderChat()}
        {currentStep === 'results' && renderResults()}
      </div>
    </div>
  );
};

export default ReelPersona;