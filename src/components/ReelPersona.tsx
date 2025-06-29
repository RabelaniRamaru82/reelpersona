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
  Play
} from 'lucide-react';
import styles from './ReelPersona.module.css';

// Types
interface Question {
  id: string;
  text: string;
  category: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
  answers: string[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
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

interface WorkContext {
  firstName: string;
  lastName: string;
  currentRole: string;
  company: string;
  industry: string;
  colleagues: string[];
}

interface VoiceSettings {
  enabled: boolean;
  autoPlay: boolean;
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
}

// Sample questions for personality assessment
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: '1',
    text: 'When working on a team project, you prefer to:',
    category: 'extraversion',
    answers: [
      'Take the lead and coordinate everyone\'s efforts',
      'Contribute actively to group discussions',
      'Work on specific tasks and check in regularly',
      'Focus on your assigned work independently',
      'Prefer detailed written communication over meetings'
    ]
  },
  {
    id: '2',
    text: 'When facing a tight deadline, you typically:',
    category: 'conscientiousness',
    answers: [
      'Create a detailed plan and stick to it religiously',
      'Prioritize tasks and work systematically',
      'Focus intensely and adapt as needed',
      'Work in bursts of high energy',
      'Seek help or delegate when possible'
    ]
  },
  {
    id: '3',
    text: 'Your ideal work environment would be:',
    category: 'openness',
    answers: [
      'Dynamic and constantly changing with new challenges',
      'Innovative with opportunities to try new approaches',
      'Structured but with room for creativity',
      'Stable with clear processes and expectations',
      'Quiet and predictable with minimal disruptions'
    ]
  },
  {
    id: '4',
    text: 'When a colleague disagrees with your approach, you:',
    category: 'agreeableness',
    answers: [
      'Listen carefully and try to find common ground',
      'Explain your reasoning and seek to understand theirs',
      'Discuss the pros and cons of both approaches',
      'Stand firm on your position if you believe it\'s right',
      'Prefer to avoid the conflict and find a compromise'
    ]
  },
  {
    id: '5',
    text: 'When receiving critical feedback, you typically:',
    category: 'neuroticism',
    answers: [
      'Welcome it as an opportunity to improve',
      'Consider it carefully and ask clarifying questions',
      'Feel initially defensive but then reflect on it',
      'Take it personally but try to learn from it',
      'Feel stressed and worry about your performance'
    ]
  }
];

