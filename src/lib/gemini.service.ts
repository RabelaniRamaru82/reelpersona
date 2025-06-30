// FILE: gemini.service.ts

import { SCENARIO_BLUEPRINTS, ScenarioBlueprint, ConflictStyle } from './simulation';

// --- GEMINI API INITIALIZATION ---
console.log('🔍 GEMINI SERVICE: Starting initialization...');

const { VITE_GEMINI_API_KEY } = import.meta.env;

console.log('🔍 GEMINI ENV CHECK:', {
  hasApiKey: !!VITE_GEMINI_API_KEY,
  apiKeyPrefix: VITE_GEMINI_API_KEY ? VITE_GEMINI_API_KEY.substring(0, 8) + '...' : 'MISSING'
});

if (!VITE_GEMINI_API_KEY) {
  const error = "Missing required VITE_GEMINI_API_KEY environment variable for Gemini API.";
  console.error('❌ GEMINI ERROR:', error);
  throw new Error(error);
}

// Check for placeholder values that indicate invalid credentials
if (VITE_GEMINI_API_KEY === 'your_gemini_api_key_here' ||
    VITE_GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
  const error = "Please replace the placeholder Gemini API key in your .env file with a valid API key.";
  console.error('❌ GEMINI ERROR:', error);
  throw new Error(error);
}

console.log('✅ GEMINI: Environment variables validated');

const GEMINI_API_URL = '[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent)';

console.log('✅ GEMINI: Service initialized');

// --- HELPER FUNCTION ---

/**
 * Extracts a JSON object string from a larger string, potentially wrapped in Markdown.
 * @param text The string to search within.
 * @returns The extracted JSON string, or the original text if no JSON object is found.
 */
function extractJsonFromString(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
        return jsonMatch[0];
    }
    // Fallback to the original text if no match is found, in case the API returns clean JSON.
    return text;
}


// --- INTERFACES ---

/**
 * Represents the AI's response to the user. Includes conversational content
 * and structured data for controlling the frontend application.
 */
export interface AIResponse {
  content: string;
  expectsInput?: 'text' | 'choice';
  options?: string[];
  stage: string;
  // This field can be used to pass simulation data to the frontend
  simulationData?: {
    openingScene: string;
    prompt: string;
    choices: { text: string; style: ConflictStyle }[];
  }
}

/**
 * Represents the state of the conflict simulation, if one is active.
 * This is stored within the main conversation context.
 */
export interface SimulationState {
  scenario: ScenarioBlueprint;
  decisionHistory: ConflictStyle[];
  isComplete: boolean;
}

/**
 * The main context object that tracks the entire conversation state,
 * including the new simulation state.
 */
export interface ConversationContext {
  stage: string;
  userProfile: {
    firstName?: string;
    whyStatement?: string;
    howValues?: string[];
    // A record of all answers for the final analysis
    answers: Record<string, any>;
  };
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  simulation?: SimulationState;
}

/**
 * The final analysis profile, structured to exactly match the
 * "Candidate Persona Profile" from Part 4.2 of the research document.
 */
export interface CandidatePersonaProfile {
  statedWhy: string;
  observedHow: string[];
  coherenceScore: 'High' | 'Medium' | 'Low';
  trustIndex: 'High-Trust Potential' | 'Medium-Trust' | 'Low-Trust/Red Flag';
  dominantConflictStyle: ConflictStyle | 'Undetermined';
  eqSnapshot: {
    selfAwareness: string; // Descriptive analysis is more insightful than a raw score
    selfManagement: string;
    socialAwareness: string;
    relationshipManagement: string;
  };
  keyQuotationsAndBehavioralFlags: {
    greenFlags: string[];
    redFlags: string[];
  };
  alignmentSummary: string; // Explicitly assesses fit with the company's Just Cause
}

// --- DYNAMIC SYSTEM PROMPT GENERATION ---

