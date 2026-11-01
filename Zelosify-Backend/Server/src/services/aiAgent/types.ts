export interface CandidateFeatures {
  experienceYears: number;
  skills: string[];
  location: string;
}

export interface ParsedResume {
  experienceYears: number;
  skills: string[];
  normalizedSkills: string[];
  location: string;
  education: string[];
  keywords: string[];
  rawTextPreview?: string;
}

export interface JobRequirements {
  title: string;
  location: string;
  experienceMin: number;
  experienceMax?: number | null;
  contractType?: string | null;
  requiredSkills: string[];
}

export interface DeterministicMatchResult {
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  finalScore: number;
  breakdown: {
    matchedSkills: string[];
    missingSkills: string[];
    experienceDiffNote: string;
    locationMatchNote: string;
  };
}

export interface AgentRecommendationOutput {
  recommended: boolean;
  score: number;
  confidence: number;
  reason: string;
}

export interface AgentReasoningState {
  profileId: number;
  openingId: string;
  steps: Array<{
    turn: number;
    thought?: string;
    toolCall?: {
      name: string;
      args: any;
    };
    toolResult?: any;
    timestamp: number;
  }>;
  startTime: number;
  endTime?: number;
  totalLatencyMs?: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  errors: string[];
  finalOutput?: AgentRecommendationOutput;
}
