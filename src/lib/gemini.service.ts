// FILE: gemini.service.ts
// ENHANCED & RE-FOCUSED VERSION

import { SCENARIO_BLUEPRINTS, ScenarioBlueprint, ConflictStyle } from './simulation';

// --- GEMINI API INITIALIZATION ---
console.log('⚙️ GEMINI SERVICE: Initializing...');

const { VITE_GEMINI_API_KEY } = import.meta.env;

if (!VITE_GEMINI_API_KEY || VITE_GEMINI_API_KEY.includes('your_gemini_api_key')) {
  const error = "VITE_GEMINI_API_KEY is missing or contains a placeholder. Please check your .env file.";
  console.error('❌ GEMINI FATAL:', error);
  throw new Error(error);
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
console.log(`✅ GEMINI: Service initialized for model at ${GEMINI_API_URL}`);

// --- INTERFACES (Updated with Job Performance Indicators) ---

export interface AIResponse {
  content: string;
  expectsInput?: 'text' | 'choice';
  options?: string[];
  stage: string;
  simulationData?: {
    openingScene: string;
    prompt: string;
    choices: { text: string; style: ConflictStyle }[];
  }
}

export interface SimulationState {
  scenario: ScenarioBlueprint;
  decisionHistory: ConflictStyle[];
  isComplete: boolean;
}

export interface ConversationContext {
  stage: string;
  userProfile: {
    firstName?: string;
    whyStatement?: string;
    howValues?: string[];
    answers: Record<string, any>;
  };
  conversationHistory: Array<{
    role: 'user' | 'model';
    parts: any[];
  }>;
  simulation?: SimulationState;
}

export interface CandidatePersonaProfile {
  statedWhy: string;
  observedHow: string[];
  coherenceScore: 'High' | 'Medium' | 'Low';
  trustIndex: 'High-Trust Potential' | 'Medium-Trust' | 'Low-Trust/Red Flag';
  dominantConflictStyle: ConflictStyle | 'Undetermined';
  eqSnapshot: { selfAwareness: string; selfManagement: string; socialAwareness: string; relationshipManagement: string; };
  keyQuotationsAndBehavioralFlags: { greenFlags: string[]; redFlags: string[]; };
  alignmentSummary: string;
  // NEW: Added a dedicated section for job performance analysis.
  jobPerformanceIndicators: {
    potentialStrengths: string[];
    potentialChallenges: string[];
  };
}

// --- REFINED SYSTEM PROMPT & TOOL DEFINITIONS (PERFORMANCE-FOCUSED) ---

const getSystemPrompt = (justCause: string, jobRole: string): string => {
  return `You are an AI Talent Strategist. Your specialization is using the Simon Sinek Golden Circle framework to predict a candidate's future job performance and cultural contribution.

  THE ORGANIZATION'S JUST CAUSE: "${justCause}"
  THE TARGET ROLE: "${jobRole}"

  PRIMARY OBJECTIVE:
  Your goal is to understand the candidate's core motivations (WHY) and their operational values (HOW) to predict how they will perform their job functions (WHAT). You must constantly seek to connect their personal drivers to tangible, on-the-job behaviors.

  COMMUNICATION STYLE:
  - Professional, insightful, and clear.
  - Efficient and respectful of the candidate's time.
  - Create a focused environment where the candidate feels comfortable sharing concrete examples.

  AI-DRIVEN FLOW:
  Your most important task is to manage the conversation flow intelligently by deciding the next logical stage. You will do this by calling the appropriate tool. Always guide the conversation towards understanding how their personal values translate into work-related actions.`;
};

// UPDATED: The analysis tool now includes job performance indicators.
const TOOLS = {
  conversationTools: [{
    functionDeclarations: [
      {
        name: "continueConversation",
        description: "Continues the conversation with a text response and moves to the next logical stage.",
        parameters: {
          type: "OBJECT",
          properties: {
            response: { type: "STRING", description: "Your professional and insightful reply." },
            nextStage: { type: "STRING", description: "The next logical conversation stage (e.g., 'how_exploration')." }
          },
          required: ["response", "nextStage"]
        }
      },
      {
        name: "initiateConflictSimulation",
        description: "Initiates a conflict simulation to observe behavior under pressure.",
        parameters: {
          type: "OBJECT",
          properties: {
            response: { type: "STRING", description: "Your transitional text to introduce the simulation." }
          },
          required: ["response"]
        }
      }
    ]
  }],
  analysisTool: [{
    functionDeclarations: [
      {
        name: "submitAnalysis",
        description: "Submits the complete candidate persona and performance profile.",
        parameters: {
          type: "OBJECT",
          properties: {
            statedWhy: { type: "STRING" },
            observedHow: { type: "ARRAY", items: { type: "STRING" } },
            coherenceScore: { type: "STRING" },
            trustIndex: { type: "STRING" },
            dominantConflictStyle: { type: "STRING" },
            eqSnapshot: { type: "OBJECT", properties: { selfAwareness: { type: "STRING" }, selfManagement: { type: "STRING" }, socialAwareness: { type: "STRING" }, relationshipManagement: { type: "STRING" } } },
            keyQuotationsAndBehavioralFlags: { type: "OBJECT", properties: { greenFlags: { type: "ARRAY", items: { type: "STRING" } }, redFlags: { type: "ARRAY", items: { type: "STRING" } } } },
            alignmentSummary: { type: "STRING" },
            // NEW: Added job performance indicators to the tool's parameters.
            jobPerformanceIndicators: {
              type: "OBJECT",
              properties: {
                potentialStrengths: { type: "ARRAY", items: { type: "STRING" }, description: "List of strengths directly relevant to job performance." },
                potentialChallenges: { type: "ARRAY", items: { type: "STRING" }, description: "List of potential on-the-job challenges or areas for coaching." }
              },
              required: ["potentialStrengths", "potentialChallenges"]
            }
          },
          required: ["statedWhy", "observedHow", "coherenceScore", "trustIndex", "dominantConflictStyle", "eqSnapshot", "keyQuotationsAndBehavioralFlags", "alignmentSummary", "jobPerformanceIndicators"]
        }
      }
    ]
  }]
};

// --- REFACTORED API REQUEST FUNCTION ---
async function makeGeminiRequest(
  systemInstruction: string,
  history: ConversationContext['conversationHistory'],
  prompt: string,
  tools: any[],
  temperature: number = 0.7
): Promise<any> {
  console.log(`🤖 GEMINI: Making API request...`);

  // FIX: Sanitize the history to ensure it matches the Gemini API's expected format.
  // This handles legacy formats that might still be in the context state, which causes the 400 error.
  const sanitizedHistory = history.map((msg: any) => {
    // If the message already has 'parts', it's in the new format.
    // Just ensure the role is 'model' instead of 'assistant'.
    if (msg.parts) {
      return {
        ...msg,
        role: msg.role === 'assistant' ? 'model' : msg.role,
      };
    }
    // If the message has 'content' (legacy format), convert it.
    if (msg.content) {
      return {
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content as string }],
      };
    }
    // If the message is somehow malformed, filter it out to prevent API errors.
    console.warn("⚠️ GEMINI: Filtering out malformed history message:", msg);
    return null;
  }).filter(Boolean) as ConversationContext['conversationHistory'];


  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [...sanitizedHistory, { role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 4096 },
    tools,
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${VITE_GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ GEMINI API Error:', { status: response.status, body: errorText });
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const responseData = await response.json();

  if (!responseData.candidates?.[0]?.content?.parts?.[0]) {
    console.error('❌ GEMINI Invalid Response:', responseData);
    throw new Error('Invalid or empty response structure from Gemini API');
  }

  return responseData.candidates[0].content.parts[0];
}

// --- REFACTORED CORE FUNCTIONS ---

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext,
  justCause: string,
  jobRole: string // Pass the specific job role for context
): Promise<AIResponse> {
  console.log(`⚙️ GEMINI: Processing stage '${context.stage}' for role '${jobRole}'...`);

  if (context.stage === 'conflict_simulation' && context.simulation && !context.simulation.isComplete) {
    context.simulation.decisionHistory.push(userMessage as ConflictStyle);
    context.simulation.isComplete = true;
    return {
      content: "Thank you for working through that scenario. Let's continue.",
      stage: 'trust_assessment',
      expectsInput: 'text'
    };
  }

  try {
    const systemInstruction = getSystemPrompt(justCause, jobRole);
    const apiResponsePart = await makeGeminiRequest(
      systemInstruction,
      context.conversationHistory,
      userMessage,
      TOOLS.conversationTools
    );

    if (!apiResponsePart.functionCall) {
      console.warn("⚠️ GEMINI: Model returned text instead of a function call. Using text as content.");
      return { content: apiResponsePart.text || "I'm sorry, I need a moment to process that. Could you please rephrase?", stage: context.stage, expectsInput: 'text' };
    }

    const { name, args } = apiResponsePart.functionCall;
    console.log(`✅ GEMINI: AI called tool '${name}'`);

    context.conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
    context.conversationHistory.push({ role: 'model', parts: [apiResponsePart] });

    if (name === 'initiateConflictSimulation') {
      const scenario = SCENARIO_BLUEPRINTS[Math.floor(Math.random() * SCENARIO_BLUEPRINTS.length)];
      context.simulation = { scenario, decisionHistory: [], isComplete: false };
      return {
        content: args.response,
        stage: 'conflict_simulation',
        expectsInput: 'choice',
        simulationData: {
          openingScene: scenario.openingScene,
          prompt: scenario.decisionPoints[0].prompt,
          choices: scenario.decisionPoints[0].choices,
        }
      };
    }

    if (name === 'continueConversation') {
      return {
        content: args.response,
        stage: args.nextStage,
        expectsInput: 'text'
      };
    }

    throw new Error(`Unknown function call received from model: ${name}`);

  } catch (error) {
    console.error('❌ GEMINI CONVERSATION ERROR:', error);
    return {
      content: "I seem to be having a technical issue. Let's try to continue. Could you tell me more about a time you felt truly fulfilled in your work?",
      expectsInput: 'text',
      stage: context.stage,
    };
  }
}

