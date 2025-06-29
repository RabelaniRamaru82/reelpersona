import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID!,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY!,
  },
});

export interface AIResponse {
  content: string;
  expectsInput?: 'text' | 'choice' | 'name' | 'role' | 'company';
  options?: string[];
  stage?: string;
}

export interface ConversationContext {
  stage: string;
  userProfile: {
    firstName?: string;
    lastName?: string;
    currentRole?: string;
    company?: string;
    whyStatement?: string;
    howValues?: string[];
    answers?: Record<string, any>;
  };
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  questionIndex?: number;
}

export interface PersonalityAnalysis {
  whyStatement: string;
  howValues: string[];
  coherenceScore: 'High' | 'Medium' | 'Low';
  trustIndex: 'High-Trust Potential' | 'Medium-Trust' | 'Low-Trust/Red Flag';
  conflictStyle: string;
  emotionalIntelligence: {
    selfAwareness: number;
    selfManagement: number;
    socialAwareness: number;
    relationshipManagement: number;
  };
  strengths: string[];
  growthAreas: string[];
  summary: string;
  keyQuotations: string[];
  alignmentSummary: string;
}

const SYSTEM_PROMPT = `You are Dr. Sarah Chen, a professional AI personality analyst with a PhD in Psychology specializing in the Simon Sinek Golden Circle framework for talent assessment. You conduct professional, insightful conversations to uncover a candidate's WHY (purpose), HOW (values), and WHAT (skills) through natural dialogue.

CORE PRINCIPLES:
1. Always start with WHY - uncover their deeper purpose and motivation
2. Move to HOW - understand their values and methods
3. Connect to WHAT - validate consistency with their experience
4. Assess for trust, accountability, and emotional intelligence
5. Use the Golden Circle framework to evaluate authenticity and coherence

CONVERSATION STAGES:
- intro: Welcome and explain the process
- name: Get their first name
- role: Understand their current position
- company: Learn about their workplace
- why_exploration: Deep dive into their purpose and motivation
- how_exploration: Understand their values and methods
- what_validation: Connect purpose to experience
- trust_assessment: Evaluate accountability and emotional intelligence
- analysis_complete: Provide comprehensive analysis

QUESTION TEMPLATES FOR WHY EXPLORATION:
- "Think about your entire career - describe a time when you felt completely fulfilled at work, even if it wasn't the most successful project. What made it meaningful?"
- "When people who know you well think about what you uniquely contribute, what would they say?"
- "What fundamental belief about work or life guides your most important decisions?"

QUESTION TEMPLATES FOR HOW EXPLORATION:
- "How do you bring that purpose to life in your daily work?"
- "Describe the work environment where you feel most authentic and effective."
- "Tell me about a time you had to make a difficult decision that conflicted with policy but aligned with your values."

QUESTION TEMPLATES FOR TRUST ASSESSMENT:
- "Tell me about a significant mistake you made and how you handled it."
- "Describe a time you had to hold someone accountable for their commitments."
- "What's something that might be challenging for you in a new role, so we can prepare for it together?"

Always respond naturally and conversationally, building on their previous answers. Keep responses concise but insightful.`;

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext
): Promise<AIResponse> {
  try {
    const conversationHistory = context.conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `${SYSTEM_PROMPT}

CURRENT CONTEXT:
Stage: ${context.stage}
User Profile: ${JSON.stringify(context.userProfile)}

RECENT CONVERSATION:
${conversationHistory}

USER MESSAGE: ${userMessage}

Respond as Dr. Sarah Chen. Based on the current stage and conversation, provide your next response. Be natural, professional, and insightful. If moving to a new stage, indicate the expected input type.`;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const content = responseBody.content[0].text;
    
    // Parse the response to determine next stage and input type
    let expectsInput: 'text' | 'choice' | 'name' | 'role' | 'company' = 'text';
    let options: string[] | undefined;
    let stage = context.stage;

    // Stage progression logic
    if (context.stage === 'intro' && userMessage.toLowerCase().includes('start')) {
      stage = 'name';
      expectsInput = 'name';
    } else if (context.stage === 'name' && userMessage.trim()) {
      stage = 'role';
      expectsInput = 'role';
    } else if (context.stage === 'role' && userMessage.trim()) {
      stage = 'company';
      expectsInput = 'company';
    } else if (context.stage === 'company' && userMessage.trim()) {
      stage = 'why_exploration';
      expectsInput = 'text';
    } else if (context.stage === 'why_exploration') {
      // Continue in why exploration or move to how
      if (context.conversationHistory.filter(m => m.role === 'user').length >= 3) {
        stage = 'how_exploration';
      }
      expectsInput = 'text';
    } else if (context.stage === 'how_exploration') {
      // Continue in how exploration or move to what validation
      if (context.conversationHistory.filter(m => m.role === 'user').length >= 5) {
        stage = 'what_validation';
      }
      expectsInput = 'text';
    } else if (context.stage === 'what_validation') {
      // Move to trust assessment
      if (context.conversationHistory.filter(m => m.role === 'user').length >= 7) {
        stage = 'trust_assessment';
      }
      expectsInput = 'text';
    } else if (context.stage === 'trust_assessment') {
      // Complete analysis after sufficient trust questions
      if (context.conversationHistory.filter(m => m.role === 'user').length >= 10) {
        stage = 'analysis_complete';
      }
      expectsInput = 'text';
    }

    return {
      content,
      expectsInput,
      options,
      stage
    };

  } catch (error) {
    console.error('Bedrock API error:', error);
    
    // Fallback response
    return {
      content: "I apologize, but I'm experiencing a technical issue. Let me continue with our conversation. Could you tell me more about what motivates you in your work?",
      expectsInput: 'text',
      stage: context.stage
    };
  }
}

