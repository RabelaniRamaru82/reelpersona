// FILE: bedrock.service.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SCENARIO_BLUEPRINTS, ScenarioBlueprint, ConflictStyle } from './simulation';

// --- ROBUST AWS CLIENT INITIALIZATION WITH DEBUGGING ---
console.log('🔍 BEDROCK SERVICE: Starting initialization...');

const { VITE_AWS_REGION, VITE_AWS_ACCESS_KEY_ID, VITE_AWS_SECRET_ACCESS_KEY } = import.meta.env;

console.log('🔍 BEDROCK ENV CHECK:', {
  hasRegion: !!VITE_AWS_REGION,
  hasAccessKey: !!VITE_AWS_ACCESS_KEY_ID,
  hasSecretKey: !!VITE_AWS_SECRET_ACCESS_KEY,
  region: VITE_AWS_REGION,
  accessKeyPrefix: VITE_AWS_ACCESS_KEY_ID ? VITE_AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'MISSING',
  secretKeyPrefix: VITE_AWS_SECRET_ACCESS_KEY ? VITE_AWS_SECRET_ACCESS_KEY.substring(0, 8) + '...' : 'MISSING'
});

if (!VITE_AWS_REGION || !VITE_AWS_ACCESS_KEY_ID || !VITE_AWS_SECRET_ACCESS_KEY) {
  const error = "Missing required AWS environment variables for Bedrock client.";
  console.error('❌ BEDROCK ERROR:', error);
  console.error('❌ MISSING VARS:', {
    VITE_AWS_REGION: !VITE_AWS_REGION,
    VITE_AWS_ACCESS_KEY_ID: !VITE_AWS_ACCESS_KEY_ID,
    VITE_AWS_SECRET_ACCESS_KEY: !VITE_AWS_SECRET_ACCESS_KEY
  });
  throw new Error(error);
}

// Check for placeholder values that indicate invalid credentials
if (VITE_AWS_ACCESS_KEY_ID === 'YOUR_VALID_ACCESS_KEY_ID_HERE' || 
    VITE_AWS_SECRET_ACCESS_KEY === 'YOUR_VALID_SECRET_ACCESS_KEY_HERE' ||
    VITE_AWS_ACCESS_KEY_ID === 'your_aws_access_key_id_here' ||
    VITE_AWS_SECRET_ACCESS_KEY === 'your_aws_secret_access_key_here') {
  const error = "Please replace the placeholder AWS credentials in your .env file with valid AWS credentials.";
  console.error('❌ BEDROCK ERROR:', error);
  console.error('❌ PLACEHOLDER DETECTED:', {
    accessKey: VITE_AWS_ACCESS_KEY_ID,
    secretKey: VITE_AWS_SECRET_ACCESS_KEY.substring(0, 20) + '...'
  });
  throw new Error(error);
}

console.log('✅ BEDROCK: Environment variables validated');

const bedrockClient = new BedrockRuntimeClient({
  region: VITE_AWS_REGION,
  credentials: {
    accessKeyId: VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: VITE_AWS_SECRET_ACCESS_KEY,
  },
});

console.log('✅ BEDROCK: Client initialized with region:', VITE_AWS_REGION);

// --- CLAUDE MODEL SELECTION WITH FALLBACK ---
// Try Claude 4 Sonnet first, fallback to Claude 3 Sonnet if access denied
const CLAUDE_MODELS = [
  {
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    name: 'Claude 4 Sonnet (Inference Profile)',
    type: 'inference_profile'
  },
  {
    id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    name: 'Claude 3.5 Sonnet',
    type: 'direct_model'
  },
  {
    id: 'anthropic.claude-3-sonnet-20240229-v1:0',
    name: 'Claude 3 Sonnet',
    type: 'direct_model'
  }
];

let currentModelIndex = 0;
let currentModel = CLAUDE_MODELS[currentModelIndex];

console.log('🤖 BEDROCK: Starting with model:', currentModel.name, '(' + currentModel.id + ')');

// --- ENHANCED INTERFACES ALIGNED WITH RESEARCH ---

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

// --- MODEL FALLBACK FUNCTION ---
async function tryNextModel(): Promise<boolean> {
  if (currentModelIndex < CLAUDE_MODELS.length - 1) {
    currentModelIndex++;
    currentModel = CLAUDE_MODELS[currentModelIndex];
    console.log('🔄 BEDROCK: Falling back to model:', currentModel.name, '(' + currentModel.id + ')');
    return true;
  }
  return false;
}