export async function generatePersonalityAnalysis(
  context: ConversationContext,
  justCause: string,
  jobRole: string // Pass the job role for the final analysis
): Promise<CandidatePersonaProfile> {
  console.log('📊 GEMINI: Generating final performance analysis...');

  const analysisPrompt = `Please analyze the entire conversation history and simulation results to produce the comprehensive Candidate Persona Profile.
  - Critically evaluate how the candidate's personal drivers will translate into on-the-job performance for the **${jobRole}** role.
  - For the 'jobPerformanceIndicators', provide concrete, actionable insights for a hiring manager.
  - Submit your complete findings using the 'submitAnalysis' tool.`;

  try {
    const systemInstruction = getSystemPrompt(justCause, jobRole);
    const apiResponsePart = await makeGeminiRequest(
      systemInstruction,
      context.conversationHistory,
      analysisPrompt,
      TOOLS.analysisTool,
      0.3
    );

    if (apiResponsePart.functionCall?.name === 'submitAnalysis') {
      console.log('✅ GEMINI: Performance analysis profile generated successfully.');
      return apiResponsePart.functionCall.args as CandidatePersonaProfile;
    }

    throw new Error("Model failed to call the required 'submitAnalysis' tool.");

  } catch (error) {
    console.error('❌ GEMINI ANALYSIS ERROR:', error);
    throw new Error("The AI was unable to generate the final analysis profile.");
  }
}