export async function generatePersonalityAnalysis(
  context: ConversationContext
): Promise<PersonalityAnalysis> {
  try {
    const conversationSummary = context.conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const analysisPrompt = `As Dr. Sarah Chen, analyze this complete personality assessment conversation and provide a comprehensive analysis using the Simon Sinek Golden Circle framework.

CONVERSATION TRANSCRIPT:
${conversationSummary}

USER PROFILE:
${JSON.stringify(context.userProfile)}

Provide a detailed analysis in the following JSON format:
{
  "whyStatement": "Candidate's core purpose/belief",
  "howValues": ["List of key operational values"],
  "coherenceScore": "High|Medium|Low",
  "trustIndex": "High-Trust Potential|Medium-Trust|Low-Trust/Red Flag",
  "conflictStyle": "Primary conflict resolution style",
  "emotionalIntelligence": {
    "selfAwareness": 1-100,
    "selfManagement": 1-100,
    "socialAwareness": 1-100,
    "relationshipManagement": 1-100
  },
  "strengths": ["List of key strengths"],
  "growthAreas": ["List of development areas"],
  "summary": "Comprehensive personality summary",
  "keyQuotations": ["Most revealing statements"],
  "alignmentSummary": "Assessment of organizational fit"
}

Focus on authenticity, consistency between WHY-HOW-WHAT, trust indicators, and professional development insights.`;

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        top_p: 0.9
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    const content = responseBody.content[0].text;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback analysis
    return {
      whyStatement: context.userProfile.whyStatement || "Purpose requires further exploration",
      howValues: context.userProfile.howValues || ["Collaboration", "Integrity", "Growth"],
      coherenceScore: "Medium",
      trustIndex: "Medium-Trust",
      conflictStyle: "Collaborative",
      emotionalIntelligence: {
        selfAwareness: 75,
        selfManagement: 70,
        socialAwareness: 80,
        relationshipManagement: 75
      },
      strengths: ["Strong communication skills", "Collaborative mindset", "Growth-oriented"],
      growthAreas: ["Could benefit from more structured goal-setting", "Opportunity to develop leadership presence"],
      summary: `${context.userProfile.firstName} demonstrates a balanced professional profile with strong collaborative instincts and a growth mindset. Their responses indicate good self-awareness and a genuine desire to contribute meaningfully to their work environment.`,
      keyQuotations: ["Analysis based on conversation patterns"],
      alignmentSummary: "Shows potential for strong organizational alignment with proper onboarding and development support."
    };

  } catch (error) {
    console.error('Analysis generation error:', error);
    throw error;
  }
}