const getSystemPrompt = (justCause: string, isSimulation: boolean = false): string => {
  if (isSimulation) {
    return `You are Sensa, a simulation engine. The user has made a choice in a conflict scenario. Based on their choice, provide a brief concluding remark for the simulation and transition to the next stage of the interview. Your entire response MUST be a single JSON object: {"response": "Your concluding remark.", "nextStage": "trust_assessment"}`;
  }

  return `You are Sensa, an AI personality analyst with a deep, calming voice specializing in the Simon Sinek Golden Circle framework. Your goal is to conduct a natural, professional conversation to uncover a candidate's persona with a thoughtful, measured approach.

  THE ORGANIZATION'S JUST CAUSE: "${justCause}"
  Your primary objective is to assess how the candidate's personal WHY aligns with this Just Cause.

  CORE PRINCIPLES:
  1. Assess for alignment with the Just Cause.
  2. Uncover their WHY (purpose), HOW (values), and WHAT (experience).
  3. Evaluate the coherence between WHY, HOW, and WHAT for authenticity.
  4. Assess for trust, accountability, and emotional intelligence (EQ).
  5. If the conversation naturally flows towards assessing character under pressure, you can decide to initiate a conflict simulation.

  CONVERSATION STAGES:
  - intro: Welcome and explain the process with calming professionalism.
  - name: Get their first name.
  - why_exploration: Deep dive into their purpose (use 'Why' question templates).
  - how_exploration: Understand their values and methods based on their 'Why'.
  - what_validation: Connect their purpose to tangible experiences.
  - conflict_simulation: Initiate and run a conflict scenario.
  - trust_assessment: Ask about accountability, failures, and EQ (use 'Trust' question templates).
  - analysis_complete: Conclude the conversation.

  SENSA'S COMMUNICATION STYLE:
  - Speak with a deep, calming, professional tone
  - Use thoughtful pauses and measured language
  - Create a safe, reflective environment
  - Ask profound questions that encourage introspection
  - Show genuine interest in the person's deeper motivations
  - Use language that feels warm but professional

  AI-DRIVEN FLOW:
  Your most important task is to manage the conversation flow intelligently. Based on the user's response, decide the next logical stage.
 
  Your entire response MUST be a single, valid JSON object with this structure:
  {
    "response": "Your natural, conversational reply as Sensa with deep, calming professionalism.",
    "nextStage": "the_next_stage_name"
  }

  Example transition: If the user gives a powerful 'Why' statement, you should set nextStage to 'how_exploration'. If you feel it's the right time to test their character, you can set nextStage to 'conflict_simulation'.`;
};

