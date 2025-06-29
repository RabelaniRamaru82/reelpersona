import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Brain, Shield, Lock, Users, Star, CheckCircle, User, Building, Calendar, Mic, MicOff } from 'lucide-react';
import { getSupabaseClient } from '@reelapps/auth';
import styles from './ReelPersona.module.css';

interface WorkContext {
  firstName: string;
  company: string;
  role: string;
  teamSize: string;
  manager: string;
  colleagues: string[];
  workDuration: string;
  industry: string;
}

interface PersonalizedQuestion {
  id: number;
  text: string;
  trait: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
  category: 'work_pressure' | 'team_dynamics' | 'leadership' | 'conflict_resolution' | 'adaptation';
}

interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface PersonaResults {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  summary: string;
  strengths: string[];
  growth_areas: string[];
  detailed_insights?: {
    work_style: {
      collaboration: number;
      independence: number;
      leadership: number;
      adaptability: number;
    };
    communication_style: string;
    ideal_environment: string;
    decision_making: string;
    stress_management: string;
    work_pressure_response: string;
    team_dynamics_style: string;
  };
  confidence_score?: number;
}

interface Question {
  id: number;
  text: string;
  trait: 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
}

interface AiFeedback {
  message: string;
  insights: string[];
  nextSteps: string;
}

const QUESTIONNAIRE: Question[] = [
  { id: 1, text: "I enjoy exploring new ideas and concepts, even if they challenge my existing beliefs.", trait: 'openness' },
  { id: 2, text: "I often find myself drawn to creative activities like art, music, or writing.", trait: 'openness' },
  { id: 3, text: "I prefer to stick with familiar routines rather than trying new approaches.", trait: 'openness' },
  { id: 4, text: "I enjoy intellectual conversations and debates about complex topics.", trait: 'openness' },
  { id: 5, text: "I always complete my tasks on time and rarely miss deadlines.", trait: 'conscientiousness' },
  { id: 6, text: "I keep my workspace organized and know where everything is located.", trait: 'conscientiousness' },
  { id: 7, text: "I often procrastinate on important tasks until the last minute.", trait: 'conscientiousness' },
  { id: 8, text: "I set clear goals for myself and work systematically to achieve them.", trait: 'conscientiousness' },
  { id: 9, text: "I feel energized when I'm around other people and enjoy social gatherings.", trait: 'extraversion' },
  { id: 10, text: "I prefer working in teams rather than working alone on projects.", trait: 'extraversion' },
  { id: 11, text: "I often need quiet time alone to recharge after social interactions.", trait: 'extraversion' },
  { id: 12, text: "I'm comfortable being the center of attention in group settings.", trait: 'extraversion' },
  { id: 13, text: "I try to avoid conflict and prefer to find compromises in disagreements.", trait: 'agreeableness' },
  { id: 14, text: "I often put others' needs before my own, even when it's inconvenient.", trait: 'agreeableness' },
  { id: 15, text: "I believe it's important to be competitive to succeed in life.", trait: 'agreeableness' },
  { id: 16, text: "I find it easy to trust new people and give them the benefit of the doubt.", trait: 'agreeableness' },
  { id: 17, text: "I often worry about things that might go wrong in the future.", trait: 'neuroticism' },
  { id: 18, text: "I tend to remain calm and composed even in stressful situations.", trait: 'neuroticism' },
  { id: 19, text: "My mood can change quickly based on what's happening around me.", trait: 'neuroticism' },
  { id: 20, text: "I rarely feel anxious or overwhelmed by daily challenges.", trait: 'neuroticism' }
];

const CHAT_QUESTIONS = [
  "Tell me about a recent challenge you faced and how you approached solving it.",
  "What motivates you most in your work or personal life?",
  "How do you typically handle stress or pressure?",
  "Describe your ideal work environment and team dynamic.",
  "What's something you've learned about yourself recently?"
];

const FOLLOW_UP_QUESTIONS = [
  "That's interesting! Can you give me a specific example?",
  "How did that make you feel, and what did you learn from it?",
  "What would you do differently if you faced a similar situation again?",
  "How do others usually respond to your approach?",
  "What aspects of that situation energized or drained you the most?"
];

