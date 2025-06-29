// Core data types for the ReelCV ecosystem

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'candidate' | 'recruiter' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Candidate extends User {
  role: 'candidate';
  profile: CandidateProfile;
}

export interface CandidateProfile {
  id: string;
  candidateId: string;
  headline: string;
  summary: string;
  location: string;
  availability: 'available' | 'open' | 'not-looking';
  preferredRoles: string[];
  salaryExpectation?: {
    min: number;
    max: number;
    currency: string;
  };
  skills: Skill[];
  projects: Project[];
  persona: PersonaAnalysis;
  reviews: Review[];
  completionScore: number;
  lastUpdated: string;
}

export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'soft' | 'language' | 'certification';
  proficiency: 1 | 2 | 3 | 4 | 5;
  yearsExperience: number;
  verified: boolean;
  endorsements: number;
  videoDemo?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  role: string;
  duration: {
    start: string;
    end?: string;
  };
  impact: string;
  mediaUrls: string[];
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
  createdAt: string;
}

export interface PersonaAnalysis {
  id: string;
  emotionalIntelligence: {
    selfAwareness: number;
    empathy: number;
    socialSkills: number;
    motivation: number;
  };
  workStyle: {
    collaboration: number;
    independence: number;
    leadership: number;
    adaptability: number;
  };
  culturalFit: {
    innovation: number;
    structure: number;
    growth: number;
    impact: number;
  };
  communicationStyle: string;
  strengths: string[];
  growthAreas: string[];
  idealEnvironment: string;
  lastAssessed: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  relationship: 'colleague' | 'manager' | 'client' | 'mentor';
  rating: number;
  feedback: string;
  skills: string[];
  verified: boolean;
  createdAt: string;
}

export interface JobPosting {
  id: string;
  recruiterId: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  location: string;
  salaryRange: {
    min: number;
    max: number;
    currency: string;
  };
  analysisScore?: {
    clarity: number;
    realism: number;
    inclusivity: number;
    suggestions: string[];
  };
  status: 'draft' | 'active' | 'paused' | 'closed';
  createdAt: string;
}

export interface CandidateMatch {
  candidateId: string;
  jobId: string;
  overallScore: number;
  skillsMatch: number;
  cultureMatch: number;
  experienceMatch: number;
  reasoning: string;
  strengths: string[];
  concerns: string[];
}