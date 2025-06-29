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
  AlertTriangle
} from 'lucide-react';
import { 
  generateAIResponse, 
  generatePersonalityAnalysis, 
  type ConversationContext, 
  type CandidatePersonaProfile,
  type AIResponse 
} from '../lib/bedrock.service';
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
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
}

// Enhanced voice quality scoring system with preference for deeper, calmer voices
const getVoiceQuality = (voice: SpeechSynthesisVoice): number => {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  
  // Prefer English voices
  if (lang.startsWith('en-')) score += 10;
  
  // High-quality voice indicators
  if (name.includes('neural') || name.includes('premium') || name.includes('enhanced')) score += 20;
  if (name.includes('natural') || name.includes('human')) score += 15;
  
  // Prefer deeper, more calming voices for Sensa
  if (name.includes('alex') || name.includes('daniel') || name.includes('david')) score += 18;
  if (name.includes('samantha') || name.includes('victoria') || name.includes('aria')) score += 15;
  if (name.includes('zira') || name.includes('hazel')) score += 12;
  
  // Bonus for voices that sound professional and calming
  if (name.includes('professional') || name.includes('calm') || name.includes('deep')) score += 15;
  
  // Avoid robotic/synthetic sounding voices
  if (name.includes('robot') || name.includes('synthetic') || name.includes('computer')) score -= 10;
  if (name.includes('microsoft') && !name.includes('neural')) score -= 5;
  
  // Prefer local voices (usually higher quality)
  if (voice.localService) score += 5;
  
  return score;
};