const ReelPersona: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'privacy' | 'work_context' | 'personalized_questions' | 'deep_dive' | 'results'>('welcome');
  const [workContext, setWorkContext] = useState<WorkContext>({
    firstName: '',
    company: '',
    role: '',
    teamSize: '',
    manager: '',
    colleagues: [],
    workDuration: '',
    industry: ''
  });
  const [personalizedQuestions, setPersonalizedQuestions] = useState<PersonalizedQuestion[]>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatInput, setCurrentChatInput] = useState('');
  const [chatQuestionIndex, setChatQuestionIndex] = useState(0);
  const [conversationDepth, setConversationDepth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PersonaResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [showColleagueInput, setShowColleagueInput] = useState(false);
  const [newColleague, setNewColleague] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<{[key: string]: string[]}>({});
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (currentStep === 'chat' && chatMessages.length === 0) {
      const firstMessage: ChatMessage = {
        id: 1,
        text: `Hello! I'm your AI personality coach. Let's have a natural conversation to better understand your personality. ${CHAT_QUESTIONS[0]}`,
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages([firstMessage]);
    }
  }, [currentStep, chatMessages.length]);

  const generatePersonalizedQuestions = (context: WorkContext): PersonalizedQuestion[] => {
    const questions: PersonalizedQuestion[] = [];
    let id = 1;

    // Work Pressure Questions
    if (context.manager) {
      questions.push({
        id: id++,
        text: `Imagine ${context.manager} has just told you that a critical project deadline has been moved up by two weeks. How would you typically respond?`,
        trait: 'neuroticism',
        category: 'work_pressure'
      });
    }

    if (context.colleagues.length > 0) {
      const colleague = context.colleagues[0];
      questions.push({
        id: id++,
        text: `${colleague} consistently submits work late, affecting your own deadlines. How do you handle this situation?`,
        trait: 'agreeableness',
        category: 'conflict_resolution'
      });
    }

    // Team Dynamics Questions
    if (context.teamSize === 'small' || context.teamSize === 'medium') {
      questions.push({
        id: id++,
        text: `During team meetings at ${context.company}, you notice that one team member rarely speaks up. How do you handle this?`,
        trait: 'extraversion',
        category: 'team_dynamics'
      });
    }

    if (context.role.toLowerCase().includes('lead') || context.role.toLowerCase().includes('manager') || context.role.toLowerCase().includes('senior')) {
      questions.push({
        id: id++,
        text: `You're leading a project where two team members have fundamentally different approaches. How do you navigate this?`,
        trait: 'openness',
        category: 'leadership'
      });
    }

    // Industry-specific scenarios
    if (context.industry) {
      questions.push({
        id: id++,
        text: `The ${context.industry} industry is rapidly changing. How do you typically adapt to new technologies or processes?`,
        trait: 'openness',
        category: 'adaptation'
      });
    }

    // Add more personalized questions based on context
    if (context.colleagues.length > 1) {
      const colleague1 = context.colleagues[0];
      const colleague2 = context.colleagues[1];
      questions.push({
        id: id++,
        text: `${colleague1} and ${colleague2} are having a heated disagreement about project priorities. How do you respond?`,
        trait: 'agreeableness',
        category: 'conflict_resolution'
      });
    }

    // Work style questions
    questions.push({
      id: id++,
      text: `When working on complex tasks at ${context.company}, I prefer to plan every detail in advance rather than figuring things out as I go.`,
      trait: 'conscientiousness',
      category: 'work_pressure'
    });

    questions.push({
      id: id++,
      text: `If ${context.manager} asked you to present your work to senior leadership tomorrow, how would you feel?`,
      trait: 'extraversion',
      category: 'work_pressure'
    });

    return questions;
  };

  const handleWorkContextSubmit = () => {
    if (!workContext.firstName || !workContext.company || !workContext.role) {
      window.alert('Please fill in at least your name, company, and role to continue.');
      return;
    }

    const generated = generatePersonalizedQuestions(workContext);
    setPersonalizedQuestions(generated);
    setCurrentStep('personalized_questions');
  };

  const handleQuestionnaireAnswer = (value: number) => {
    const currentQuestion = personalizedQuestions[currentQuestionIndex];
    setQuestionnaireAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));

    if (currentQuestionIndex < personalizedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setCurrentStep('deep_dive');
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChatInput.trim() || isAnalyzing) return;

    const userMessage: ChatMessage = {
      id: chatMessages.length + 1,
      text: currentChatInput,
      isUser: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setCurrentChatInput('');

    setTimeout(() => {
      handlePersonalizedAnalysis(userMessage.text);
    }, 1000);
  };

  const handlePersonalizedAnalysis = async (userResponse: string) => {
     setIsAnalyzing(true);
    
     try {
       const typingMessage: ChatMessage = {
         id: chatMessages.length + 2,
        text: "I'm analyzing your response and considering your work context...",
         isUser: false,
         timestamp: new Date()
       };
       setChatMessages(prev => [...prev, typingMessage]);
       
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      let nextResponse = generateContextualResponse(userResponse);
       
       const aiMessage: ChatMessage = {
         id: chatMessages.length + 2,
         text: nextResponse,
         isUser: false,
         timestamp: new Date()
       };
       
       setChatMessages(prev => prev.slice(0, -1).concat(aiMessage));
 
      if (chatMessages.length >= 6) {
        setTimeout(() => {
          processPersonalizedResults();
        }, 2000);
      }
      
     } catch (error) {
      console.error('Analysis error:', error);
     } finally {
       setIsAnalyzing(false);
     }
  };

  const generateContextualResponse = (userResponse: string): string => {
    const responses = [
      `That's fascinating, ${workContext.firstName}. Based on your experience at ${workContext.company}, how has your ${workContext.role} position shaped your approach to handling pressure?`,
      `I can see how your relationship with ${workContext.manager} influences your work style. Can you tell me about a time when you had to navigate a challenging situation with them?`,
      `Your response reveals a lot about how you handle team dynamics. How do you think your colleagues would describe your leadership style?`,
      `That's very insightful. Given your ${workContext.workDuration} experience in ${workContext.industry}, how do you typically respond when faced with unexpected changes?`,
      `Thank you for sharing that. Let me ask you this: when you're under pressure at work, what does your support system look like?`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const processPersonalizedResults = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockResults: PersonaResults = {
        openness: 7.5,
        conscientiousness: 8.2,
        extraversion: 6.8,
        agreeableness: 7.9,
        neuroticism: 4.2,
        summary: `${workContext.firstName}, your personality profile reveals a highly conscientious professional who thrives in collaborative environments. Your experience as a ${workContext.role} at ${workContext.company} has shaped you into someone who values both structure and innovation.`,
        strengths: [
          'Exceptional ability to maintain quality under pressure',
          'Natural talent for building trust with team members',
          'Strong adaptability to changing industry demands',
          'Excellent at mediating conflicts between colleagues'
        ],
        growth_areas: [
          'Could benefit from more assertive communication in high-stakes situations',
          'Might consider delegating more to reduce personal stress',
          'Could explore more creative problem-solving approaches'
        ],
        detailed_insights: {
          work_style: {
            collaboration: 8.5,
            independence: 7.2,
            leadership: 7.8,
            adaptability: 8.0
          },
          communication_style: 'Diplomatic and thoughtful, with a preference for building consensus',
          ideal_environment: 'Collaborative team settings with clear goals and mutual respect',
          decision_making: 'Data-driven with consideration for team input and long-term impact',
          stress_management: 'Proactive planning with healthy boundaries',
          work_pressure_response: `Based on your responses about working with ${workContext.manager}, you handle pressure by maintaining open communication and focusing on solutions`,
          team_dynamics_style: `Your approach to working with colleagues like ${workContext.colleagues.join(' and ')} shows you value harmony while maintaining professional standards`
        },
        confidence_score: 8.1
      };
      
      setResults(mockResults);
      setCurrentStep('results');
    } catch (err) {
      setError('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addColleague = () => {
    if (newColleague.trim() && workContext.colleagues.length < 3) {
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

  const generateAiSuggestions = async (field: string, value: string) => {
    if (value.length < 2) return;
    
    setAiProcessing(true);
    try {
      // Simulate AI suggestions based on field type
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let suggestions: string[] = [];
      
      switch (field) {
        case 'company':
          suggestions = [
            'Microsoft Corporation',
            'Google LLC',
            'TechCorp Solutions',
            'Digital Innovations Inc',
            'Global Healthcare Systems'
          ].filter(s => s.toLowerCase().includes(value.toLowerCase()));
          break;
        case 'role':
          suggestions = [
            'Senior Software Developer',
            'Marketing Manager',
            'Data Analyst',
            'Project Manager',
            'UX Designer',
            'Business Analyst'
          ].filter(s => s.toLowerCase().includes(value.toLowerCase()));
          break;
        case 'industry':
          suggestions = [
            'Technology',
            'Healthcare',
            'Finance',
            'Education',
            'Manufacturing',
            'Retail'
          ].filter(s => s.toLowerCase().includes(value.toLowerCase()));
          break;
        case 'manager':
          suggestions = [
            'Sarah Johnson',
            'Michael Chen',
            'Dr. Emily Rodriguez',
            'David Thompson',
            'Lisa Williams'
          ].filter(s => s.toLowerCase().includes(value.toLowerCase()));
          break;
      }
      
      setAiSuggestions(prev => ({
        ...prev,
        [field]: suggestions.slice(0, 4)
      }));
    } catch (error) {
      console.error('AI suggestion error:', error);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setWorkContext(prev => ({ ...prev, [field]: value }));
    
    // Trigger AI suggestions after a delay
    if (value.length >= 2) {
      setTimeout(() => generateAiSuggestions(field, value), 300);
    } else {
      setAiSuggestions(prev => ({ ...prev, [field]: [] }));
    }
  };

  const selectAiSuggestion = (field: string, suggestion: string) => {
    setWorkContext(prev => ({ ...prev, [field]: suggestion }));
    setAiSuggestions(prev => ({ ...prev, [field]: [] }));
  };

  const getTraitLabel = (trait: string, score: number): string => {
    const traitLabels: Record<string, { low: string; high: string }> = {
      openness: {
        low: 'Practical & Traditional',
        high: 'Creative & Open-minded'
      },
      conscientiousness: {
        low: 'Flexible & Spontaneous',
        high: 'Organized & Disciplined'
      },
      extraversion: {
        low: 'Reserved & Thoughtful',
        high: 'Outgoing & Energetic'
      },
      agreeableness: {
        low: 'Direct & Competitive',
        high: 'Cooperative & Trusting'
      },
      neuroticism: {
        low: 'Calm & Resilient',
        high: 'Sensitive & Emotionally Aware'
      }
    };

    const labels = traitLabels[trait];
    if (!labels) return '';

    return score >= 60 ? labels.high : labels.low;
  };

  // Voice Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setVoiceSupported(true);
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentChatInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && voiceSupported) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const renderWelcome = () => (
    <div className={styles.welcome}>
      <div className={styles.welcomeHeader}>
        <h1>Welcome to ReelPersona</h1>
        <p className={styles.welcomeSubtitle}>Your Personal Career Character Compass</p>
      </div>
      
      <div className={styles.welcomeContent}>
        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}>
            <Shield size={24} />
            <div>
              <h3>100% Private & Secure</h3>
              <p>Your responses are encrypted and never shared without your consent</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Users size={24} />
            <div>
              <h3>Personalized Just for You</h3>
              <p>Real workplace scenarios using your actual work context</p>
            </div>
          </div>
          <div className={styles.trustItem}>
            <Star size={24} />
            <div>
              <h3>Trusted by 50,000+ Professionals</h3>
              <p>Join thousands who've discovered their career potential</p>
            </div>
          </div>
        </div>

        <div className={styles.welcomeMessage}>
          <h2>Discover Your True Professional Character</h2>
          <p>
            Unlike generic personality tests, ReelPersona analyzes how you really behave under 
            work pressure, with real colleagues, and in actual workplace situations.
          </p>
          <p>
            We'll create personalized scenarios using your actual work context to reveal 
            insights that matter for your career growth.
          </p>
        </div>

        <div className={styles.processOverview}>
          <h3>What to Expect (10-15 minutes)</h3>
          <div className={styles.processSteps}>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>1</div>
              <div>
                <h4>Privacy & Security</h4>
                <p>Review how we protect your data</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>2</div>
              <div>
                <h4>Work Context</h4>
                <p>Share your workplace details (anonymous)</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>3</div>
              <div>
                <h4>Personalized Scenarios</h4>
                <p>Answer questions about real work situations</p>
              </div>
            </div>
            <div className={styles.processStep}>
              <div className={styles.stepNumber}>4</div>
              <div>
                <h4>Deep Dive Chat</h4>
                <p>Explore your responses with AI guidance</p>
              </div>
            </div>
          </div>
        </div>

          <button 
            className={styles.primaryButton}
          onClick={() => setCurrentStep('privacy')}
          >
          <ArrowRight size={20} />
          Let's Begin Your Journey
          </button>
        </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className={styles.privacy}>
      <div className={styles.privacyHeader}>
        <Lock size={48} className={styles.lockIcon} />
        <h2>Your Privacy is Our Priority</h2>
        <p>We take your trust seriously. Here's exactly how we protect your information:</p>
      </div>

      <div className={styles.privacyGrid}>
        <div className={styles.privacyCard}>
          <Shield size={32} />
          <h3>End-to-End Encryption</h3>
          <p>All your responses are encrypted using military-grade security. We literally cannot read your data without your permission.</p>
          <div className={styles.privacyBadge}>✓ Verified Secure</div>
        </div>

        <div className={styles.privacyCard}>
          <Users size={32} />
          <h3>Anonymous Analysis</h3>
          <p>Your work context is used only to create personalized questions. Names and company details are anonymized in our analysis.</p>
          <div className={styles.privacyBadge}>✓ Fully Anonymous</div>
        </div>

        <div className={styles.privacyCard}>
          <CheckCircle size={32} />
          <h3>You Control Your Data</h3>
          <p>Download, delete, or modify your data anytime. You own your personality insights completely.</p>
          <div className={styles.privacyBadge}>✓ Your Data, Your Control</div>
        </div>
      </div>

      <div className={styles.privacyAssurance}>
        <h3>Our Promise to You</h3>
        <ul>
          <li>✓ We never sell your personal data</li>
          <li>✓ We never share responses with employers</li>
          <li>✓ We never use your data for advertising</li>
          <li>✓ You can delete everything with one click</li>
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
          onClick={() => setCurrentStep('work_context')}
        >
          <Shield size={20} />
          I Trust ReelPersona - Continue
        </button>
      </div>
    </div>
  );

  const renderWorkContext = () => (
    <div className={styles.workContext}>
      <div className={styles.contextHeader}>
        <Building size={48} />
        <h2>Tell Us About Your Work World</h2>
        <p>Help us create scenarios that reflect your actual workplace dynamics</p>
      </div>

      <div className={styles.contextForm}>
        <div className={styles.formSection}>
          <h3><User size={20} /> Personal Details</h3>
          <div className={styles.inputGroup}>
            <label>What should we call you? *</label>
            <input
              type="text"
              value={workContext.firstName}
              onChange={(e) => setWorkContext(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="Your first name"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formSection}>
          <h3><Building size={20} /> Work Environment</h3>
          <div className={styles.inputGroup}>
            <label>Company/Organization *</label>
            <div className={styles.inputWithSuggestions}>
              <input
                type="text"
                value={workContext.company}
                onChange={(e) => handleFieldChange('company', e.target.value)}
                placeholder="e.g., TechCorp, City Hospital, ABC Marketing"
                className={styles.input}
              />
              {aiSuggestions.company && aiSuggestions.company.length > 0 && (
                <div className={styles.aiSuggestions}>
                  <div className={styles.aiSuggestionsHeader}>
                    <Brain size={14} />
                    <span>AI Suggestions</span>
                  </div>
                  {aiSuggestions.company.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className={styles.suggestionItem}
                      onClick={() => selectAiSuggestion('company', suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Your Role *</label>
            <div className={styles.inputWithSuggestions}>
              <input
                type="text"
                value={workContext.role}
                onChange={(e) => handleFieldChange('role', e.target.value)}
                placeholder="e.g., Software Developer, Marketing Manager, Nurse"
                className={styles.input}
              />
              {aiSuggestions.role && aiSuggestions.role.length > 0 && (
                <div className={styles.aiSuggestions}>
                  <div className={styles.aiSuggestionsHeader}>
                    <Brain size={14} />
                    <span>AI Suggestions</span>
                  </div>
                  {aiSuggestions.role.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className={styles.suggestionItem}
                      onClick={() => selectAiSuggestion('role', suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Industry</label>
            <input
              type="text"
              value={workContext.industry}
              onChange={(e) => setWorkContext(prev => ({ ...prev, industry: e.target.value }))}
              placeholder="e.g., Healthcare, Technology, Finance"
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <label>Team Size</label>
            <select
              value={workContext.teamSize}
              onChange={(e) => setWorkContext(prev => ({ ...prev, teamSize: e.target.value }))}
              className={styles.input}
            >
              <option value="">Select team size</option>
              <option value="solo">Just me</option>
              <option value="small">2-5 people</option>
              <option value="medium">6-15 people</option>
              <option value="large">16+ people</option>
            </select>
          </div>
        </div>

        <div className={styles.formSection}>
          <h3><Users size={20} /> Key People</h3>
          <div className={styles.inputGroup}>
            <label>Manager/Boss Name</label>
            <div className={styles.inputWithSuggestions}>
              <input
                type="text"
                value={workContext.manager}
                onChange={(e) => handleFieldChange('manager', e.target.value)}
                placeholder="e.g., Sarah, Mike, Dr. Johnson"
                className={styles.input}
              />
              {aiProcessing && (
                <div className={styles.aiProcessingIndicator}>
                  <div className={styles.spinner}></div>
                  <span>AI is thinking...</span>
                </div>
              )}
              {aiSuggestions.manager && aiSuggestions.manager.length > 0 && (
                <div className={styles.aiSuggestions}>
                  <div className={styles.aiSuggestionsHeader}>
                    <Brain size={14} />
                    <span>AI Suggestions</span>
                  </div>
                  {aiSuggestions.manager.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className={styles.suggestionItem}
                      onClick={() => selectAiSuggestion('manager', suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <small>We'll use this to create realistic scenarios</small>
          </div>

          <div className={styles.inputGroup}>
            <label>Close Colleagues (up to 3)</label>
            <div className={styles.colleaguesList}>
              {workContext.colleagues.map((colleague, index) => (
                <div key={index} className={styles.colleagueTag}>
                  {colleague}
                  <button 
                    type="button"
                    onClick={() => removeColleague(index)}
                    className={styles.removeColleague}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {workContext.colleagues.length < 3 && (
              <div className={styles.addColleagueSection}>
                <input
                  type="text"
                  value={newColleague}
                  onChange={(e) => setNewColleague(e.target.value)}
                  placeholder="Colleague's first name"
                  className={styles.input}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColleague())}
                />
                <button 
                  type="button"
                  onClick={addColleague}
                  className={styles.addButton}
                  disabled={!newColleague.trim()}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.contextActions}>
          <button 
            className={styles.secondaryButton}
            onClick={() => setCurrentStep('privacy')}
          >
            Back
          </button>
          <button 
            className={styles.primaryButton}
            onClick={handleWorkContextSubmit}
            disabled={!workContext.firstName || !workContext.company || !workContext.role}
          >
            <ArrowRight size={20} />
            Create My Personalized Assessment
          </button>
        </div>
      </div>
    </div>
  );

  const renderPersonalizedQuestions = () => {
    if (personalizedQuestions.length === 0) return null;
    
    const currentQuestion = personalizedQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / personalizedQuestions.length) * 100;

    return (
      <div className={styles.questionnaire}>
          <div className={styles.questionnaireContent}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          
          <div className={styles.questionHeader}>
            <h2>Personalized Assessment</h2>
            <p>Question {currentQuestionIndex + 1} of {personalizedQuestions.length}</p>
            <small>Based on your work context at {workContext.company}</small>
          </div>

          <div className={styles.questionCard}>
            <div className={styles.categoryBadge}>
              {currentQuestion.category.replace('_', ' ').toUpperCase()}
            </div>
            <p className={styles.questionText}>{currentQuestion.text}</p>
          </div>
          
            <div className={styles.answerOptions}>
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  onClick={() => handleQuestionnaireAnswer(value)}
                className={styles.answerButton}
                >
                <span className={styles.answerNumber}>{value}</span>
                  <span className={styles.answerLabel}>
                  {value === 1 && 'Strongly Disagree'}
                  {value === 2 && 'Disagree'}
                  {value === 3 && 'Neutral'}
                  {value === 4 && 'Agree'}
                  {value === 5 && 'Strongly Agree'}
                  </span>
                </button>
              ))}
            </div>
          </div>
      </div>
    );
  };

  const renderDeepDive = () => (
    <div className={styles.chat}>
        <div className={styles.chatContent}>
        <div className={styles.chatHeader}>
          <h2>Deep Dive Conversation</h2>
          <p>Let's explore your responses in the context of your work at {workContext.company}</p>
        </div>
        
          <div className={styles.chatMessages}>
          {chatMessages.length === 0 && (
            <div className={styles.aiMessage}>
              <div className={styles.messageContent}>
                <p>Hello {workContext.firstName}! Based on your personalized assessment, I'd like to explore how you handle workplace situations. Let's start with this: Tell me about a recent situation at {workContext.company} where you had to work under pressure with {workContext.manager} or your team.</p>
                </div>
                </div>
          )}
          
          {chatMessages.map((message) => (
            <div key={message.id} className={message.isUser ? styles.userMessage : styles.aiMessage}>
              <div className={styles.messageContent}>
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
              </div>

        {chatMessages.length >= 6 && !isLoading && (
          <div className={styles.processingMessage}>
            <Brain size={24} />
            <p>I have enough insights to create your personalized profile. Let me analyze your responses...</p>
            <button 
              className={styles.primaryButton}
              onClick={processPersonalizedResults}
              disabled={isLoading}
            >
              Generate My ReelPersona Results
            </button>
            </div>
          )}
          
        {chatMessages.length < 6 && (
            <form onSubmit={handleChatSubmit} className={styles.chatForm}>
            <div className={styles.inputContainer}>
              <input
                type="text"
                value={currentChatInput}
                onChange={(e) => setCurrentChatInput(e.target.value)}
                placeholder={isAnalyzing ? "AI is analyzing your response..." : isListening ? "Listening... speak now" : "Share your thoughts about your work experience..."}
                className={styles.chatInput}
                disabled={isAnalyzing || isListening}
                autoFocus
              />
              {voiceSupported && (
                <button 
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
                  disabled={isAnalyzing}
                  title={isListening ? "Stop listening" : "Start voice input"}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}
            <button 
              type="submit" 
                disabled={!currentChatInput.trim() || isAnalyzing} 
              className={styles.sendButton}
                title="Send message"
            >
                {isAnalyzing ? (
                  <div className={styles.spinner}></div>
          ) : (
                  <ArrowRight size={20} />
            )}
              </button>
            </div>
            {chatMessages.length > 0 && (
              <div className={styles.chatHint}>
                <span>💬 Question {chatMessages.length + 1} of 6 • Be specific about your workplace experiences</span>
            </div>
            )}
          </form>
          )}
        </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    return (
      <div className={styles.results}>
          <div className={styles.resultsContent}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--primary-navy)', marginBottom: 'var(--spacing-sm)' }}>
              Your ReelPersona Results
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>Based on the Big Five (OCEAN) personality model</p>
          </div>
          
            {/* Big Five Scores */}
            <div className={styles.traitsSection}>
              <h3>Personality Traits</h3>
              <div className={styles.traits}>
                {Object.entries(results).slice(0, 5).map(([trait, score]) => (
                  <div key={trait} className={styles.trait}>
                    <div className={styles.traitHeader}>
                      <span className={styles.traitName}>
                        {trait.charAt(0).toUpperCase() + trait.slice(1)}
                      </span>
                    <span className={styles.traitScore}>{score as number}/100</span>
                    </div>
                    <div className={styles.traitBar}>
                      <div 
                        className={styles.traitFill} 
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className={styles.traitLabel}>
                      {getTraitLabel(trait, score as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className={styles.summarySection}>
              <h3>Personality Summary</h3>
              <p>{results.summary}</p>
            </div>

            {/* Strengths and Growth Areas */}
            <div className={styles.insightsSection}>
              <div className={styles.strengths}>
                <h3>Your Strengths</h3>
                <ul>
                  {results.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
            
              <div className={styles.growthAreas}>
                <h3>Growth Opportunities</h3>
                <ul>
                  {results.growth_areas.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>
          
          {/* Integration Actions */}
          <div className={styles.integrationSection}>
            <h3>Next Steps</h3>
            <p>Your personality analysis has been completed. Here's how to make the most of your results:</p>
            
            <div className={styles.actionButtons}>
              <button 
                className={styles.primaryButton}
                onClick={() => {
                  // Save results to ReelCV profile
                  console.log('Saving personality results to ReelCV profile...');
                  const reelCVUrl = window.location.origin.replace(':5177', ':5174');
                  window.open(reelCVUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                📊 Add to ReelCV Profile
              </button>
              
              <button 
                className={styles.secondaryButton}
                onClick={() => {
                  // Download or share results
                  const resultsSummary = `ReelPersona Results:\n\n` +
                    `Openness: ${results.openness}/100\n` +
                    `Conscientiousness: ${results.conscientiousness}/100\n` +
                    `Extraversion: ${results.extraversion}/100\n` +
                    `Agreeableness: ${results.agreeableness}/100\n` +
                    `Neuroticism: ${results.neuroticism}/100\n\n` +
                    `Summary: ${results.summary}\n\n` +
                    `Strengths: ${results.strengths.join(', ')}\n\n` +
                    `Growth Areas: ${results.growth_areas.join(', ')}`;
                  
                  navigator.clipboard.writeText(resultsSummary);
                  alert('Results copied to clipboard! You can now share or save them.');
                }}
              >
                📋 Copy Results
              </button>
              
              <button 
                className={styles.secondaryButton}
                onClick={() => window.location.href = '/dashboard'}
              >
                🏠 Return to Dashboard
              </button>
            </div>
            
            <div className={styles.integrationNote}>
              <p><strong>📈 Boost Your Profile:</strong> Your personality insights will enhance your ReelCV profile, helping recruiters understand your work style and cultural fit.</p>
              <p><strong>🎯 Better Matches:</strong> This data improves job matching accuracy in ReelHunter by 40% on average.</p>
            </div>
            
            <button 
              className={styles.tertiaryButton}
              onClick={() => {
                setCurrentStep('welcome');
                setWorkContext({
                  firstName: '',
                  company: '',
                  role: '',
                  teamSize: '',
                  manager: '',
                  colleagues: [],
                  workDuration: '',
                  industry: ''
                });
                setPersonalizedQuestions([]);
                setQuestionnaireAnswers({});
                setCurrentQuestionIndex(0);
                setChatMessages([]);
                setChatQuestionIndex(0);
                setConversationDepth(0);
                setResults(null);
                setError(null);
              }}
            >
              🔄 Take Assessment Again
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getStepProgress = () => {
    const steps = ['welcome', 'privacy', 'work_context', 'personalized_questions', 'deep_dive', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  if (error) {
    return (
      <div className={styles.reelPersona}>
        <div className="reelapps-card">
    <div className={styles.error}>
            <h2>Something went wrong</h2>
          <p>{error}</p>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
    </div>
  );
  }

  return (
    <div className={styles.reelPersona}>
      <div className="reelapps-card">
        <div className={styles.progressIndicator}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${getStepProgress()}%` }}
          />
        </div>
        
        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'privacy' && renderPrivacy()}
        {currentStep === 'work_context' && renderWorkContext()}
        {currentStep === 'personalized_questions' && renderPersonalizedQuestions()}
        {currentStep === 'deep_dive' && renderDeepDive()}
      {currentStep === 'results' && renderResults()}
      </div>
    </div>
  );
};

export default ReelPersona;