import { z } from 'zod';

// Candidate object embedded in match result
export const CandidateSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  headline: z.string(),
  location: z.string(),
  availability: z.string(),
  skills: z.array(z.any()),
  avatar_url: z.string().nullable().optional(),
});

export const CandidateMatchSchema = z.object({
  candidate_id: z.string(),
  overall_score: z.number(),
  skills_match: z.number(),
  culture_match: z.number(),
  experience_match: z.number(),
  reasoning: z.string(),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  candidate: CandidateSchema,
});

export const MatchResponseSchema = z.array(CandidateMatchSchema);

// Analyze job response (simplified)
export const AnalyzeJobResponseSchema = z.object({
  job_id: z.string(),
  keywords: z.array(z.string()),
}); 