const ReelPersona: React.FC = () => {
  // State management
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
  
  // Voice-related state - optimized for Sensa's deep, calming voice
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoPlay: true,
    rate: 0.75, // Slower for more calming effect
    pitch: 0.8, // Lower pitch for deeper voice
    voice: null
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [qualityVoices, setQualityVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        setIsListening(false);
      };

      recognition.current.onerror = () => {
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Enhanced speech synthesis initialization with preference for deeper voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        // Filter and rank voices by quality, preferring deeper voices for Sensa
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        const rankedVoices = englishVoices
          .map(voice => ({ voice, quality: getVoiceQuality(voice) }))
          .sort((a, b) => b.quality - a.quality)
          .map(item => item.voice);
        
        setQualityVoices(rankedVoices);
        
        // Select the best available voice for Sensa's calming persona
        const bestVoice = rankedVoices[0];
        
        if (bestVoice && !voiceSettings.voice) {
          setVoiceSettings(prev => ({ ...prev, voice: bestVoice }));
        }
      };

      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
      
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.speak(new SpeechSynthesisUtterance(''));
        setTimeout(loadVoices, 100);
      }
    }
  }, []);

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

  // Enhanced voice synthesis functions optimized for Sensa's calming delivery
  const speakText = (text: string, messageId?: string) => {
    if (!voiceSettings.enabled || !('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Optimized settings for Sensa's deep, calming voice
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = 0.9;
    
    if (voiceSettings.voice) {
      utterance.voice = voiceSettings.voice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentSpeech(utterance);
      if (messageId) {
        setChatMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, isPlaying: true } : { ...msg, isPlaying: false }
        ));
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeech(null);
      setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentSpeech(null);
      setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
    };

    speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentSpeech(null);
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

  const updateVoiceSettings = (updates: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...updates }));
  };

  const testVoice = (voice: SpeechSynthesisVoice) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello. I'm Sensa, your AI personality analyst. My voice is designed to be calming and professional as we explore your deeper motivations together.");
    utterance.voice = voice;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = 0.9;
    speechSynthesis.speak(utterance);
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

    // Auto-speak AI messages with Sensa's calming voice
    if (type === 'ai' && voiceSettings.enabled && voiceSettings.autoPlay) {
      setTimeout(() => speakText(content, message.id), 300);
    }

    return message;
  };

  const startConversation = () => {
    addMessage(
      "Hello. I'm Sensa, your AI personality analyst. I specialize in helping professionals discover their deeper motivations using the proven Golden Circle framework. Through our conversation, I'll uncover your WHY, your HOW, and your WHAT, creating a comprehensive understanding of your professional persona. We may also explore how you handle workplace challenges through realistic scenarios. Take a moment to get comfortable, and when you're ready, shall we begin this journey of discovery?",
      'ai',
      ['Yes, I\'m ready to begin', 'Tell me more about the process first']
    );
    
    setConversationContext(prev => ({
      ...prev,
      stage: 'intro'
    }));
  };

  const processUserInput = async (input: string, isChoice: boolean = false, choiceIndex?: number, conflictStyle?: ConflictStyle) => {
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

      // Auto-speak results with Sensa's calming voice
      if (voiceSettings.enabled && voiceSettings.autoPlay) {
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
    setChatInput('');
  };

  const handleOptionClick = (option: string, index: number) => {
    processUserInput(option, true, index);
  };

  const handleSimulationChoice = (choice: { text: string; style: ConflictStyle }, index: number) => {
    processUserInput(choice.text, true, index, choice.style);
  };

  const handleVoiceInput = () => {
    if (recognition.current && !isListening) {
      setIsListening(true);
      recognition.current.start();
    }
  };

  const renderVoiceControls = () => (
    <div className={styles.voiceControls}>
      <button
        className={`${styles.voiceToggle} ${voiceSettings.enabled ? styles.enabled : styles.disabled}`}
        onClick={toggleVoice}
        title={voiceSettings.enabled ? 'Disable Sensa\'s voice' : 'Enable Sensa\'s voice'}
      >
        {voiceSettings.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      
      {voiceSettings.enabled && (
        <>
          <button
            className={`${styles.autoPlayToggle} ${voiceSettings.autoPlay ? styles.enabled : styles.disabled}`}
            onClick={toggleAutoPlay}
            title={voiceSettings.autoPlay ? 'Disable auto-play' : 'Enable auto-play'}
          >
            {voiceSettings.autoPlay ? 'Auto' : 'Manual'}
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
      
      {showVoiceSettings && voiceSettings.enabled && (
        <div className={styles.voiceSettingsPanel}>
          <div className={styles.voiceSettingsHeader}>
            <h4>Sensa's Voice Settings</h4>
            <button 
              className={styles.closeSettings}
              onClick={() => setShowVoiceSettings(false)}
            >
              ×
            </button>
          </div>
          
          <div className={styles.voiceOption}>
            <label>Voice Selection:</label>
            <select
              className={styles.voiceSelect}
              value={voiceSettings.voice?.name || ''}
              onChange={(e) => {
                const selectedVoice = availableVoices.find(v => v.name === e.target.value);
                updateVoiceSettings({ voice: selectedVoice || null });
              }}
            >
              <option value="">Default Voice</option>
              <optgroup label="🎯 Recommended for Sensa (Deep & Calming)">
                {qualityVoices.slice(0, 5).map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name.split(' ')[0]} ({voice.lang})
                  </option>
                ))}
              </optgroup>
              <optgroup label="📱 All Available Voices">
                {availableVoices
                  .filter(voice => voice.lang.startsWith('en'))
                  .map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
              </optgroup>
            </select>
            {voiceSettings.voice && (
              <button
                className={styles.testVoiceButton}
                onClick={() => testVoice(voiceSettings.voice!)}
                disabled={isSpeaking}
              >
                Test Sensa's Voice
              </button>
            )}
          </div>
          
          <div className={styles.voiceOption}>
            <label>Speaking Speed: {voiceSettings.rate.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={voiceSettings.rate}
              onChange={(e) => updateVoiceSettings({ rate: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceOption}>
            <label>Voice Depth: {voiceSettings.pitch.toFixed(1)}</label>
            <input
              type="range"
              min="0.6"
              max="1.2"
              step="0.05"
              value={voiceSettings.pitch}
              onChange={(e) => updateVoiceSettings({ pitch: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceQualityInfo}>
            <p><strong>🎙️ Sensa's Voice Profile:</strong></p>
            <ul>
              <li>🎯 Optimized for deep, calming delivery</li>
              <li>🧘 Slower pace for thoughtful reflection</li>
              <li>🎵 Lower pitch for professional warmth</li>
              <li>🔊 Neural voices provide the best experience</li>
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
          <h2>Discover Your Professional WHY with Sensa</h2>
          <p>
            Meet Sensa, your AI personality analyst with a deep, calming voice designed to guide you 
            through a transformative assessment experience. Using the proven Simon Sinek Golden Circle 
            framework, Sensa will uncover your deeper motivations through natural conversation and 
            realistic workplace scenarios.
          </p>
          <p>
            🎯 <strong>Purpose-Driven:</strong> Discover your professional WHY<br/>
            🤝 <strong>Trust-Focused:</strong> Assess collaboration and leadership potential<br/>
            🧠 <strong>Science-Based:</strong> Built on proven psychological frameworks<br/>
            🎙️ <strong>Calming Voice:</strong> Sensa's deep, professional tone creates a comfortable environment
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
            <Volume2 size={24} />
            <div>
              <h3>Sensa's Calming Voice</h3>
              <p>Deep, professional tone designed for thoughtful reflection</p>
            </div>
          </div>
        </div>

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
              <p>Professional assessment using the Golden Circle framework</p>
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
                {message.type === 'ai' && voiceSettings.enabled && (
                  <div className={styles.messageActions}>
                    {message.isPlaying ? (
                      <button
                        className={styles.speechButton}
                        onClick={stopSpeech}
                        title="Stop Sensa's voice"
                      >
                        <Pause size={14} />
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
            {recognition.current && (
              <button
                type="button"
                className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
                onClick={handleVoiceInput}
                disabled={isListening || isTyping}
                title="Voice input"
              >
                <Mic size={20} />
              </button>
            )}
            <input
              type="text"
              className={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Share your thoughts or use voice input..."
              disabled={isTyping || isAnalyzing}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!chatInput.trim() || isTyping || isAnalyzing}
            >
              {isTyping || isAnalyzing ? (
                <div className={styles.spinner} />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
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
            {voiceSettings.enabled && (
              <button
                className={styles.speakResultsButton}
                onClick={() => speakText(`Here's your comprehensive personality analysis. ${results.alignmentSummary}`)}
                disabled={isSpeaking}
                title="Listen to Sensa's results summary"
              >
                {isSpeaking ? <Pause size={20} /> : <Volume2 size={20} />}
                {isSpeaking ? 'Stop' : 'Listen to Sensa'}
              </button>
            )}
          </div>

          <div className={styles.saveStatus}>
            <CheckCircle className={styles.saveStatusIcon} size={20} />
            <div className={styles.saveStatusText}>
              <strong>Analysis Complete!</strong>
              <br />Professional personality assessment by Sensa using the Golden Circle framework.
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
              <p><strong>Assessment Framework:</strong> This analysis was conducted by Sensa using Simon Sinek's Golden Circle methodology combined with conflict simulation and emotional intelligence assessment.</p>
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