// --- CORE CONVERSATION AND SIMULATION FUNCTION ---

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<AIResponse> {
  console.log('🤖 BEDROCK: generateAIResponse called with model:', currentModel.name);
  console.log('🤖 INPUT:', {
    userMessage: userMessage.substring(0, 100) + '...',
    stage: context.stage,
    historyLength: context.conversationHistory.length,
    justCause: justCause.substring(0, 50) + '...',
    currentModel: currentModel.id
  });

  // --- Simulation Logic ---
  // If we are currently in a simulation, handle the user's choice.
  if (context.stage === 'conflict_simulation' && context.simulation && !context.simulation.isComplete) {
      console.log('🎭 BEDROCK: Processing simulation choice with model:', currentModel.name);
      const chosenStyle = userMessage as ConflictStyle; // Assume frontend sends the style of the chosen option
      context.simulation.decisionHistory.push(chosenStyle);
      context.simulation.isComplete = true;

      // Ask the AI for a concluding remark before moving on
      const prompt = getSystemPrompt(justCause, true);
      console.log('🎭 BEDROCK: Sending simulation conclusion request to model:', currentModel.name);
      
      return await makeBedrockRequest(prompt, 200, true);
  }

  // --- Standard Conversation Logic ---
  console.log('💬 BEDROCK: Processing standard conversation with model:', currentModel.name);
  
  context.conversationHistory.push({ role: 'user', content: userMessage });
  const conversationHistoryText = context.conversationHistory.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join('\n');

  const prompt = `${getSystemPrompt(justCause)}

  CURRENT CONTEXT:
  Stage: ${context.stage}
  User Profile: ${JSON.stringify(context.userProfile)}
  RECENT CONVERSATION:
  ${conversationHistoryText}
  
  Respond as Sensa with your characteristic deep, calming professionalism in the required JSON format.`;

  console.log('💬 BEDROCK: Prepared prompt for model:', currentModel.name, '(first 200 chars):', prompt.substring(0, 200) + '...');

  try {
    const aiResponse = await makeBedrockRequest(prompt, 1000, false);
    
    // --- Handle AI's Decision to Start a Simulation ---
    if (aiResponse.stage === 'conflict_simulation') {
        console.log('🎭 BEDROCK: AI decided to start simulation');
        const scenario = SCENARIO_BLUEPRINTS[Math.floor(Math.random() * SCENARIO_BLUEPRINTS.length)];
        console.log('🎭 BEDROCK: Selected scenario:', scenario.id);
        
        context.simulation = {
            scenario,
            decisionHistory: [],
            isComplete: false,
        };
        return {
            content: aiResponse.content, // AI's transition text
            stage: 'conflict_simulation',
            expectsInput: 'choice',
            simulationData: {
              openingScene: scenario.openingScene,
              prompt: scenario.decisionPoints[0].prompt,
              choices: scenario.decisionPoints[0].choices,
            }
        };
    }

    context.conversationHistory.push({ role: 'assistant', content: aiResponse.content });
    
    console.log('✅ BEDROCK: Standard conversation completed successfully with model:', currentModel.name);
    return aiResponse;

  } catch (error) {
    console.error('❌ BEDROCK CONVERSATION ERROR:', error);
    
    // Check if we can try a fallback model
    if (error instanceof Error && 
        (error.message.includes('AccessDeniedException') || 
         error.message.includes('ValidationException') ||
         error.message.includes('403'))) {
      
      console.log('🔄 BEDROCK: Access denied for model:', currentModel.name, '- trying fallback...');
      
      if (await tryNextModel()) {
        console.log('🔄 BEDROCK: Retrying with fallback model:', currentModel.name);
        return generateAIResponse(userMessage, context, justCause);
      } else {
        console.error('❌ BEDROCK: All models exhausted');
        throw new Error(`No available Claude models. Please ensure your AWS account has access to at least one Claude model in the ${VITE_AWS_REGION} region.`);
      }
    }
    
    // Provide a more graceful failure response for other errors
    console.log('🔄 BEDROCK: Providing fallback response');
    return {
      content: "I seem to be having a technical issue. I apologize. Let's try to continue. Could you please tell me more about a time you felt truly fulfilled in your work?",
      expectsInput: 'text',
      stage: context.stage,
    };
  }
}

