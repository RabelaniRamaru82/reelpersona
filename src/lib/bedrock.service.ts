// FILE: bedrock.service.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SCENARIO_BLUEPRINTS, ScenarioBlueprint, ConflictStyle } from './simulation';

// --- ROBUST AWS CLIENT INITIALIZATION ---
// Throws an error if essential environment variables are missing.
const { VITE_AWS_REGION, VITE_AWS_ACCESS_KEY_ID, VITE_AWS_SECRET_ACCESS_KEY } = import.meta.env;

if (!VITE_AWS_REGION || !VITE_AWS_ACCESS_KEY_ID || !VITE_AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing required AWS environment variables for Bedrock client.");
}

// Check for placeholder values that indicate invalid credentials
if (VITE_AWS_ACCESS_KEY_ID === 'YOUR_VALID_ACCESS_KEY_ID_HERE' || 
    VITE_AWS_SECRET_ACCESS_KEY === 'YOUR_VALID_SECRET_ACCESS_KEY_HERE') {
  throw new Error("Please replace the placeholder AWS credentials in your .env file with valid AWS credentials.");
}

const bedrockClient = new BedrockRuntimeClient({
  region: VITE_AWS_REGION,
  credentials: {
    accessKeyId: VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: VITE_AWS_SECRET_ACCESS_KEY,
  },
});

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


// --- CORE CONVERSATION AND SIMULATION FUNCTION ---

export async function generateAIResponse(
  userMessage: string,
  context: ConversationContext,
  justCause: string = "To empower individuals and organizations to discover and live their purpose"
): Promise<AIResponse> {
  // --- Simulation Logic ---
  // If we are currently in a simulation, handle the user's choice.
  if (context.stage === 'conflict_simulation' && context.simulation && !context.simulation.isComplete) {
      const chosenStyle = userMessage as ConflictStyle; // Assume frontend sends the style of the chosen option
      context.simulation.decisionHistory.push(chosenStyle);
      context.simulation.isComplete = true;

      // Ask the AI for a concluding remark before moving on
      const prompt = getSystemPrompt(justCause, true);
      const command = new InvokeModelCommand({
          modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 200,
            messages: [{ role: 'user', content: prompt }],
          }),
      });
      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const aiOutput = JSON.parse(responseBody.content[0].text);

      return {
          content: aiOutput.response,
          stage: aiOutput.nextStage, // AI transitions to the next stage
          expectsInput: 'text'
      };
  }

  // --- Standard Conversation Logic ---
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

    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiOutput = JSON.parse(responseBody.content[0].text);

    // --- Handle AI's Decision to Start a Simulation ---
    if (aiOutput.nextStage === 'conflict_simulation') {
        const scenario = SCENARIO_BLUEPRINTS[Math.floor(Math.random() * SCENARIO_BLUEPRINTS.length)];
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
    
    return {
      content: aiOutput.response,
      stage: aiOutput.nextStage,
      expectsInput: 'text'
    };

  } catch (error) {
    console.error('Bedrock API error:', error);
    
    // Provide more specific error handling for authentication issues
    if (error instanceof Error && error.message.includes('security token')) {
      throw new Error('AWS credentials are invalid. Please check your VITE_AWS_ACCESS_KEY_ID and VITE_AWS_SECRET_ACCESS_KEY in the .env file and ensure they are valid AWS credentials with Bedrock permissions.');
    }
    
    // Provide a more graceful failure response for other errors
    return {
      content: "I seem to be having a technical issue. I apologize. Let's try to continue. Could you please tell me more about a time you felt truly fulfilled in your work?",
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

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content[0].text;
    
    // Extract the JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse JSON analysis from model response.");

  } catch (error) {
    console.error('Analysis generation error:', error);
    
    if (error instanceof Error && error.message.includes('security token')) {
      throw new Error('AWS credentials are invalid. Please check your VITE_AWS_ACCESS_KEY_ID and VITE_AWS_SECRET_ACCESS_KEY in the .env file and ensure they are valid AWS credentials with Bedrock permissions.');
    }
    
    throw new Error("The AI was unable to generate a final analysis profile.");
  }
}