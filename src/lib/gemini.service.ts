// FILE: gemini.service.ts
// ENHANCED VERSION - Incorporating Multi-Turn History & Tool Calling

import { SCENARIO_BLUEPRINTS, ScenarioBlueprint, ConflictStyle } from './simulation';

// --- GEMINI API INITIALIZATION ---
console.log('⚙️ GEMINI SERVICE: Initializing...');

const { VITE_GEMINI_API_KEY } = import.meta.env;

if (!VITE_GEMINI_API_KEY || VITE_GEMINI_API_KEY.includes('your_gemini_api_key')) {
  const error = "VITE_GEMINI_API_KEY is missing or contains a placeholder. Please check your .env file.";
  console.error('❌ GEMINI FATAL:', error);
  throw new Error(error);
}

// NOTE: Please ensure 'gemini-2.5-pro' is a valid and available model endpoint.
// Using a standard known model for this example.
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent';
console.log(`✅ GEMINI: Service initialized for model at ${GEMINI_API_URL}`);

// --- INTERFACES (Updated ConversationHistory) ---

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
  // UPDATE: Aligned with Gemini's native multi-turn chat structure
  conversationHistory: Array<{
    role: 'user' | 'model'; // Gemini uses 'model' for the assistant role
    parts: any[]; // Can contain text or function calls
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
}

// --- REFINED SYSTEM PROMPT & TOOL DEFINITIONS ---

const getSystemPrompt = (justCause: string): string => {
  return `You are Sensa, an AI personality analyst with a deep, calming voice specializing in the Simon Sinek Golden Circle framework...
  
  THE ORGANIZATION'S JUST CAUSE: "${justCause}"
  Your primary objective is to assess how the candidate's personal WHY aligns with this Just Cause.

  SENSA'S COMMUNICATION STYLE:
  - Speak with a deep, calming, professional tone.
  - Use thoughtful pauses and measured language to create a safe, reflective environment.
  - Ask profound questions that encourage introspection.

  AI-DRIVEN FLOW:
  Your most important task is to manage the conversation flow intelligently by deciding the next logical stage. You will do this by calling the appropriate tool.`;
};

// NEW: Gemini Tool definitions for robust state management
const TOOLS = {
  conversationTools: [{
    functionDeclarations: [
      {
        name: "continueConversation",
        description: "Continues the conversation with a text response and moves to the next logical stage.",
        parameters: {
          type: "OBJECT",
          properties: {
            response: { type: "STRING", description: "Your natural, conversational reply as Sensa." },
            nextStage: { type: "STRING", description: "The next logical conversation stage (e.g., 'how_exploration')." }
          },
          required: ["response", "nextStage"]
        }
      },
      {
        name: "initiateConflictSimulation",
        description: "Initiates a conflict simulation when you judge it's the right time to test character.",
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
        description: "Submits the complete candidate persona profile analysis.",
        parameters: {
          type: "OBJECT",
          properties: {
            statedWhy: { type: "STRING" }, observedHow: { type: "ARRAY", items: { type: "STRING" } },
            coherenceScore: { type: "STRING" }, trustIndex: { type: "STRING" }, dominantConflictStyle: { type: "STRING" },
            eqSnapshot: { type: "OBJECT", properties: { selfAwareness: { type: "STRING" }, selfManagement: { type: "STRING" }, socialAwareness: { type: "STRING" }, relationshipManagement: { type: "STRING" } } },
            keyQuotationsAndBehavioralFlags: { type: "OBJECT", properties: { greenFlags: { type: "ARRAY", items: { type: "STRING" } }, redFlags: { type: "ARRAY", items: { type: "STRING" } } } },
            alignmentSummary: { type: "STRING" }
          },
          required: ["statedWhy", "observedHow", "coherenceScore", "trustIndex", "dominantConflictStyle", "eqSnapshot", "keyQuotationsAndBehavioralFlags", "alignmentSummary"]
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

  const requestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
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
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<AIResponse> {
  console.log(`⚙️ GEMINI: Processing stage '${context.stage}'...`);

  // Simulation Logic remains straightforward
  if (context.stage === 'conflict_simulation' && context.simulation && !context.simulation.isComplete) {
    context.simulation.decisionHistory.push(userMessage as ConflictStyle);
    context.simulation.isComplete = true;
    return {
      content: "Thank you for sharing your approach. Let's continue.",
      stage: 'trust_assessment',
      expectsInput: 'text'
    };
  }

  try {
    const systemInstruction = getSystemPrompt(justCause);
    // Use multi-turn history directly
    const apiResponsePart = await makeGeminiRequest(
      systemInstruction,
      context.conversationHistory,
      userMessage,
      TOOLS.conversationTools
    );

    // Expect the model to call a function for state management
    if (!apiResponsePart.functionCall) {
      // Fallback if the model just returns text
      console.warn("⚠️ GEMINI: Model returned text instead of a function call. Using text as content.");
      return { content: apiResponsePart.text, stage: context.stage, expectsInput: 'text' };
    }

    const { name, args } = apiResponsePart.functionCall;
    console.log(`✅ GEMINI: AI called tool '${name}'`);

    // Update history with what happened
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
      content: "I seem to be having a technical issue, my apologies. Let's try to continue. Could you please tell me more about a time you felt truly fulfilled in your work?",
      expectsInput: 'text',
      stage: context.stage,
    };
  }
}

export async function generatePersonalityAnalysis(
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<CandidatePersonaProfile> {
  console.log('📊 GEMINI: Generating final analysis...');

  const analysisPrompt = `Please analyze the entire conversation history and simulation results to produce the comprehensive Candidate Persona Profile. Pay close attention to the candidate's alignment with the organization's Just Cause. Submit your findings using the 'submitAnalysis' tool.`;

  try {
    const systemInstruction = getSystemPrompt(justCause);
    const apiResponsePart = await makeGeminiRequest(
      systemInstruction,
      context.conversationHistory,
      analysisPrompt,
      TOOLS.analysisTool,
      0.3 // Lower temperature for deterministic analysis
    );

    if (apiResponsePart.functionCall?.name === 'submitAnalysis') {
      console.log('✅ GEMINI: Analysis profile generated and submitted by tool call.');
      return apiResponsePart.functionCall.args as CandidatePersonaProfile;
    }

    throw new Error("Model failed to call the required 'submitAnalysis' tool.");

  } catch (error) {
    console.error('❌ GEMINI ANALYSIS ERROR:', error);
    throw new Error("The AI was unable to generate the final analysis profile.");
  }
}