// --- BEDROCK REQUEST HELPER FUNCTION ---
async function makeBedrockRequest(prompt: string, maxTokens: number, isSimulation: boolean): Promise<AIResponse> {
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    temperature: isSimulation ? 0.3 : 0.7,
  };

  console.log('💬 BEDROCK: Request body prepared for model:', currentModel.name, {
    anthropic_version: requestBody.anthropic_version,
    max_tokens: requestBody.max_tokens,
    temperature: requestBody.temperature,
    messageLength: requestBody.messages[0].content.length,
    modelId: currentModel.id
  });

  const command = new InvokeModelCommand({
    modelId: currentModel.id,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  console.log('💬 BEDROCK: Invoking model:', currentModel.name, '(' + currentModel.id + ')');

  const response = await bedrockClient.send(command);
  console.log('✅ BEDROCK: Response received from model:', currentModel.name);

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  console.log('💬 BEDROCK: Response body parsed:', {
    id: responseBody.id,
    type: responseBody.type,
    role: responseBody.role,
    model: responseBody.model,
    contentLength: responseBody.content?.[0]?.text?.length || 0,
    usage: responseBody.usage
  });

  const aiOutput = JSON.parse(responseBody.content[0].text);
  console.log('💬 BEDROCK: AI output parsed:', {
    responseLength: aiOutput.response?.length || 0,
    nextStage: aiOutput.nextStage,
    hasResponse: !!aiOutput.response
  });

  if (isSimulation) {
    return {
      content: aiOutput.response,
      stage: aiOutput.nextStage,
      expectsInput: 'text'
    };
  } else {
    return {
      content: aiOutput.response,
      stage: aiOutput.nextStage,
      expectsInput: 'text'
    };
  }
}

// --- FINAL ANALYSIS FUNCTION ---

export async function generatePersonalityAnalysis(
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<CandidatePersonaProfile> {
  console.log('📊 BEDROCK: generatePersonalityAnalysis called with model:', currentModel.name);
  console.log('📊 ANALYSIS INPUT:', {
    historyLength: context.conversationHistory.length,
    stage: context.stage,
    hasSimulation: !!context.simulation,
    justCause: justCause.substring(0, 50) + '...',
    currentModel: currentModel.id
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

  console.log('📊 BEDROCK: Analysis prompt prepared for model:', currentModel.name, '(length):', analysisPrompt.length);

  try {
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
    };

    console.log('📊 BEDROCK: Analysis request body prepared for model:', currentModel.name, {
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      promptLength: requestBody.messages[0].content.length,
      modelId: currentModel.id
    });

    const command = new InvokeModelCommand({
      modelId: currentModel.id,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    console.log('📊 BEDROCK: Invoking model for analysis:', currentModel.name);
    const response = await bedrockClient.send(command);
    console.log('✅ BEDROCK: Analysis response received from model:', currentModel.name);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log('📊 BEDROCK: Analysis response body:', {
      id: responseBody.id,
      contentLength: responseBody.content?.[0]?.text?.length || 0,
      usage: responseBody.usage
    });

    const content = responseBody.content[0].text;
    console.log('📊 BEDROCK: Raw analysis content (first 200 chars):', content.substring(0, 200) + '...');
    
    // Extract the JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysisResult = JSON.parse(jsonMatch[0]);
      console.log('✅ BEDROCK: Analysis parsed successfully with model:', currentModel.name, {
        statedWhy: analysisResult.statedWhy?.substring(0, 50) + '...',
        coherenceScore: analysisResult.coherenceScore,
        trustIndex: analysisResult.trustIndex,
        dominantConflictStyle: analysisResult.dominantConflictStyle
      });
      return analysisResult;
    }
    
    console.error('❌ BEDROCK: Failed to extract JSON from analysis response');
    throw new Error("Failed to parse JSON analysis from model response.");

  } catch (error) {
    console.error('❌ BEDROCK ANALYSIS ERROR:', error);
    console.error('❌ ANALYSIS ERROR DETAILS:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      currentModel: currentModel.id
    });
    
    // Check if we can try a fallback model for analysis
    if (error instanceof Error && 
        (error.message.includes('AccessDeniedException') || 
         error.message.includes('ValidationException') ||
         error.message.includes('403'))) {
      
      console.log('🔄 BEDROCK: Access denied for analysis with model:', currentModel.name, '- trying fallback...');
      
      if (await tryNextModel()) {
        console.log('🔄 BEDROCK: Retrying analysis with fallback model:', currentModel.name);
        return generatePersonalityAnalysis(context, justCause);
      }
    }
    
    console.error('❌ BEDROCK: Analysis generation failed completely');
    throw new Error("The AI was unable to generate a final analysis profile.");
  }
}