// --- GEMINI API REQUEST FUNCTION ---
async function makeGeminiRequest(prompt: string, temperature: number = 0.7): Promise<string> {
  console.log('🤖 GEMINI: Making API request');
  console.log('🤖 GEMINI: Prompt length:', prompt.length);
  console.log('🤖 GEMINI: Temperature:', temperature);

  try {
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('🤖 GEMINI: Request body prepared');

    const response = await fetch(`${GEMINI_API_URL}?key=${VITE_GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('🤖 GEMINI: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ GEMINI: API error response:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ GEMINI: Response received');

    if (!responseData.candidates || !responseData.candidates[0] || !responseData.candidates[0].content) {
      console.error('❌ GEMINI: Invalid response structure:', responseData);
      throw new Error('Invalid response structure from Gemini API');
    }

    const content = responseData.candidates[0].content.parts[0].text;
    console.log('✅ GEMINI: Content extracted, length:', content.length);
   
    return content;

  } catch (error) {
    console.error('❌ GEMINI: Request failed:', error);
    throw error;
  }
}

// --- CORE CONVERSATION AND SIMULATION FUNCTION ---

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<AIResponse> {
  console.log('🤖 GEMINI: generateAIResponse called');
  console.log('🤖 INPUT:', {
    userMessage: userMessage.substring(0, 100) + '...',
    stage: context.stage,
    historyLength: context.conversationHistory.length,
    justCause: justCause.substring(0, 50) + '...'
  });

  // --- Simulation Logic ---
  // If we are currently in a simulation, handle the user's choice.
  if (context.stage === 'conflict_simulation' && context.simulation && !context.simulation.isComplete) {
      console.log('🎭 GEMINI: Processing simulation choice');
      const chosenStyle = userMessage as ConflictStyle; // Assume frontend sends the style of the chosen option
      context.simulation.decisionHistory.push(chosenStyle);
      context.simulation.isComplete = true;

      // Ask the AI for a concluding remark before moving on
      const prompt = getSystemPrompt(justCause, true);
      console.log('🎭 GEMINI: Sending simulation conclusion request');
     
      try {
        const rawContent = await makeGeminiRequest(prompt, 0.3);
        console.log('✅ GEMINI: Simulation response received');
       
        // FIX: Extract the JSON object from the potentially Markdown-wrapped response
        const jsonString = extractJsonFromString(rawContent);
        const aiOutput = JSON.parse(jsonString);
        console.log('🎭 GEMINI: Parsed simulation AI output:', aiOutput);

        return {
            content: aiOutput.response,
            stage: aiOutput.nextStage, // AI transitions to the next stage
            expectsInput: 'text'
        };
      } catch (error) {
        console.error('❌ GEMINI SIMULATION ERROR:', error);
        throw error;
      }
  }

  // --- Standard Conversation Logic ---
  console.log('💬 GEMINI: Processing standard conversation');
 
  try {
    context.conversationHistory.push({ role: 'user', content: userMessage });
    const conversationHistoryText = context.conversationHistory.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join('\n');

    const prompt = `${getSystemPrompt(justCause)}

    CURRENT CONTEXT:
    Stage: ${context.stage}
    User Profile: ${JSON.stringify(context.userProfile)}
    RECENT CONVERSATION:
    ${conversationHistoryText}
   
    Respond as Sensa with your characteristic deep, calming professionalism in the required JSON format.`;

    console.log('💬 GEMINI: Prepared prompt (first 200 chars):', prompt.substring(0, 200) + '...');

    const rawContent = await makeGeminiRequest(prompt, 0.7);
    console.log('✅ GEMINI: Response received');

    // FIX: Extract the JSON object from the potentially Markdown-wrapped response
    const jsonString = extractJsonFromString(rawContent);
    const aiOutput = JSON.parse(jsonString);
    console.log('💬 GEMINI: AI output parsed:', {
      responseLength: aiOutput.response?.length || 0,
      nextStage: aiOutput.nextStage,
      hasResponse: !!aiOutput.response
    });

    // --- Handle AI's Decision to Start a Simulation ---
    if (aiOutput.nextStage === 'conflict_simulation') {
        console.log('🎭 GEMINI: AI decided to start simulation');
        const scenario = SCENARIO_BLUEPRINTS[Math.floor(Math.random() * SCENARIO_BLUEPRINTS.length)];
        console.log('🎭 GEMINI: Selected scenario:', scenario.id);
       
        context.simulation = {
            scenario,
            decisionHistory: [],
            isComplete: false,
        };
        return {
            content: aiOutput.response, // AI's transition text
            stage: 'conflict_simulation',
            expectsInput: 'choice',
            simulationData: {
              openingScene: scenario.openingScene,
              prompt: scenario.decisionPoints[0].prompt,
              choices: scenario.decisionPoints[0].choices,
            }
        };
    }

    context.conversationHistory.push({ role: 'assistant', content: aiOutput.response });
   
    console.log('✅ GEMINI: Standard conversation completed successfully');
    return {
      content: aiOutput.response,
      stage: aiOutput.nextStage,
      expectsInput: 'text'
    };

  } catch (error) {
    console.error('❌ GEMINI CONVERSATION ERROR:', error);
    console.error('❌ ERROR DETAILS:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
   
    // Provide more specific error handling for API issues
    if (error instanceof Error && error.message.includes('API key')) {
      const enhancedError = 'Gemini API key is invalid. Please check your VITE_GEMINI_API_KEY in the .env file and ensure it is a valid Google AI API key.';
      console.error('❌ GEMINI AUTH ERROR:', enhancedError);
      throw new Error(enhancedError);
    }
   
    // Provide a more graceful failure response for other errors
    console.log('🔄 GEMINI: Providing fallback response');
    return {
      content: "I seem to be having a technical issue. I apologize. Let's try to continue. Could you tell me more about a time you felt truly fulfilled in your work?",
      expectsInput: 'text',
      stage: context.stage,
    };
  }
}

// --- FINAL ANALYSIS FUNCTION ---

export async function generatePersonalityAnalysis(
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<CandidatePersonaProfile> {
  console.log('📊 GEMINI: generatePersonalityAnalysis called');
  console.log('📊 ANALYSIS INPUT:', {
    historyLength: context.conversationHistory.length,
    stage: context.stage,
    hasSimulation: !!context.simulation,
    justCause: justCause.substring(0, 50) + '...'
  });

  const conversationSummary = context.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');

  const analysisPrompt = `As Sensa, analyze the complete conversation transcript and simulation results to produce a comprehensive Candidate Persona Profile.

  ORGANIZATION'S JUST CAUSE: "${justCause}"

  CONVERSATION TRANSCRIPT:
  ${conversationSummary}

  SIMULATION RESULTS:
  ${JSON.stringify(context.simulation, null, 2) || 'No simulation was run.'}

  ---
  INSTRUCTIONS:
  Provide a detailed analysis in the following JSON format. Do not include any text outside of the JSON object.
  - coherenceScore: Assess the consistency between the candidate's stated WHY, HOW, and WHAT.
  - trustIndex: Based on their answers about accountability, failure, and vulnerability.
  - dominantConflictStyle: Use the simulation data as the primary source for this.
  - eqSnapshot: Provide a brief, descriptive analysis for each of the four domains.
  - alignmentSummary: Critically evaluate how the candidate's personal WHY and values align with the organization's Just Cause.

  {
    "statedWhy": "Candidate's core purpose/belief, summarized in one sentence.",
    "observedHow": ["List of key operational values, principles, or methods."],
    "coherenceScore": "High|Medium|Low",
    "trustIndex": "High-Trust Potential|Medium-Trust|Low-Trust/Red Flag",
    "dominantConflictStyle": "Collaborate|Accommodate|Force|Avoid|Compromise|Undetermined",
    "eqSnapshot": {
      "selfAwareness": "Brief analysis of their self-awareness.",
      "selfManagement": "Brief analysis of their ability to manage emotions and stress.",
      "socialAwareness": "Brief analysis of their empathy and ability to read social cues.",
      "relationshipManagement": "Brief analysis of their ability to manage relationships and conflict."
    },
    "keyQuotationsAndBehavioralFlags": {
      "greenFlags": ["List of positive statements or behaviors."],
      "redFlags": ["List of concerning statements or behaviors."]
    },
    "alignmentSummary": "A concluding analysis of how well the candidate's overall persona aligns with the organization's specific Just Cause."
  }`;

  console.log('📊 GEMINI: Analysis prompt prepared (length):', analysisPrompt.length);

  try {
    const rawContent = await makeGeminiRequest(analysisPrompt, 0.3);
    console.log('✅ GEMINI: Analysis response received');

    console.log('📊 GEMINI: Raw analysis content (first 200 chars):', rawContent.substring(0, 200) + '...');
   
    // FIX: Use the robust JSON extraction function
    const jsonString = extractJsonFromString(rawContent);
    const analysisResult = JSON.parse(jsonString);
    
    console.log('✅ GEMINI: Analysis parsed successfully:', {
      statedWhy: analysisResult.statedWhy?.substring(0, 50) + '...',
      coherenceScore: analysisResult.coherenceScore,
      trustIndex: analysisResult.trustIndex,
      dominantConflictStyle: analysisResult.dominantConflictStyle
    });
    return analysisResult;

  } catch (error) {
    console.error('❌ GEMINI ANALYSIS ERROR:', error);
    console.error('❌ ANALYSIS ERROR DETAILS:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
   
    if (error instanceof Error && error.message.includes('API key')) {
      const enhancedError = 'Gemini API key is invalid. Please check your VITE_GEMINI_API_KEY in the .env file and ensure it is a valid Google AI API key.';
      console.error('❌ GEMINI ANALYSIS AUTH ERROR:', enhancedError);
      throw new Error(enhancedError);
    }
   
    console.error('❌ GEMINI: Analysis generation failed completely');
    throw new Error("The AI was unable to generate a final analysis profile.");
  }
}