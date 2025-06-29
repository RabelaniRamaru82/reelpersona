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
  Settings
} from 'lucide-react';
import styles from './ReelPersona.module.css';

// Types
interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
  options?: string[];
  expectsInput?: 'text' | 'choice' | 'name' | 'role' | 'company';
  metadata?: any;
}

interface PersonalityResults {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  summary: string;
  strengths: string[];
  growthAreas: string[];
}

interface UserProfile {
  firstName: string;
  lastName: string;
  currentRole: string;
  company: string;
  industry: string;
  colleagues: string[];
  answers: Record<string, number>;
}

interface VoiceSettings {
  enabled: boolean;
  autoPlay: boolean;
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
}

// Enhanced voice quality scoring system
const getVoiceQuality = (voice: SpeechSynthesisVoice): number => {
  let score = 0;
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  
  // Prefer English voices
  if (lang.startsWith('en-')) score += 10;
  
  // High-quality voice indicators
  if (name.includes('neural') || name.includes('premium') || name.includes('enhanced')) score += 20;
  if (name.includes('natural') || name.includes('human')) score += 15;
  
  // Platform-specific high-quality voices
  if (name.includes('samantha') || name.includes('alex') || name.includes('victoria')) score += 15;
  if (name.includes('zira') || name.includes('hazel') || name.includes('aria')) score += 12;
  if (name.includes('siri') || name.includes('cortana')) score += 10;
  
  // Gender preference for professional context
  if (name.includes('female') || name.includes('woman')) score += 8;
  
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
    colleagues: [],
    answers: {}
  });
  const [conversationState, setConversationState] = useState({
    stage: 'intro', // intro, name, role, company, assessment, deep_dive, complete
    questionIndex: 0,
    awaitingInput: false,
    inputType: 'text' as 'text' | 'choice' | 'name' | 'role' | 'company'
  });
  const [results, setResults] = useState<PersonalityResults | null>(null);
  
  // Voice-related state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoPlay: true,
    rate: 0.85, // Slightly slower for more natural feel
    pitch: 1.0,
    voice: null
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [qualityVoices, setQualityVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<any>(null);

  // Conversation flow data
  const assessmentQuestions = [
    {
      question: "When working on a team project, how do you prefer to contribute?",
      options: [
        "Take the lead and coordinate everyone's efforts",
        "Contribute actively to group discussions",
        "Work on specific tasks and check in regularly",
        "Focus on your assigned work independently",
        "Prefer detailed written communication over meetings"
      ],
      trait: 'extraversion'
    },
    {
      question: "When facing a tight deadline, you typically:",
      options: [
        "Create a detailed plan and stick to it religiously",
        "Prioritize tasks and work systematically",
        "Focus intensely and adapt as needed",
        "Work in bursts of high energy",
        "Seek help or delegate when possible"
      ],
      trait: 'conscientiousness'
    },
    {
      question: "Your ideal work environment would be:",
      options: [
        "Dynamic and constantly changing with new challenges",
        "Innovative with opportunities to try new approaches",
        "Structured but with room for creativity",
        "Stable with clear processes and expectations",
        "Quiet and predictable with minimal disruptions"
      ],
      trait: 'openness'
    },
    {
      question: "When a colleague disagrees with your approach, you:",
      options: [
        "Listen carefully and try to find common ground",
        "Explain your reasoning and seek to understand theirs",
        "Discuss the pros and cons of both approaches",
        "Stand firm on your position if you believe it's right",
        "Prefer to avoid the conflict and find a compromise"
      ],
      trait: 'agreeableness'
    },
    {
      question: "When receiving critical feedback, you typically:",
      options: [
        "Welcome it as an opportunity to improve",
        "Consider it carefully and ask clarifying questions",
        "Feel initially defensive but then reflect on it",
        "Take it personally but try to learn from it",
        "Feel stressed and worry about your performance"
      ],
      trait: 'neuroticism'
    }
  ];

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

  // Enhanced speech synthesis initialization with better voice selection
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        // Filter and rank voices by quality
        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
        const rankedVoices = englishVoices
          .map(voice => ({ voice, quality: getVoiceQuality(voice) }))
          .sort((a, b) => b.quality - a.quality)
          .map(item => item.voice);
        
        setQualityVoices(rankedVoices);
        
        // Select the best available voice
        const bestVoice = rankedVoices[0];
        
        if (bestVoice && !voiceSettings.voice) {
          setVoiceSettings(prev => ({ ...prev, voice: bestVoice }));
          console.log('Selected voice:', bestVoice.name, 'Quality score:', getVoiceQuality(bestVoice));
        }
      };

      // Load voices immediately and on change
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
      
      // Force voice loading on some browsers
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

  // Enhanced voice synthesis functions
  const speakText = (text: string, messageId?: string) => {
    if (!voiceSettings.enabled || !('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    // Clean text for better speech
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
      .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
      .replace(/`(.*?)`/g, '$1') // Remove code blocks
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\n+/g, '. ') // Replace line breaks with pauses
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Enhanced voice settings for more natural speech
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

  // Test voice function
  const testVoice = (voice: SpeechSynthesisVoice) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello! This is how I sound. I'm your AI personality analyst, and I'm excited to chat with you.");
    utterance.voice = voice;
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = 0.9;
    speechSynthesis.speak(utterance);
  };

  // Conversation management
  const addMessage = (content: string, type: 'user' | 'ai' | 'system', options?: string[], expectsInput?: any, metadata?: any) => {
    const message: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date(),
      options,
      expectsInput,
      metadata
    };

    setChatMessages(prev => [...prev, message]);

    // Auto-speak AI messages
    if (type === 'ai' && voiceSettings.enabled && voiceSettings.autoPlay) {
      setTimeout(() => speakText(content, message.id), 300);
    }

    return message;
  };

  const startConversation = () => {
    addMessage(
      "Hi there! 👋 I'm your AI personality analyst. I'm excited to learn about you and help you discover insights about your work style and personality. Let's start with something simple - what's your first name?",
      'ai',
      undefined,
      'name'
    );
    
    setConversationState({
      stage: 'name',
      questionIndex: 0,
      awaitingInput: true,
      inputType: 'name'
    });
  };

  const processUserInput = (input: string, isChoice: boolean = false, choiceIndex?: number) => {
    // Add user message
    addMessage(input, 'user');

    // Process based on current conversation state
    setTimeout(() => {
      handleConversationFlow(input, isChoice, choiceIndex);
    }, 500 + Math.random() * 1000);
  };

  const handleConversationFlow = (input: string, isChoice: boolean, choiceIndex?: number) => {
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);

      switch (conversationState.stage) {
        case 'name':
          setUserProfile(prev => ({ ...prev, firstName: input }));
          addMessage(
            `Nice to meet you, ${input}! 🌟 Now, what's your current role or job title? For example, "Software Engineer" or "Marketing Manager"`,
            'ai',
            undefined,
            'role'
          );
          setConversationState(prev => ({ ...prev, stage: 'role', inputType: 'role' }));
          break;

        case 'role':
          setUserProfile(prev => ({ ...prev, currentRole: input }));
          addMessage(
            `${input} - that sounds interesting! 💼 What company do you work for? (You can just say the company name or "prefer not to say")`,
            'ai',
            undefined,
            'company'
          );
          setConversationState(prev => ({ ...prev, stage: 'company', inputType: 'company' }));
          break;

        case 'company':
          setUserProfile(prev => ({ ...prev, company: input }));
          addMessage(
            `Perfect! Now I have a better picture of your professional context. 🎯 I'm going to ask you 5 quick questions about your work style. These will help me understand your personality better. Ready to dive in?`,
            'ai',
            ['Yes, let\'s do this!', 'I have a question first', 'Can you tell me more about the assessment?']
          );
          setConversationState(prev => ({ ...prev, stage: 'assessment_intro', inputType: 'choice' }));
          break;

        case 'assessment_intro':
          if (choiceIndex === 0 || input.toLowerCase().includes('yes') || input.toLowerCase().includes('ready')) {
            startAssessment();
          } else if (choiceIndex === 1 || input.toLowerCase().includes('question')) {
            addMessage(
              `Of course! What would you like to know? I'm here to help make this as comfortable as possible for you. 😊`,
              'ai',
              undefined,
              'text'
            );
          } else {
            addMessage(
              `This assessment uses the Big Five personality model to understand your work style across five key dimensions: Openness, Conscientiousness, Extraversion, Agreeableness, and Emotional Stability. Each question presents realistic workplace scenarios. Ready to begin?`,
              'ai',
              ['Yes, let\'s start!', 'I need more time to think']
            );
          }
          break;

        case 'assessment':
          if (isChoice && choiceIndex !== undefined) {
            // Record the answer
            const currentQ = assessmentQuestions[conversationState.questionIndex];
            setUserProfile(prev => ({
              ...prev,
              answers: { ...prev.answers, [currentQ.trait]: choiceIndex }
            }));

            // Move to next question or finish assessment
            if (conversationState.questionIndex < assessmentQuestions.length - 1) {
              setTimeout(() => {
                askNextQuestion(conversationState.questionIndex + 1);
              }, 800);
            } else {
              finishAssessment();
            }
          }
          break;

        case 'deep_dive':
          // Handle deep dive conversation
          const responses = [
            `That's a really insightful perspective! I can see you have a thoughtful approach to ${userProfile.currentRole} work. Tell me more about how you handle challenging situations.`,
            `Interesting! Your response shows strong problem-solving skills. How do you typically communicate with your team when things get complex?`,
            `I appreciate that detailed response. It shows you think systematically about challenges. Can you share how you prefer to receive feedback?`,
            `That's a thoughtful way to approach things. Your style suggests you value both relationships and results. How do you motivate yourself during tough projects?`,
            `Great insight! I'm getting a clear picture of your work style. Let me ask you this: What energizes you most in your work environment?`
          ];

          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          addMessage(randomResponse, 'ai', undefined, 'text');

          // After several exchanges, offer to generate results
          if (chatMessages.filter(m => m.type === 'user').length >= 8) {
            setTimeout(() => {
              addMessage(
                `This has been a fantastic conversation! I feel like I have a really good understanding of your personality and work style now. 🎉 Would you like me to generate your detailed personality analysis?`,
                'ai',
                ['Yes, show me my results!', 'Let\'s chat a bit more first']
              );
              setConversationState(prev => ({ ...prev, stage: 'results_ready' }));
            }, 2000);
          }
          break;

        case 'results_ready':
          if (choiceIndex === 0 || input.toLowerCase().includes('yes') || input.toLowerCase().includes('result')) {
            generateResults();
          } else {
            addMessage(
              `Of course! I love learning more about you. What else would you like to explore about your work style or personality? 💭`,
              'ai',
              undefined,
              'text'
            );
            setConversationState(prev => ({ ...prev, stage: 'deep_dive' }));
          }
          break;

        default:
          addMessage(
            `I appreciate you sharing that with me! Let me think about what to ask next... 🤔`,
            'ai',
            undefined,
            'text'
          );
      }
    }, 1000 + Math.random() * 1500);
  };

  const startAssessment = () => {
    addMessage(
      `Excellent! 🚀 Here we go with question 1 of 5. Remember, there are no right or wrong answers - just choose what feels most natural to you.`,
      'ai'
    );
    
    setTimeout(() => {
      askNextQuestion(0);
    }, 1000);
  };

  const askNextQuestion = (questionIndex: number) => {
    const question = assessmentQuestions[questionIndex];
    
    addMessage(
      `**Question ${questionIndex + 1}/5:** ${question.question}`,
      'ai',
      question.options,
      'choice'
    );

    setConversationState(prev => ({
      ...prev,
      stage: 'assessment',
      questionIndex,
      inputType: 'choice'
    }));
  };

  const finishAssessment = () => {
    addMessage(
      `Fantastic! 🎉 You've completed the assessment. Now I'd love to dive deeper and understand your unique work style through conversation. Let me start with this: Imagine you're leading an important project at ${userProfile.company} and you discover a major issue just days before the deadline. How would you handle this situation?`,
      'ai',
      undefined,
      'text'
    );

    setConversationState(prev => ({
      ...prev,
      stage: 'deep_dive',
      inputType: 'text'
    }));
  };

  const generateResults = async () => {
    addMessage(
      `Perfect! 🔮 Let me analyze everything we've discussed and generate your comprehensive personality profile. This will just take a moment...`,
      'ai'
    );

    // Simulate processing
    setTimeout(() => {
      addMessage(
        `✨ Analysis complete! I've generated your detailed personality insights based on our conversation and your assessment responses.`,
        'system'
      );

      // Generate mock results
      const mockResults: PersonalityResults = {
        openness: 75 + Math.random() * 20,
        conscientiousness: 80 + Math.random() * 15,
        extraversion: 65 + Math.random() * 25,
        agreeableness: 85 + Math.random() * 10,
        neuroticism: 30 + Math.random() * 20,
        summary: `${userProfile.firstName} demonstrates a balanced and adaptable personality profile well-suited for collaborative leadership roles. Your responses indicate strong emotional intelligence, systematic thinking, and a natural ability to build relationships while maintaining focus on results.`,
        strengths: [
          'Excellent collaborative leadership skills',
          'Strong problem-solving and analytical thinking',
          'High emotional intelligence and empathy',
          'Adaptable communication style',
          'Resilient under pressure'
        ],
        growthAreas: [
          'Could benefit from more structured delegation',
          'Opportunity to develop public speaking confidence',
          'Consider setting firmer boundaries with time management'
        ]
      };

      setResults(mockResults);
      setCurrentStep('results');

      // Auto-speak results if enabled
      if (voiceSettings.enabled && voiceSettings.autoPlay) {
        setTimeout(() => {
          speakText(`Here are your personality analysis results, ${userProfile.firstName}. ${mockResults.summary}`);
        }, 1000);
      }
    }, 3000);
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
        title={voiceSettings.enabled ? 'Disable AI voice' : 'Enable AI voice'}
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
            <h4>Voice Settings</h4>
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
              <optgroup label="🌟 Recommended (High Quality)">
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
                Test Voice
              </button>
            )}
          </div>
          
          <div className={styles.voiceOption}>
            <label>Speaking Speed: {voiceSettings.rate.toFixed(1)}x</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceSettings.rate}
              onChange={(e) => updateVoiceSettings({ rate: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceOption}>
            <label>Voice Pitch: {voiceSettings.pitch.toFixed(1)}</label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceSettings.pitch}
              onChange={(e) => updateVoiceSettings({ pitch: parseFloat(e.target.value) })}
              className={styles.voiceSlider}
            />
          </div>
          
          <div className={styles.voiceQualityInfo}>
            <p><strong>💡 Voice Quality Tips:</strong></p>
            <ul>
              <li>🌟 Recommended voices are ranked by naturalness</li>
              <li>🎯 Try different voices to find your preference</li>
              <li>⚡ Slower speeds (0.8-0.9x) sound more natural</li>
              <li>🔊 Neural/Premium voices offer the best quality</li>
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
        <p className={styles.welcomeSubtitle}>AI-Powered Personality Analysis Through Natural Conversation</p>
      </div>

      <div className={styles.welcomeContent}>
        <div className={styles.welcomeMessage}>
          <h2>Discover Your Professional Personality</h2>
          <p>
            Skip the boring forms! ReelPersona uses natural conversation with AI to understand your 
            personality and work style. Our AI analyst will chat with you like a real person, 
            asking thoughtful questions and responding to your unique perspective.
          </p>
          <p>
            🎤 <strong>Voice-enabled:</strong> Talk naturally with AI that speaks back to you<br/>
            💼 <strong>Work-focused:</strong> Tailored for professional development<br/>
            🔒 <strong>Private:</strong> Your conversations stay secure and confidential<br/>
            ⚡ <strong>Quick:</strong> 10-15 minutes for comprehensive insights
          </p>
        </div>

        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}>
            <MessageCircle size={24} />
            <div>
              <h3>Natural Conversation</h3>
              <p>Chat naturally instead of filling out forms</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Brain size={24} />
            <div>
              <h3>AI-Powered Analysis</h3>
              <p>Advanced personality insights using proven psychology</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Volume2 size={24} />
            <div>
              <h3>Realistic Voice AI</h3>
              <p>High-quality, natural-sounding voice interaction</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Shield size={24} />
            <div>
              <h3>Privacy First</h3>
              <p>Your conversations are encrypted and secure</p>
            </div>
          </div>
        </div>

        <button 
          className={styles.primaryButton}
          onClick={() => setCurrentStep('chat')}
        >
          <MessageCircle size={20} />
          Start Conversation
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
              <h2><Brain size={24} />AI Personality Analyst</h2>
              <p>Having a natural conversation to understand your work style</p>
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
                        title="Stop speaking"
                      >
                        <Pause size={14} />
                      </button>
                    ) : (
                      <button
                        className={styles.speechButton}
                        onClick={() => speakText(message.content, message.id)}
                        title="Speak this message"
                        disabled={isSpeaking}
                      >
                        <Play size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {message.options && (
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
            </div>
          ))}
          
          {isTyping && (
            <div className={`${styles.chatMessage} ${styles.aiMessage}`}>
              <div className={`${styles.messageContent} ${styles.typingMessage}`}>
                <div className={styles.messageText}>
                  <p>AI is thinking</p>
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
              placeholder={
                conversationState.inputType === 'name' ? "Type your first name..." :
                conversationState.inputType === 'role' ? "Type your job title..." :
                conversationState.inputType === 'company' ? "Type your company name..." :
                "Type your response or use voice input..."
              }
              disabled={isTyping}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={!chatInput.trim() || isTyping}
            >
              {isTyping ? (
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

    const traits = [
      { name: 'Openness', score: results.openness, description: 'Creativity and openness to new experiences' },
      { name: 'Conscientiousness', score: results.conscientiousness, description: 'Organization and attention to detail' },
      { name: 'Extraversion', score: results.extraversion, description: 'Social energy and assertiveness' },
      { name: 'Agreeableness', score: results.agreeableness, description: 'Cooperation and trust in others' },
      { name: 'Emotional Stability', score: 100 - results.neuroticism, description: 'Resilience and emotional regulation' }
    ];

    return (
      <div className={styles.results}>
        <div className={styles.resultsContent}>
          <div className={styles.resultsHeader}>
            <h2>Your Personality Analysis Results</h2>
            {voiceSettings.enabled && (
              <button
                className={styles.speakResultsButton}
                onClick={() => speakText(`Here's a summary of your personality analysis results. ${results.summary}`)}
                disabled={isSpeaking}
                title="Listen to results summary"
              >
                {isSpeaking ? <Pause size={20} /> : <Volume2 size={20} />}
                {isSpeaking ? 'Stop' : 'Listen to Summary'}
              </button>
            )}
          </div>

          <div className={styles.saveStatus}>
            <CheckCircle className={styles.saveStatusIcon} size={20} />
            <div className={styles.saveStatusText}>
              <strong>Analysis Complete!</strong>
              <br />Your personality insights have been generated from our conversation.
            </div>
          </div>

          <div className={styles.summarySection}>
            <h3>Your Personality Summary</h3>
            <p>{results.summary}</p>
          </div>

          <div className={styles.traitsSection}>
            <h3>Personality Traits</h3>
            <div className={styles.traits}>
              {traits.map((trait) => (
                <div key={trait.name} className={styles.trait}>
                  <div className={styles.traitHeader}>
                    <span className={styles.traitName}>{trait.name}</span>
                    <span className={styles.traitScore}>{Math.round(trait.score)}%</span>
                  </div>
                  <div className={styles.traitBar}>
                    <div 
                      className={styles.traitFill} 
                      style={{ width: `${trait.score}%` }}
                    />
                  </div>
                  <div className={styles.traitLabel}>{trait.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.insightsSection}>
            <div className={styles.strengths}>
              <h3><TrendingUp size={20} />Key Strengths</h3>
              <ul>
                {results.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>

            <div className={styles.growthAreas}>
              <h3><Target size={20} />Growth Opportunities</h3>
              <ul>
                {results.growthAreas.map((area, index) => (
                  <li key={index}>{area}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.integrationSection}>
            <h3><Award size={24} />What's Next?</h3>
            <p>
              Your personality profile is now ready! Use these insights to enhance your 
              career development, improve team collaboration, and make more informed 
              professional decisions.
            </p>
            
            <div className={styles.actionButtons}>
              <button className={styles.primaryButton}>
                <ExternalLink size={20} />
                View Full Portfolio
              </button>
              <button className={styles.secondaryButton}>
                Share Results
              </button>
              <button className={styles.tertiaryButton}>
                Download Report
              </button>
            </div>

            <div className={styles.integrationNote}>
              <p><strong>Professional Integration:</strong> Your ReelPersona analysis integrates with the broader ReelApps ecosystem for career development.</p>
              <p><strong>Privacy Note:</strong> You control who sees your personality insights. Results are private by default.</p>
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
                    width: `${
                      conversationState.stage === 'intro' ? 10 :
                      conversationState.stage === 'name' ? 20 :
                      conversationState.stage === 'role' ? 30 :
                      conversationState.stage === 'company' ? 40 :
                      conversationState.stage === 'assessment_intro' ? 50 :
                      conversationState.stage === 'assessment' ? 60 + (conversationState.questionIndex * 6) :
                      conversationState.stage === 'deep_dive' ? 85 :
                      conversationState.stage === 'results_ready' ? 95 : 100
                    }%` 
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