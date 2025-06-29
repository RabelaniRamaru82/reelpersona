// FILE: lib/simulation.ts
// This library contains the data structures and blueprints for the Conflict Simulation Engine.
// It directly implements the concepts from "Part III: System Instructions for Interactive Conflict Simulation".

/**
 * Defines the five primary conflict resolution styles used for analysis.
 */
export type ConflictStyle = 'Collaborate' | 'Force' | 'Avoid' | 'Accommodate' | 'Compromise';

/**
 * Represents a single choice a candidate can make at a decision point.
 * Each choice is mapped to a specific ConflictStyle.
 */
export interface SimulationChoice {
  text: string;
  style: ConflictStyle;
}

/**
 * Represents a scenario blueprint for the conflict simulation.
 */
export interface ScenarioBlueprint {
  id: string; // e.g., 'SIM-001'
  primaryConflictType: 'Relationship' | 'Task' | 'Value';
  conflictArchetype: string;
  keyPersonas: string;
  openingScene: string;
  decisionPoints: {
      prompt: string;
      choices: SimulationChoice[];
  }[];
  coreCompetenciesAssessed: string[];
}

/**
* The library of conflict simulation scenarios, based on Table 2.
* The AI will randomly select one of these to present to the candidate.
*/
export const SCENARIO_BLUEPRINTS: ScenarioBlueprint[] = [
  {
      id: 'SIM-001',
      primaryConflictType: 'Relationship',
      conflictArchetype: 'Passive-Aggressive Communication & Unclear Roles',
      keyPersonas: '"Alex," a senior colleague who feels their expertise is being ignored.',
      openingScene: "You have just joined a new project team. You notice that a senior team member, Alex, has been consistently using a shared document to override your contributions without discussion. This morning, you receive an email from Alex, with your manager CC'd. It reads: 'Just wanted to 'clarify' the process here, as there seems to be some confusion. I've reverted the changes on the project plan to reflect the correct approach. Let's try to stick to the established workflow to avoid rework.'",
      decisionPoints: [
        {
          prompt: "How do you respond?",
          choices: [
            { text: "Do nothing. Alex is more senior, and you don't want to cause trouble in your first week.", style: 'Avoid' },
            { text: "Reply to the email, addressing only your manager, and ask for clarification on your role.", style: 'Compromise' },
            { text: "Reply-all to the email, professionally stating your belief that your changes were valid and asking Alex to discuss disagreements directly before overriding your work.", style: 'Force' },
            { text: "Schedule a brief 15-minute video call with Alex. Open the conversation by saying, 'I saw your email and want to make sure we're aligned. Can you walk me through your concerns so I can better understand your perspective?'", style: 'Collaborate' }
          ]
        }
      ],
      coreCompetenciesAssessed: ['Emotional Regulation', 'Conflict Management', 'Assertiveness', 'Empathy']
  },
  {
      id: 'SIM-002',
      primaryConflictType: 'Task',
      conflictArchetype: 'Underperforming Team Member & Project Delay',
      keyPersonas: '"Maria," a talented but disengaged team member; "David," your results-focused manager.',
      openingScene: "You are leading a critical project that is now one week behind schedule. One of your key team members, Maria, has missed her last two deadlines. When you checked in, she was defensive and blamed external delays. However, other team members have privately mentioned that Maria seems disengaged. Your manager, David, has just messaged you: 'Need an update on the project timeline. Are we still on track for the launch date?'",
      decisionPoints: [
        {
          prompt: "What is your immediate next step?",
          choices: [
            { text: "Tell David the project is delayed because of Maria's performance issues.", style: 'Force' },
            { text: "Reassure David that everything is under control, then work late to complete some of Maria's overdue tasks yourself.", style: 'Accommodate' },
            { text: "Call an emergency team meeting and publicly reassign Maria's most critical task to mitigate the risk.", style: 'Compromise' },
            { text: "Schedule a private 1-on-1 with Maria. Start by saying, 'I want to check in on how you're doing. I've noticed some deadlines have slipped, and I want to understand what challenges you're facing and how I can best support you.'", style: 'Collaborate' }
          ]
        }
      ],
      coreCompetenciesAssessed: ['Accountability', 'Leadership', 'Empathy', 'Problem-Solving', 'Developing Others']
  },
  {
      id: 'SIM-003',
      primaryConflictType: 'Value',
      conflictArchetype: 'Unethical Leadership & Pressure to Compromise Standards',
      keyPersonas: '"Frank," your manager, who is under intense pressure to meet a quarterly goal.',
      openingScene: "Your manager, Frank, calls you into his office. He says, 'We're not going to hit our sales target this quarter unless we get creative. I need you to process the new Johnson deal today, but list the closing date as the last day of the previous quarter. It's just a paperwork change, and it will ensure the whole team gets their bonus. I need you to be a team player on this.' This action is against company policy and feels wrong to you.",
      decisionPoints: [
        {
          prompt: "What do you do?",
          choices: [
            { text: "Agree to make the change. Frank is your manager, and you don't want to jeopardize your job or the team's bonus.", style: 'Accommodate' },
            { text: "Firmly refuse, stating that the request is unethical and you are not comfortable breaking company policy.", style: 'Force' },
            { text: "Tell Frank you need time to think, then discreetly report the conversation to the anonymous ethics hotline.", style: 'Avoid' },
            { text: "Acknowledge the pressure Frank is under, then say, 'I am not comfortable changing the date, as it violates policy. However, what if we problem-solve another way to hit our goal without breaking the rules?'", style: 'Collaborate' }
          ]
        }
      ],
      coreCompetenciesAssessed: ['Integrity', 'Ethical Judgment', 'Courage', 'Problem-Solving', 'Influence']
  },
  {
      id: 'SIM-004',
      primaryConflictType: 'Relationship',
      conflictArchetype: 'Credit Attribution & Recognition',
      keyPersonas: '"Jordan," an ambitious colleague who takes credit for team work.',
      openingScene: "During a team meeting, your colleague Jordan presents the innovative solution you developed last week as their own idea. They say, 'I've been working on this approach and think it could really solve our client's problem.' Your manager seems impressed and asks Jordan to lead the implementation. Other team members look uncomfortable but say nothing.",
      decisionPoints: [
        {
          prompt: "What do you do in this moment?",
          choices: [
            { text: "Say nothing during the meeting to avoid confrontation, but feel frustrated about the situation.", style: 'Avoid' },
            { text: "Politely interject: 'That's actually the approach I developed last week. I'm happy to collaborate with Jordan on the implementation.'", style: 'Force' },
            { text: "Wait until after the meeting, then speak privately with your manager about the situation.", style: 'Compromise' },
            { text: "Say: 'Jordan, I'm glad you see value in that approach. Since I developed the initial framework, perhaps we could present how we might collaborate to implement it most effectively?'", style: 'Collaborate' }
          ]
        }
      ],
      coreCompetenciesAssessed: ['Assertiveness', 'Professional Integrity', 'Conflict Management', 'Collaborative Leadership']
  },
  {
      id: 'SIM-005',
      primaryConflictType: 'Task',
      conflictArchetype: 'Resource Allocation & Competing Priorities',
      keyPersonas: '"Sam," a peer manager competing for the same resources.',
      openingScene: "You and Sam, another department manager, both need the same specialized team member, Chris, for critical projects with overlapping timelines. Sam approaches you saying, 'I know we both need Chris, but my project is directly tied to the CEO's quarterly goals. I really need Chris full-time for the next month.' You know your project is equally important for client retention.",
      decisionPoints: [
        {
          prompt: "How do you respond to Sam?",
          choices: [
            { text: "Agree to let Sam have Chris full-time, even though it will significantly impact your project timeline.", style: 'Accommodate' },
            { text: "Firmly state that your project is equally critical and you need Chris as originally planned.", style: 'Force' },
            { text: "Suggest splitting Chris's time 50/50 between both projects, even though neither project will be optimal.", style: 'Compromise' },
            { text: "Propose: 'Both our projects are critical. Let's map out the specific tasks and timelines to see if we can sequence Chris's involvement to maximize impact for both projects.'", style: 'Collaborate' }
          ]
        }
      ],
      coreCompetenciesAssessed: ['Strategic Thinking', 'Negotiation', 'Resource Management', 'Cross-functional Collaboration']
  }
];