const ReelPersona: React.FC = () => {
  // State management
  const [currentStep, setCurrentStep] = useState<'welcome' | 'privacy' | 'context' | 'questionnaire' | 'chat' | 'processing' | 'results'>('welcome');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [workContext, setWorkContext] = useState<WorkContext>({
    firstName: '',
    lastName: '',
    currentRole: '',
    company: '',
    industry: '',
    colleagues: []
  });
  const [newColleague, setNewColleague] = useState('');
  const [results, setResults] = useState<PersonalityResults | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Voice-related state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoPlay: true,
    rate: 0.9,
    pitch: 1.0,
    voice: null
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
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

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        // Try to find a good default voice (prefer female, English)
        const preferredVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
        ) || voices.find(voice => 
          voice.lang.startsWith('en') && voice.name.toLowerCase().includes('samantha')
        ) || voices.find(voice => 
          voice.lang.startsWith('en')
        ) || voices[0];
        
        if (preferredVoice && !voiceSettings.voice) {
          setVoiceSettings(prev => ({ ...prev, voice: preferredVoice }));
        }
      };

      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;

      // Handle speech events
      const handleSpeechEnd = () => {
        setIsSpeaking(false);
        setCurrentSpeech(null);
        setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      };

      const handleSpeechError = () => {
        setIsSpeaking(false);
        setCurrentSpeech(null);
        setChatMessages(prev => prev.map(msg => ({ ...msg, isPlaying: false })));
      };

      return () => {
        speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Initialize chat when entering chat step
  useEffect(() => {
    if (currentStep === 'chat' && chatMessages.length === 0) {
      const initialMessage: ChatMessage = {
        id: '1',
        type: 'ai',
        content: `Hi ${workContext.firstName}! I'm excited to dive deeper into understanding your personality and work style. Based on your questionnaire responses, I'd love to explore some scenarios with you. Let's start with this: Imagine you're leading a project at ${workContext.company} and you discover a major issue just days before the deadline. Walk me through how you'd handle this situation.`,
        timestamp: new Date()
      };
      setChatMessages([initialMessage]);
      
      // Auto-speak the initial message if voice is enabled
      if (voiceSettings.enabled && voiceSettings.autoPlay) {
        setTimeout(() => speakText(initialMessage.content, initialMessage.id), 500);
      }
    }
  }, [currentStep, workContext.firstName, workContext.company, voiceSettings.enabled, voiceSettings.autoPlay]);

  // Voice synthesis functions
  const speakText = (text: string, messageId?: string) => {
    if (!voiceSettings.enabled || !('speechSynthesis' in window)) return;

    // Stop any current speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    
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

  const handleAnswerSelect = (answerIndex: number) => {
    const currentQuestion = SAMPLE_QUESTIONS[currentQuestionIndex];
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answerIndex
    }));

    if (currentQuestionIndex < SAMPLE_QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300);
    } else {
      setTimeout(() => {
        setCurrentStep('chat');
      }, 500);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponses = [
        "That's a really insightful approach! I can see you value both collaboration and decisive action. Tell me more about how you typically handle stress in high-pressure situations like this.",
        "Interesting perspective! Your response shows strong problem-solving skills. How do you usually communicate difficult news to stakeholders?",
        "I appreciate that detailed response. It shows you think systematically about challenges. Can you share an example of a time when you had to adapt your communication style for different team members?",
        "That's a thoughtful way to handle conflict. Your approach suggests you value both relationships and results. How do you typically motivate team members who might be feeling overwhelmed?",
        "Great insight! I'm getting a clear picture of your leadership style. Let's explore one more scenario: How do you prefer to receive feedback from your manager or peers?"
      ];

      const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: randomResponse,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);

      // Auto-speak AI response if enabled
      if (voiceSettings.enabled && voiceSettings.autoPlay) {
        setTimeout(() => speakText(randomResponse, aiMessage.id), 300);
      }
    }, 1500 + Math.random() * 1000);
  };

  const handleVoiceInput = () => {
    if (recognition.current && !isListening) {
      setIsListening(true);
      recognition.current.start();
    }
  };

  const addColleague = () => {
    if (newColleague.trim() && workContext.colleagues.length < 5) {
      setWorkContext(prev => ({
        ...prev,
        colleagues: [...prev.colleagues, newColleague.trim()]
      }));
      setNewColleague('');
    }
  };

  const removeColleague = (index: number) => {
    setWorkContext(prev => ({
      ...prev,
      colleagues: prev.colleagues.filter((_, i) => i !== index)
    }));
  };

  const generateResults = async () => {
    setIsProcessing(true);
    setCurrentStep('processing');

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate mock results based on answers
    const mockResults: PersonalityResults = {
      openness: 75 + Math.random() * 20,
      conscientiousness: 80 + Math.random() * 15,
      extraversion: 65 + Math.random() * 25,
      agreeableness: 85 + Math.random() * 10,
      neuroticism: 30 + Math.random() * 20,
      summary: `${workContext.firstName} demonstrates a balanced and adaptable personality profile well-suited for collaborative leadership roles. Your responses indicate strong emotional intelligence, systematic thinking, and a natural ability to build relationships while maintaining focus on results.`,
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
    setIsProcessing(false);
    setCurrentStep('results');

    // Speak the results summary if voice is enabled
    if (voiceSettings.enabled && voiceSettings.autoPlay) {
      setTimeout(() => {
        speakText(`Here are your personality analysis results, ${workContext.firstName}. ${mockResults.summary}`);
      }, 1000);
    }
  };

  const renderVoiceControls = () => (
    <div className={styles.voiceControls}>
      <button
        className={`${styles.voiceToggle} ${voiceSettings.enabled ? styles.enabled : styles.disabled}`}
        onClick={toggleVoice}
        title={voiceSettings.enabled ? 'Disable AI voice' : 'Enable AI voice'}
      >
        {voiceSettings.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
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
          
          {availableVoices.length > 0 && (
            <select
              className={styles.voiceSelect}
              value={voiceSettings.voice?.name || ''}
              onChange={(e) => {
                const selectedVoice = availableVoices.find(v => v.name === e.target.value);
                setVoiceSettings(prev => ({ ...prev, voice: selectedVoice || null }));
              }}
            >
              <option value="">Default Voice</option>
              {availableVoices
                .filter(voice => voice.lang.startsWith('en'))
                .map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          )}
          
          <div className={styles.voiceSettings}>
            <label>
              Speed: {voiceSettings.rate.toFixed(1)}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={voiceSettings.rate}
                onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                className={styles.voiceSlider}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );

  const renderWelcome = () => (
    <div className={styles.welcome}>
      <div className={styles.welcomeHeader}>
        <h1>Welcome to ReelPersona</h1>
        <p className={styles.welcomeSubtitle}>AI-Powered Personality Analysis with Voice Interaction</p>
      </div>

      <div className={styles.welcomeContent}>
        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}>
            <Shield size={24} />
            <div>
              <h3>Privacy First</h3>
              <p>Your data is encrypted and never shared without consent</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Brain size={24} />
            <div>
              <h3>AI-Powered Insights</h3>
              <p>Advanced personality analysis using proven psychological frameworks</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Volume2 size={24} />
            <div>
              <h3>Voice Interaction</h3>
              <p>Natural conversation with AI that speaks back to you</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Users size={24} />
            <div>
              <h3>Professional Focus</h3>
              <p>Tailored for workplace dynamics and career development</p>
            </div>
          </div>
        </div>

        <div className={styles.welcomeMessage}>
          <h2>Discover Your Professional Personality</h2>
          <p>
            ReelPersona combines traditional personality assessment with AI-powered conversation analysis 
            to provide deep insights into your work style, communication preferences, and leadership potential.
          </p>
          <p>
            Our assessment takes approximately 15-20 minutes and includes personalized scenarios based 
            on your actual work environment. The AI will speak with you naturally, creating an engaging 
            conversational experience.
          </p>
        </div>

        <div className={styles.processOverview}>
          <h3>How It Works</h3>
          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>1</div>
              <div>
                <h4>Work Context</h4>
                <p>Share your role and work environment for personalized scenarios</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>2</div>
              <div>
                <h4>Quick Assessment</h4>
                <p>Answer 5 targeted questions about your work preferences</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>3</div>
              <div>
                <h4>Voice Conversation</h4>
                <p>Discuss real workplace scenarios with our AI analyst using voice or text</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>4</div>
              <div>
                <h4>Detailed Results</h4>
                <p>Receive comprehensive personality insights and growth recommendations</p>
              </div>
            </div>
          </div>
        </div>

        <button 
          className={styles.primaryButton}
          onClick={() => setCurrentStep('privacy')}
        >
          Get Started
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className={styles.privacy}>
      <div className={styles.privacyHeader}>
        <Lock size={48} className={styles.lockIcon} />
        <h2>Your Privacy & Data Security</h2>
        <p>We take your privacy seriously. Here's how we protect your information:</p>
      </div>

      <div className={styles.privacyGrid}>
        <div className={styles.privacyCard}>
          <Shield size={32} />
          <h3>Encrypted Storage</h3>
          <p>All your responses are encrypted using industry-standard security protocols.</p>
          <span className={styles.privacyBadge}>256-bit SSL</span>
        </div>
        <div className={styles.privacyCard}>
          <Users size={32} />
          <h3>No Sharing</h3>
          <p>Your personality data is never shared with third parties or used for advertising.</p>
          <span className={styles.privacyBadge}>Private</span>
        </div>
        <div className={styles.privacyCard}>
          <Clock size={32} />
          <h3>Data Retention</h3>
          <p>You can delete your data at any time. We automatically purge inactive accounts.</p>
          <span className={styles.privacyBadge}>Your Control</span>
        </div>
        <div className={styles.privacyCard}>
          <Mic size={32} />
          <h3>Voice Privacy</h3>
          <p>Voice interactions are processed locally in your browser, not stored on servers.</p>
          <span className={styles.privacyBadge}>Local Only</span>
        </div>
      </div>

      <div className={styles.privacyAssurance}>
        <h3>What We Collect & Why</h3>
        <ul>
          <li>✓ Work context (role, industry) - for personalized scenarios</li>
          <li>✓ Assessment responses - for personality analysis</li>
          <li>✓ Chat interactions - for deeper insights</li>
          <li>✓ Usage analytics - for improving the experience</li>
          <li>✓ Voice preferences - stored locally for your convenience</li>
        </ul>
      </div>

      <div className={styles.privacyActions}>
        <button 
          className={styles.secondaryButton}
          onClick={() => setCurrentStep('welcome')}
        >
          Back
        </button>
        <button 
          className={styles.primaryButton}
          onClick={() => setCurrentStep('context')}
        >
          I Understand, Continue
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderWorkContext = () => (
    <div className={styles.workContext}>
      <div className={styles.contextHeader}>
        <Briefcase size={48} />
        <h2>Tell Us About Your Work</h2>
        <p>This helps us create personalized scenarios that reflect your actual work environment.</p>
      </div>

      <form className={styles.contextForm}>
        <div className={styles.formSection}>
          <h3><User size={20} />Personal Information</h3>
          <div className={styles.inputGroup}>
            <label>First Name</label>
            <input
              type="text"
              className={styles.input}
              value={workContext.firstName}
              onChange={(e) => setWorkContext(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="Your first name"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Last Name</label>
            <input
              type="text"
              className={styles.input}
              value={workContext.lastName}
              onChange={(e) => setWorkContext(prev => ({ ...prev, lastName: e.target.value }))}
              placeholder="Your last name"
              required
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3><Briefcase size={20} />Professional Details</h3>
          <div className={styles.inputGroup}>
            <label>Current Role</label>
            <input
              type="text"
              className={styles.input}
              value={workContext.currentRole}
              onChange={(e) => setWorkContext(prev => ({ ...prev, currentRole: e.target.value }))}
              placeholder="e.g., Software Engineer, Marketing Manager"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Company</label>
            <input
              type="text"
              className={styles.input}
              value={workContext.company}
              onChange={(e) => setWorkContext(prev => ({ ...prev, company: e.target.value }))}
              placeholder="Your company name"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Industry</label>
            <input
              type="text"
              className={styles.input}
              value={workContext.industry}
              onChange={(e) => setWorkContext(prev => ({ ...prev, industry: e.target.value }))}
              placeholder="e.g., Technology, Healthcare, Finance"
              required
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3><Users size={20} />Team Context</h3>
          <div className={styles.inputGroup}>
            <label>Frequent Collaborators</label>
            <small>Add names of colleagues you work with regularly (optional, up to 5)</small>
            {workContext.colleagues.length > 0 && (
              <div className={styles.colleaguesList}>
                {workContext.colleagues.map((colleague, index) => (
                  <div key={index} className={styles.colleagueTag}>
                    {colleague}
                    <button
                      type="button"
                      className={styles.removeColleague}
                      onClick={() => removeColleague(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.addColleagueSection}>
              <input
                type="text"
                className={styles.input}
                value={newColleague}
                onChange={(e) => setNewColleague(e.target.value)}
                placeholder="Colleague name"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColleague())}
              />
              <button
                type="button"
                className={styles.addButton}
                onClick={addColleague}
                disabled={!newColleague.trim() || workContext.colleagues.length >= 5}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className={styles.contextActions}>
        <button 
          className={styles.secondaryButton}
          onClick={() => setCurrentStep('privacy')}
        >
          Back
        </button>
        <button 
          className={styles.primaryButton}
          onClick={() => setCurrentStep('questionnaire')}
          disabled={!workContext.firstName || !workContext.lastName || !workContext.currentRole || !workContext.company}
        >
          Continue to Assessment
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  const renderQuestionnaire = () => {
    const currentQuestion = SAMPLE_QUESTIONS[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / SAMPLE_QUESTIONS.length) * 100;

    return (
      <div className={styles.questionnaire}>
        <div className={styles.questionnaireContent}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.questionHeader}>
            <h2>Quick Assessment</h2>
            <p>Question {currentQuestionIndex + 1} of {SAMPLE_QUESTIONS.length}</p>
            <small>Choose the response that best describes you</small>
          </div>

          <div className={styles.questionCard}>
            <div className={styles.categoryBadge}>
              {currentQuestion.category.charAt(0).toUpperCase() + currentQuestion.category.slice(1)}
            </div>
            <div className={styles.questionText}>
              {currentQuestion.text}
            </div>
          </div>

          <div className={styles.answerOptions}>
            {currentQuestion.answers.map((answer, index) => (
              <button
                key={index}
                className={styles.answerButton}
                onClick={() => handleAnswerSelect(index)}
              >
                <div className={styles.answerNumber}>{index + 1}</div>
                <div className={styles.answerLabel}>{answer}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className={styles.chat}>
      <div className={styles.chatContent}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderContent}>
            <div>
              <h2><MessageCircle size={24} />AI Personality Analysis</h2>
              <p>Let's explore your work style through personalized scenarios</p>
            </div>
            {renderVoiceControls()}
          </div>
        </div>

        <div className={styles.chatMessages} ref={chatMessagesRef}>
          {chatMessages.map((message) => (
            <div key={message.id} className={`${styles.chatMessage} ${styles[message.type + 'Message']}`}>
              <div className={`${styles.messageContent} ${isTyping && message === chatMessages[chatMessages.length - 1] ? styles.typingMessage : ''}`}>
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
                        <Pause size={16} />
                      </button>
                    ) : (
                      <button
                        className={styles.speechButton}
                        onClick={() => speakText(message.content, message.id)}
                        title="Speak this message"
                        disabled={isSpeaking}
                      >
                        <Play size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
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
          <div className={styles.chatHint}>
            <span>Share your thoughts naturally - the AI will ask follow-up questions to understand your style</span>
          </div>
          <div className={styles.inputContainer}>
            {recognition.current && (
              <button
                type="button"
                className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
                onClick={handleVoiceInput}
                disabled={isListening}
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
              placeholder="Type your response or use voice input..."
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

        {chatMessages.length >= 6 && (
          <div className={styles.processingMessage}>
            <p>Great conversation! Ready to see your personality analysis?</p>
            <button className={styles.primaryButton} onClick={generateResults}>
              Generate My Results
              <BarChart3 size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className={styles.processingMessage}>
      <div className={styles.loader}>
        <Brain size={48} />
      </div>
      <h2>Analyzing Your Personality Profile</h2>
      <p>Our AI is processing your responses and conversation to generate detailed insights...</p>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: '100%' }} />
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
              <strong>Results saved to your profile</strong>
              <br />Your personality analysis has been securely stored and can be accessed anytime.
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
            <h3><Award size={24} />Next Steps</h3>
            <p>
              Your personality profile is now part of your professional portfolio. 
              Use these insights to enhance your career development and team collaboration.
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
              <p><strong>Professional Integration:</strong> Your ReelPersona analysis integrates with the broader ReelApps ecosystem, including ReelCV for portfolio building and ReelMatch for career opportunities.</p>
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
            {currentStep !== 'welcome' && currentStep !== 'results' && (
              <div className={styles.progressIndicator}>
                <div 
                  className={styles.progressFill} 
                  style={{ 
                    width: `${
                      currentStep === 'privacy' ? 20 :
                      currentStep === 'context' ? 40 :
                      currentStep === 'questionnaire' ? 60 :
                      currentStep === 'chat' ? 80 :
                      currentStep === 'processing' ? 90 : 100
                    }%` 
                  }} 
                />
              </div>
            )}
          </div>
        </div>

        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'privacy' && renderPrivacy()}
        {currentStep === 'context' && renderWorkContext()}
        {currentStep === 'questionnaire' && renderQuestionnaire()}
        {currentStep === 'chat' && renderChat()}
        {currentStep === 'processing' && renderProcessing()}
        {currentStep === 'results' && renderResults()}
      </div>
    </div>
  );
};

export default ReelPersona;